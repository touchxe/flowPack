import { randomUUID } from "node:crypto";
import { isAIConfigured } from "@/lib/ai-client";
import { prisma } from "@/lib/prisma";
import {
  generateExternalLongformJobSchema,
  type GenerateExternalLongformJobInput,
} from "@/lib/validations/external-content-schema";
import { ExternalApiError, type ExternalPrincipal } from "@/server/services/external-api";
import {
  createGeneratedLongformContent,
  generateLongformDraft,
} from "@/server/services/longform-generation";

const ACTIVE_JOB_STATES = ["QUEUED", "RUNNING"];
const JOB_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const JOB_LEASE_MS = 6 * 60 * 1000;

interface GenerationJobView {
  id: string;
  status: string;
  contentId: string | null;
  error: { code: string; message: string } | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

function toJobView(job: {
  id: string;
  status: string;
  contentId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}): GenerationJobView {
  return {
    id: job.id,
    status: job.status.toLowerCase(),
    contentId: job.contentId,
    error: job.errorCode
      ? { code: job.errorCode, message: job.errorMessage ?? "생성 작업에 실패했습니다." }
      : null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt,
  };
}

export async function queueExternalGenerationJob(input: {
  principal: ExternalPrincipal;
  externalRequestId: string;
  generationInput: GenerateExternalLongformJobInput;
}): Promise<GenerationJobView> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "users" WHERE "id" = ${input.principal.userId} FOR UPDATE`;
    const user = await tx.user.findUnique({
      where: { id: input.principal.userId },
      select: { role: true, plan: true, creditsUsed: true, creditsTotal: true },
    });
    if (!user) throw new ExternalApiError(404, "NOT_FOUND", "사용자를 찾을 수 없습니다.");

    const mediaIds = input.generationInput.images.map((image) => image.mediaId);
    const mediaCount = mediaIds.length === 0 ? 0 : await tx.mediaFile.count({
      where: { id: { in: mediaIds }, userId: input.principal.userId, mediaType: "IMAGE" },
    });
    if (mediaCount !== mediaIds.length) {
      throw new ExternalApiError(422, "INVALID_MEDIA_REFERENCE", "사진이 없거나 사용할 권한이 없습니다.");
    }

    const activeJob = await tx.generationJob.findFirst({
      where: { userId: input.principal.userId, status: { in: ACTIVE_JOB_STATES } },
      select: { id: true },
    });
    if (activeJob) {
      throw new ExternalApiError(409, "GENERATION_ALREADY_RUNNING", "이미 실행 중인 생성 작업이 있습니다.");
    }

    const unlimited = user.role === "ADMIN" || user.plan === "ENTERPRISE";
    if (!unlimited && user.creditsUsed >= user.creditsTotal) {
      throw new ExternalApiError(402, "CREDIT_EXHAUSTED", "사용 가능한 AI 크레딧이 없습니다.");
    }
    if (!unlimited) {
      await tx.user.update({
        where: { id: input.principal.userId },
        data: { creditsUsed: { increment: 1 } },
      });
    }

    const now = new Date();
    const job = await tx.generationJob.create({
      data: {
        userId: input.principal.userId,
        apiKeyId: input.principal.apiKeyId,
        externalRequestId: input.externalRequestId,
        input: JSON.stringify(input.generationInput),
        creditReserved: !unlimited,
        expiresAt: new Date(now.getTime() + JOB_RETENTION_MS),
      },
    });
    const view = toJobView(job);
    const payload = { success: true, data: view };
    await tx.externalRequest.update({
      where: { id: input.externalRequestId },
      data: {
        state: "COMPLETED",
        resourceId: job.id,
        responseStatus: 202,
        responseData: JSON.stringify(payload),
        leaseExpiresAt: null,
      },
    });
    return view;
  });
}

export async function getExternalGenerationJob(userId: string, jobId: string): Promise<GenerationJobView> {
  const job = await prisma.generationJob.findFirst({ where: { id: jobId, userId } });
  if (!job) throw new ExternalApiError(404, "NOT_FOUND", "생성 작업을 찾을 수 없습니다.");
  return toJobView(job);
}

async function claimNextJob(workerId: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const now = new Date();
    const candidate = await prisma.generationJob.findFirst({
      where: {
        attemptCount: { lt: 3 },
        OR: [
          { status: "QUEUED" },
          { status: "RUNNING", leaseExpiresAt: { lte: now } },
        ],
      },
      orderBy: { createdAt: "asc" },
    });
    if (!candidate) return null;

    const leaseExpiresAt = new Date(now.getTime() + JOB_LEASE_MS);
    const claimed = await prisma.generationJob.updateMany({
      where: {
        id: candidate.id,
        attemptCount: { lt: 3 },
        OR: [
          { status: "QUEUED" },
          { status: "RUNNING", leaseExpiresAt: { lte: now } },
        ],
      },
      data: {
        status: "RUNNING",
        leaseOwner: workerId,
        leaseExpiresAt,
        startedAt: candidate.startedAt ?? now,
        attemptCount: { increment: 1 },
        errorCode: null,
        errorMessage: null,
      },
    });
    if (claimed.count === 1) {
      return prisma.generationJob.findUniqueOrThrow({ where: { id: candidate.id } });
    }
  }
  return null;
}

async function reapExhaustedLeases(): Promise<void> {
  const now = new Date();
  const candidates = await prisma.generationJob.findMany({
    where: {
      status: "RUNNING",
      attemptCount: { gte: 3 },
      leaseExpiresAt: { lte: now },
    },
    orderBy: { leaseExpiresAt: "asc" },
    take: 10,
    select: { id: true },
  });

  for (const candidate of candidates) {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "generation_jobs" WHERE "id" = ${candidate.id} FOR UPDATE`;
      const job = await tx.generationJob.findUnique({ where: { id: candidate.id } });
      if (
        !job ||
        job.status !== "RUNNING" ||
        job.attemptCount < 3 ||
        !job.leaseExpiresAt ||
        job.leaseExpiresAt > now
      ) {
        return;
      }
      if (job.creditReserved) {
        await tx.$executeRaw`UPDATE "users" SET "creditsUsed" = GREATEST("creditsUsed" - 1, 0) WHERE "id" = ${job.userId}`;
      }
      await tx.generationJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errorCode: "GENERATION_RETRIES_EXHAUSTED",
          errorMessage: "AI 생성 작업의 최대 재시도 횟수를 초과했습니다.",
          creditReserved: false,
          completedAt: now,
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });
    });
  }
}

async function failClaimedJob(
  jobId: string,
  workerId: string,
  code: string,
  message: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "generation_jobs" WHERE "id" = ${jobId} FOR UPDATE`;
    const job = await tx.generationJob.findUnique({ where: { id: jobId } });
    if (!job || job.status !== "RUNNING" || job.leaseOwner !== workerId) return;
    if (job.creditReserved) {
      await tx.$executeRaw`UPDATE "users" SET "creditsUsed" = GREATEST("creditsUsed" - 1, 0) WHERE "id" = ${job.userId}`;
    }
    await tx.generationJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorCode: code,
        errorMessage: message,
        creditReserved: false,
        completedAt: new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });
  });
}

export async function processNextGenerationJob(
  requestedWorkerId?: string,
): Promise<{ processed: false } | { processed: true; jobId: string; status: "succeeded" | "failed" }> {
  await reapExhaustedLeases();
  const workerId = requestedWorkerId ?? randomUUID();
  const job = await claimNextJob(workerId);
  if (!job) return { processed: false };

  try {
    if (!(await isAIConfigured())) {
      throw new ExternalApiError(503, "AI_NOT_CONFIGURED", "AI 기능이 설정되지 않았습니다.");
    }
    const generationInput = generateExternalLongformJobSchema.parse(JSON.parse(job.input));
    const draft = await generateLongformDraft(generationInput);

    const completed = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "generation_jobs" WHERE "id" = ${job.id} FOR UPDATE`;
      const current = await tx.generationJob.findUnique({ where: { id: job.id } });
      if (!current || current.status !== "RUNNING" || current.leaseOwner !== workerId) return false;
      const content = await createGeneratedLongformContent(tx, current.userId, generationInput, draft);
      await tx.generationJob.update({
        where: { id: current.id },
        data: {
          status: "SUCCEEDED",
          contentId: content.id,
          creditReserved: false,
          completedAt: new Date(),
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });
      return true;
    });
    if (!completed) return { processed: true, jobId: job.id, status: "failed" };
    return { processed: true, jobId: job.id, status: "succeeded" };
  } catch (error) {
    const code = error instanceof ExternalApiError ? error.code : "GENERATION_FAILED";
    const message = error instanceof ExternalApiError ? error.message : "AI 글 생성에 실패했습니다.";
    await failClaimedJob(job.id, workerId, code, message);
    return { processed: true, jobId: job.id, status: "failed" };
  }
}
