import { ZodError } from "zod";
import { firstZodError, updateExternalContentSchema } from "@/lib/validations/external-content-schema";
import {
  ExternalApiError,
  assertJsonRequestSize,
  authenticateExternalRequest,
  beginIdempotentRequest,
  errorPayload,
  errorResponse,
  failIdempotentRequest,
  hashJson,
  requireIdempotencyKey,
  successResponse,
} from "@/server/services/external-api";
import { getExternalContent, updateExternalContent } from "@/server/services/external-content-service";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const principal = await authenticateExternalRequest(request, "content:read");
    const { id } = await params;
    return successResponse(await getExternalContent(principal.userId, id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let trackedRequestId: string | null = null;
  try {
    const principal = await authenticateExternalRequest(request, "content:write");
    assertJsonRequestSize(request);
    const { id } = await params;
    const idempotencyKey = requireIdempotencyKey(request);
    const parsed = updateExternalContentSchema.parse(await request.json());
    const started = await beginIdempotentRequest({
      principal, method: "PATCH", path: `/api/v1/contents/${id}`,
      idempotencyKey, requestHash: hashJson(parsed),
    });
    if (started.kind === "replay") return Response.json(started.payload, { status: started.status });
    trackedRequestId = started.requestId;
    const content = await updateExternalContent({
      userId: principal.userId, contentId: id, externalRequestId: started.requestId, ...parsed,
    });
    const payload = { success: true, data: content };
    return Response.json(payload);
  } catch (error) {
    const normalized = error instanceof ZodError
      ? new ExternalApiError(400, "VALIDATION_ERROR", firstZodError(error))
      : error;
    const { status, payload } = errorPayload(normalized);
    if (trackedRequestId) await failIdempotentRequest(trackedRequestId, status, payload, payload.code).catch(() => undefined);
    return Response.json(payload, { status });
  }
}
