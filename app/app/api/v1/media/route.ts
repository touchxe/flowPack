import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { deleteStoredObject, isStorageConfigured, uploadStoredObject, type StoredObject } from "@/lib/storage";
import {
  ExternalApiError,
  authenticateExternalRequest,
  beginIdempotentRequest,
  errorPayload,
  failIdempotentRequest,
  hashExternalValue,
  requireIdempotencyKey,
} from "@/server/services/external-api";

export const runtime = "nodejs";

const maximumImageBytes = 20 * 1024 * 1024;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const planLimits: Record<string, number> = {
  FREE: 100 * 1024 * 1024,
  STARTER: 1024 * 1024 * 1024,
  PRO: 10 * 1024 * 1024 * 1024,
  ENTERPRISE: Number.MAX_SAFE_INTEGER,
};

function signatureMatches(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

export async function POST(request: Request) {
  let trackedRequestId: string | null = null;
  let stored: StoredObject | null = null;
  let mediaId: string | null = null;
  try {
    const principal = await authenticateExternalRequest(request, "media:write");
    const idempotencyKey = requireIdempotencyKey(request);
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > maximumImageBytes + 1024 * 1024) {
      throw new ExternalApiError(413, "PAYLOAD_TOO_LARGE", "사진은 장당 20MB까지 업로드할 수 있습니다.");
    }
    if (!isStorageConfigured()) {
      throw new ExternalApiError(503, "STORAGE_UNAVAILABLE", "사진 저장소를 사용할 수 없습니다.");
    }

    const formData = await request.formData();
    const fileValue = formData.get("file");
    if (!(fileValue instanceof File)) throw new ExternalApiError(400, "VALIDATION_ERROR", "file이 필요합니다.");
    if (!allowedMimeTypes.has(fileValue.type)) {
      throw new ExternalApiError(415, "UNSUPPORTED_MEDIA_TYPE", "JPG, PNG, WebP 사진만 업로드할 수 있습니다.");
    }
    if (fileValue.size < 1 || fileValue.size > maximumImageBytes) {
      throw new ExternalApiError(413, "PAYLOAD_TOO_LARGE", "사진은 장당 20MB까지 업로드할 수 있습니다.");
    }
    const buffer = Buffer.from(await fileValue.arrayBuffer());
    if (!signatureMatches(buffer, fileValue.type)) {
      throw new ExternalApiError(415, "UNSUPPORTED_MEDIA_TYPE", "파일 내용과 사진 형식이 일치하지 않습니다.");
    }

    const requestHash = hashExternalValue(Buffer.concat([
      Buffer.from(`${fileValue.name}\0${fileValue.type}\0${fileValue.size}\0`, "utf8"), buffer,
    ]));
    const started = await beginIdempotentRequest({
      principal, method: "POST", path: "/api/v1/media", idempotencyKey, requestHash,
    });
    if (started.kind === "replay") return Response.json(started.payload, { status: started.status });
    trackedRequestId = started.requestId;
    mediaId = randomUUID();

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "users" WHERE "id" = ${principal.userId} FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: principal.userId }, select: { plan: true } });
      const usage = await tx.mediaFile.aggregate({ where: { userId: principal.userId }, _sum: { size: true } });
      if ((usage._sum.size ?? 0) + buffer.length > planLimits[user?.plan ?? "FREE"]) {
        throw new ExternalApiError(422, "STORAGE_QUOTA_EXCEEDED", "저장 용량이 부족합니다.");
      }
      await tx.mediaFile.create({
        data: {
          id: mediaId!, userId: principal.userId, name: fileValue.name.trim().slice(0, 255) || "image",
          url: `pending:${started.requestId}`, blobKey: `pending:${started.requestId}`,
          mimeType: fileValue.type, mediaType: "IMAGE", size: buffer.length,
        },
      });
    });

    try {
      stored = await uploadStoredObject({ id: mediaId, ownerId: principal.userId, buffer, mimeType: fileValue.type });
    } catch {
      throw new ExternalApiError(503, "STORAGE_UNAVAILABLE", "사진 저장에 실패했습니다.");
    }
    const data = {
      id: mediaId,
      name: fileValue.name.trim().slice(0, 255) || "image",
      mimeType: fileValue.type,
      size: buffer.length,
      contentPath: `/api/v1/media/${mediaId}/content`,
    };
    const payload = { success: true, data };
    await prisma.$transaction([
      prisma.mediaFile.update({
        where: { id: mediaId },
        data: { url: stored.url, blobKey: stored.blobKey, width: stored.width, height: stored.height },
      }),
      prisma.externalRequest.update({
        where: { id: started.requestId },
        data: {
          state: "COMPLETED", responseStatus: 201, responseData: JSON.stringify(payload),
          resourceId: mediaId, leaseExpiresAt: null,
        },
      }),
    ]);
    return Response.json(payload, { status: 201 });
  } catch (error) {
    if (stored) {
      await deleteStoredObject({ url: stored.url, blobKey: stored.blobKey, mimeType: "image/*" }).catch(() => undefined);
    }
    if (mediaId) await prisma.mediaFile.deleteMany({ where: { id: mediaId, url: { startsWith: "pending:" } } }).catch(() => undefined);
    const { status, payload } = errorPayload(error);
    if (trackedRequestId) await failIdempotentRequest(trackedRequestId, status, payload, payload.code).catch(() => undefined);
    return Response.json(payload, { status });
  }
}
