import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

type VideoProvider = "youtube" | "vimeo";

interface VideoMetadata {
  provider: VideoProvider;
  url: string;
  title: string;
  thumbnailUrl: string;
}

function getYouTubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (url.pathname === "/watch") return url.searchParams.get("v");
    if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/")) {
      return url.pathname.split("/").filter(Boolean)[1] ?? null;
    }
  }

  return null;
}

function getVimeoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;

  const parts = url.pathname.split("/").filter(Boolean);
  const id = [...parts].reverse().find(part => /^\d+$/.test(part));
  return id ?? null;
}

async function fetchOEmbed(endpoint: string): Promise<{ title?: string; thumbnail_url?: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;

    const data = await response.json();
    if (!data || typeof data !== "object") return null;
    return data as { title?: string; thumbnail_url?: string };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeVideoUrl(rawUrl: string): URL | null {
  try {
    const url = new URL(rawUrl.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as { url?: unknown } | null;
  const rawUrl = typeof body?.url === "string" ? body.url : "";
  const url = normalizeVideoUrl(rawUrl);

  if (!url) {
    return NextResponse.json({ error: "유효한 영상 URL을 입력해주세요" }, { status: 400 });
  }

  const youtubeId = getYouTubeId(url);
  if (youtubeId) {
    const normalizedUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
    const oembed = await fetchOEmbed(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(normalizedUrl)}`);
    const metadata: VideoMetadata = {
      provider: "youtube",
      url: normalizedUrl,
      title: oembed?.title || "YouTube 영상",
      thumbnailUrl: oembed?.thumbnail_url || `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
    };

    return NextResponse.json({ metadata });
  }

  const vimeoId = getVimeoId(url);
  if (vimeoId) {
    const normalizedUrl = `https://vimeo.com/${vimeoId}`;
    const oembed = await fetchOEmbed(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(normalizedUrl)}`);

    if (!oembed?.thumbnail_url) {
      return NextResponse.json({ error: "Vimeo 영상 정보를 불러오지 못했습니다" }, { status: 422 });
    }

    const metadata: VideoMetadata = {
      provider: "vimeo",
      url: normalizedUrl,
      title: oembed.title || "Vimeo 영상",
      thumbnailUrl: oembed.thumbnail_url,
    };

    return NextResponse.json({ metadata });
  }

  return NextResponse.json({ error: "YouTube 또는 Vimeo 링크만 지원합니다" }, { status: 400 });
}
