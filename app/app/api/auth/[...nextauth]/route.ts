import { handlers } from "@/lib/auth";
import { runWithAuthDiagnostics } from "@/lib/auth-diagnostics";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { result: response, code } = await runWithAuthDiagnostics(() => handlers.GET(request));
  const location = response.headers.get("location");

  if (code && location) {
    const redirectUrl = new URL(location);
    if (redirectUrl.searchParams.get("error") === "Configuration") {
      redirectUrl.searchParams.set("diagnostic", code);
      const headers = new Headers(response.headers);
      headers.set("location", redirectUrl.toString());
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
  }

  return response;
}

export const POST = handlers.POST;
