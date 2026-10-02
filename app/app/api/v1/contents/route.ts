import { ZodError } from "zod";
import { createExternalContentSchema, firstZodError } from "@/lib/validations/external-content-schema";
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
import { createExternalContent } from "@/server/services/external-content-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let trackedRequestId: string | null = null;
  try {
    const principal = await authenticateExternalRequest(request, "content:write");
    assertJsonRequestSize(request);
    const idempotencyKey = requireIdempotencyKey(request);
    const parsed = createExternalContentSchema.parse(await request.json());
    const started = await beginIdempotentRequest({
      principal, method: "POST", path: "/api/v1/contents", idempotencyKey, requestHash: hashJson(parsed),
    });
    if (started.kind === "replay") return Response.json(started.payload, { status: started.status });
    trackedRequestId = started.requestId;

    const content = await createExternalContent({
      userId: principal.userId, externalRequestId: started.requestId, ...parsed,
    });
    const payload = { success: true, data: content };
    return Response.json(payload, { status: 201 });
  } catch (error) {
    const normalized = error instanceof ZodError
      ? new ExternalApiError(400, "VALIDATION_ERROR", firstZodError(error))
      : error;
    const { status, payload } = errorPayload(normalized);
    if (trackedRequestId) await failIdempotentRequest(trackedRequestId, status, payload, payload.code).catch(() => undefined);
    return Response.json(payload, { status });
  }
}
