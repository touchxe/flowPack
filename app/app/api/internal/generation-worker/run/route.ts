import { createHash, timingSafeEqual } from "node:crypto";
import { processNextGenerationJob } from "@/server/services/generation-jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const configured = process.env.FLOWPACK_WORKER_SECRET;
  const provided = request.headers.get("authorization")?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
  if (!configured || configured.length < 32 || !provided) return false;
  return timingSafeEqual(
    createHash("sha256").update(configured).digest(),
    createHash("sha256").update(provided).digest(),
  );
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json(
      { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }
  const workerId = request.headers.get("x-flowpack-worker-id")?.slice(0, 128) || undefined;
  const result = await processNextGenerationJob(workerId);
  if (!result.processed) return new Response(null, { status: 204 });
  return Response.json({ success: true, data: result });
}
