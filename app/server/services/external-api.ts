import { createHash, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { isExternalApiEnabled } from "@/lib/deployment-boundary.mjs";
import { prisma } from "@/lib/prisma";

export type ExternalScope =
  | "content:read"
  | "content:write"
  | "content:generate"
  | "media:read"
  | "media:write";

export interface ExternalPrincipal {
  userId: string;
  apiKeyId: string;
  scopes: Set<string>;
}

export class ExternalApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly headers?: Readonly<Record<string, string>>,
  ) {
    super(message);
  }
}

export function assertExternalApiEnabled(env: NodeJS.ProcessEnv = process.env): void {
  if (!isExternalApiEnabled(env)) {
    throw new ExternalApiError(503, "EXTERNAL_API_DISABLED", "외부 API가 활성화되지 않았습니다.");
  }
}

function digest(value: string | Buffer): Buffer {
  return createHash("sha256").update(value).digest();
}

export function hashExternalValue(value: string | Buffer): string {
  return digest(value).toString("hex");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function hashJson(value: unknown): string {
  return hashExternalValue(JSON.stringify(canonicalize(value)));
}

export async function authenticateExternalRequest(
  request: Request,
  requiredScope: ExternalScope | null,
): Promise<ExternalPrincipal> {
  assertExternalApiEnabled();
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
  if (!token || token.length < 32 || token.length > 512) {
    throw new ExternalApiError(401, "UNAUTHORIZED", "유효한 API 키가 필요합니다.");
  }

  const keyHash = hashExternalValue(token);
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { user: { select: { id: true, isBlocked: true } } },
  });

  if (!apiKey) {
    // Keep a constant-time comparison on the miss path to reduce timing variance.
    timingSafeEqual(digest(token), digest("invalid-flowpack-api-key"));
    throw new ExternalApiError(401, "UNAUTHORIZED", "유효한 API 키가 필요합니다.");
  }
  if (apiKey.revokedAt || apiKey.expiresAt <= new Date()) {
    throw new ExternalApiError(401, "UNAUTHORIZED", "API 키가 만료되었거나 폐기되었습니다.");
  }
  if (apiKey.user.isBlocked) {
    throw new ExternalApiError(403, "ACCOUNT_BLOCKED", "사용할 수 없는 계정입니다.");
  }

  const scopes = new Set<string>(JSON.parse(apiKey.scopes) as string[]);
  if (requiredScope && !scopes.has(requiredScope)) {
    throw new ExternalApiError(403, "INSUFFICIENT_SCOPE", "이 작업에 필요한 API 권한이 없습니다.");
  }

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return { userId: apiKey.user.id, apiKeyId: apiKey.id, scopes };
}

export function requireIdempotencyKey(request: Request): string {
  const value = request.headers.get("idempotency-key")?.trim();
  if (!value || value.length < 8 || value.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(value)) {
    throw new ExternalApiError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "8~128자의 Idempotency-Key 헤더가 필요합니다.",
    );
  }
  return value;
}

export function assertJsonRequestSize(request: Request, maximumBytes = 256 * 1024): void {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new ExternalApiError(413, "PAYLOAD_TOO_LARGE", "요청 본문이 너무 큽니다.");
  }
}

export type IdempotencyStart =
  | { kind: "new"; requestId: string }
  | { kind: "replay"; status: number; payload: unknown };

type ExistingExternalRequest = Awaited<ReturnType<typeof prisma.externalRequest.findUnique>>;

async function resolveExistingRequest(existing: ExistingExternalRequest, requestHash: string): Promise<IdempotencyStart> {
  if (!existing) throw new ExternalApiError(409, "REQUEST_IN_PROGRESS", "요청 상태를 확인할 수 없습니다.");
  if (existing.requestHash !== requestHash) {
    throw new ExternalApiError(409, "IDEMPOTENCY_CONFLICT", "같은 키가 다른 요청에 사용되었습니다.");
  }
  if ((existing.state === "COMPLETED" || existing.state === "FAILED") && existing.responseStatus && existing.responseData) {
    return { kind: "replay", status: existing.responseStatus, payload: JSON.parse(existing.responseData) };
  }
  if (existing.state === "PROCESSING" && existing.leaseExpiresAt && existing.leaseExpiresAt <= new Date()) {
    const payload = {
      success: false as const,
      error: "이전 요청이 중단되었습니다. 새 Idempotency-Key로 다시 요청해주세요.",
      code: "REQUEST_EXPIRED",
    };
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "external_requests" WHERE "id" = ${existing.id} FOR UPDATE`;
      const current = await tx.externalRequest.findUnique({ where: { id: existing.id } });
      if (!current || current.state !== "PROCESSING" || !current.leaseExpiresAt || current.leaseExpiresAt > new Date()) return;
      if (current.creditReserved) {
        await tx.$executeRaw`UPDATE "users" SET "creditsUsed" = GREATEST("creditsUsed" - 1, 0) WHERE "id" = ${current.userId}`;
      }
      await tx.mediaFile.deleteMany({ where: { userId: current.userId, url: `pending:${current.id}` } });
      await tx.externalRequest.update({
        where: { id: current.id },
        data: {
          state: "FAILED", responseStatus: 409, responseData: JSON.stringify(payload),
          errorCode: payload.code, creditReserved: false, leaseExpiresAt: null,
        },
      });
    });
    const recovered = await prisma.externalRequest.findUnique({ where: { id: existing.id } });
    if (recovered?.state === "FAILED") return { kind: "replay", status: 409, payload };
  }
  throw new ExternalApiError(409, "REQUEST_IN_PROGRESS", "동일한 요청이 처리 중입니다.");
}

export async function beginIdempotentRequest(input: {
  principal: ExternalPrincipal;
  method: string;
  path: string;
  idempotencyKey: string;
  requestHash: string;
}): Promise<IdempotencyStart> {
  const now = new Date();
  const uniqueWhere = {
    apiKeyId_method_path_idempotencyKey: {
      apiKeyId: input.principal.apiKeyId,
      method: input.method,
      path: input.path,
      idempotencyKey: input.idempotencyKey,
    },
  };
  const prior = await prisma.externalRequest.findUnique({ where: uniqueWhere });
  if (prior) return resolveExistingRequest(prior, input.requestHash);

  const configuredLimit = Number(process.env.EXTERNAL_API_WRITE_LIMIT_PER_MINUTE ?? "60");
  const limit = Number.isInteger(configuredLimit) && configuredLimit > 0 ? configuredLimit : 60;
  const recentRequestCount = await prisma.externalRequest.count({
    where: {
      apiKeyId: input.principal.apiKeyId,
      createdAt: { gte: new Date(now.getTime() - 60_000) },
    },
  });
  if (recentRequestCount >= limit) {
    throw new ExternalApiError(
      429,
      "RATE_LIMITED",
      "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
      { "Retry-After": "60" },
    );
  }
  try {
    const record = await prisma.externalRequest.create({
      data: {
        userId: input.principal.userId,
        apiKeyId: input.principal.apiKeyId,
        method: input.method,
        path: input.path,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
        state: "PROCESSING",
        leaseExpiresAt: new Date(now.getTime() + 10 * 60 * 1000),
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
    });
    return { kind: "new", requestId: record.id };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
  }

  const existing = await prisma.externalRequest.findUnique({
    where: uniqueWhere,
  });
  return resolveExistingRequest(existing, input.requestHash);
}

export async function failIdempotentRequest(
  requestId: string,
  status: number,
  payload: unknown,
  errorCode: string,
): Promise<void> {
  await prisma.externalRequest.update({
    where: { id: requestId },
    data: {
      state: "FAILED",
      responseStatus: status,
      responseData: JSON.stringify(payload),
      errorCode,
      creditReserved: false,
      leaseExpiresAt: null,
    },
  });
}

export function successResponse(data: unknown, status = 200): Response {
  return Response.json({ success: true, data }, { status });
}

export function errorPayload(error: unknown): { status: number; payload: { success: false; error: string; code: string } } {
  if (error instanceof ExternalApiError) {
    return {
      status: error.status,
      payload: { success: false, error: error.message, code: error.code },
    };
  }
  if (error instanceof SyntaxError) {
    return {
      status: 400,
      payload: { success: false, error: "JSON 형식을 확인해주세요.", code: "VALIDATION_ERROR" },
    };
  }
  console.error("[External API] request failed", error);
  return {
    status: 500,
    payload: { success: false, error: "요청 처리 중 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
  };
}

export function errorResponse(error: unknown): Response {
  const { status, payload } = errorPayload(error);
  return Response.json(payload, {
    status,
    headers: error instanceof ExternalApiError ? error.headers : undefined,
  });
}
