import { authenticateExternalRequest, errorResponse, successResponse } from "@/server/services/external-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const principal = await authenticateExternalRequest(request, null);
    return successResponse({
      apiVersion: "v1",
      scopes: [...principal.scopes].sort(),
      features: {
        asyncLongformGeneration: true,
        renderedContent: true,
        wordpressImport: true,
      },
      limits: {
        imageCountPerContent: 10,
        imageBytes: 20 * 1024 * 1024,
        imageMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
