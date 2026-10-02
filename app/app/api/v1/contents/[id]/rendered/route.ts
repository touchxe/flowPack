import { renderExternalContentHtml } from "@/lib/external-rendered-content";
import { authenticateExternalRequest, errorResponse, successResponse } from "@/server/services/external-api";
import { getExternalContent } from "@/server/services/external-content-service";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const principal = await authenticateExternalRequest(request, "content:read");
    const { id } = await context.params;
    const content = await getExternalContent(principal.userId, id);
    return successResponse({
      id: content.id,
      title: content.title,
      html: renderExternalContentHtml(content.body, content.bodyFormat),
      revision: content.revision,
      images: content.images,
      coverMediaId: content.coverMediaId,
      updatedAt: content.updatedAt,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
