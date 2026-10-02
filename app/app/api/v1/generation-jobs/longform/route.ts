import { ZodError } from "zod";
import {
  firstZodError,
  generateExternalLongformJobSchema,
} from "@/lib/validations/external-content-schema";
import {
  ExternalApiError,
  assertJsonRequestSize,
  authenticateExternalRequest,
  beginIdempotentRequest,
  errorPayload,
  failIdempotentRequest,
  hashJson,
  requireIdempotencyKey,
} from "@/server/services/external-api";
import { queueExternalGenerationJob } from "@/server/services/generation-jobs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let trackedRequestId: string | null = null;
  try {
    const principal = await authenticateExternalRequest(request, "content:generate");
    assertJsonRequestSize(request, 64 * 1024);
    const idempotencyKey = requireIdempotencyKey(request);
    const parsed = generateExternalLongformJobSchema.parse(await request.json());
    const path = "/api/v1/generation-jobs/longform";
    const started = await beginIdempotentRequest({
      principal,
      method: "POST",
      path,
      idempotencyKey,
      requestHash: hashJson(parsed),
    });
    if (started.kind === "replay") {
      return Response.json(started.payload, { status: started.status });
    }
    trackedRequestId = started.requestId;
    const job = await queueExternalGenerationJob({
      principal,
      externalRequestId: started.requestId,
      generationInput: parsed,
    });
    return Response.json({ success: true, data: job }, { status: 202 });
  } catch (error) {
    const normalized = error instanceof ZodError
      ? new ExternalApiError(400, "VALIDATION_ERROR", firstZodError(error))
      : error;
    const { status, payload } = errorPayload(normalized);
    if (trackedRequestId) {
      await failIdempotentRequest(trackedRequestId, status, payload, payload.code).catch(() => undefined);
    }
    return Response.json(payload, {
      status,
      headers: normalized instanceof ExternalApiError ? normalized.headers : undefined,
    });
  }
}
