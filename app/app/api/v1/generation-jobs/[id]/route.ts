import { authenticateExternalRequest, errorResponse, successResponse } from "@/server/services/external-api";
import { getExternalGenerationJob } from "@/server/services/generation-jobs";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const principal = await authenticateExternalRequest(request, "content:generate");
    const { id } = await context.params;
    return successResponse(await getExternalGenerationJob(principal.userId, id));
  } catch (error) {
    return errorResponse(error);
  }
}
