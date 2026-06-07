/**
 * WordPress 발행 전용 API 라우트
 * POST /api/publish/wordpress  — 콘텐츠를 WordPress에 발행
 * GET  /api/publish/wordpress  — WordPress 연동 계정 정보 / 카테고리 조회
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  parseWordPressCredentials,
  testWordPressConnection,
  publishToWordPress,
  uploadImageToWordPress,
  getWordPressCategories,
} from "@/lib/integrations/wordpress";
import { hydrateEmptyImageGridsInHtml, normalizeSemanticContentHtml, removeImageGridEditorChrome } from "@/lib/content-html";

/* ─── 요청 스키마 ────────────────────────────────────────── */
const publishSchema = z.object({
  contentId: z.string(),
  /** 배포 대상 WordPress socialAccount ID (복수 사이트 지원) */
  socialAccountId: z.string().optional(),
  /** 발행 상태: "publish"(즉시) | "draft"(임시저장) | "private" */
  status: z.enum(["publish", "draft", "private"]).default("publish"),
  /** 카테고리 ID 배열 (WordPress의 카테고리 ID, optional) */
  categories: z.array(z.number()).optional(),
  /** 예약 발행 날짜 ISO 8601 (선택) */
  scheduledAt: z.string().optional(),
  /** 대표 이미지 URL (FlowPack에서 생성된 이미지, optional) */
  featuredImageUrl: z.string().url().optional(),
});

/**
 * ContentImage를 DB 데이터에서 직접 WordPress로 업로드
 * - base64 data URL → 바이너리 변환 후 직접 업로드 (serve URL 우회)
 * - 외부 URL → uploadImageToWordPress로 위임
 */
async function uploadContentImageToWp(
  creds: { siteUrl: string; username: string; appPassword: string },
  imageData: string,
  altText: string
): Promise<{ success: boolean; mediaId?: number; mediaUrl?: string; error?: string }> {
  if (imageData.startsWith("data:")) {
    const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return { success: false, error: "base64 파싱 실패" };

    const mimeType = match[1];
    const buffer = Buffer.from(match[2], "base64");
    const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    const filename = `flowpack-${Date.now()}.${ext}`;

    const cleanPassword = creds.appPassword.replace(/\s+/g, "");
    const authHeader = `Basic ${Buffer.from(`${creds.username}:${cleanPassword}`).toString("base64")}`;
    const apiBase = `${creds.siteUrl.replace(/\/+$/, "")}/wp-json/wp/v2`;

    try {
      const res = await fetch(`${apiBase}/media`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": mimeType,
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
        body: buffer,
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) return { success: false, error: `WP 미디어 업로드 실패 (HTTP ${res.status})` };
      const media = await res.json();
      if (altText) {
        await fetch(`${apiBase}/media/${media.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify({ alt_text: altText }),
        }).catch(() => {});
      }
      return { success: true, mediaId: media.id, mediaUrl: media.source_url };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "업로드 오류" };
    }
  }

  if (imageData.startsWith("http://") || imageData.startsWith("https://")) {
    return uploadImageToWordPress(creds, imageData, altText);
  }

  return { success: false, error: "지원하지 않는 이미지 형식" };
}

/**
 * HTML 내 serve URL (상대/절대 모두) → WordPress 미디어 URL로 교체
 */
function replaceServeUrls(html: string, imageId: string, contentId: string, wpUrl: string): string {
  const pattern = new RegExp(
    `(https?://[^"]*)?/api/content/${contentId}/images/${imageId}/serve`,
    'g'
  );
  return html.replace(pattern, wpUrl);
}

/**
 * HTML 안 첫 번째 <img> 태그에서 src 추출
 */
function extractFirstImageFromHtml(html: string): string | null {
  const match = html.match(/<img[^>]+src="([^"]+)"/);
  return match ? match[1] : null;
}

/* ─── 콘텐츠 → WordPress HTML 변환 ──────────────────────── */
function convertContentToHtml(body: string | null, slides: string | null): string {
  // BLOG 타입: body가 마크다운/HTML인 경우
  if (body) {
    // 이미 HTML이면 그대로, 마크다운이면 기본 변환
    if (body.includes("<") && body.includes(">")) return body;

    // 간단한 마크다운 → HTML 변환
    return body
      .split("\n\n")
      .map(para => {
        if (para.startsWith("## ")) return `<h2>${para.slice(3)}</h2>`;
        if (para.startsWith("# ")) return `<h1>${para.slice(2)}</h1>`;
        if (para.startsWith("### ")) return `<h3>${para.slice(4)}</h3>`;
        if (para.startsWith("- ")) {
          const items = para.split("\n").map(l => `<li>${l.slice(2)}</li>`).join("");
          return `<ul>${items}</ul>`;
        }
        return `<p>${para.replace(/\n/g, "<br />")}</p>`;
      })
      .join("\n");
  }

  // CAROUSEL(카드뉴스) 타입: slides JSON을 HTML로 변환
  if (slides) {
    try {
      const parsed = JSON.parse(slides) as { title?: string; content?: string; imageUrl?: string }[];
      return parsed
        .map(
          (slide, idx) => `
<div class="flowpack-slide" style="margin-bottom:32px;padding:24px;border:1px solid #E5E7EB;border-radius:12px;">
  <h3 style="margin:0 0 12px;font-size:18px;">${slide.title ?? `슬라이드 ${idx + 1}`}</h3>
  ${slide.imageUrl ? `<img src="${slide.imageUrl}" alt="${slide.title ?? ""}" style="max-width:100%;border-radius:8px;margin-bottom:12px;" />` : ""}
  <p style="margin:0;line-height:1.7;">${slide.content ?? ""}</p>
</div>`.trim()
        )
        .join("\n");
    } catch {
      return "<p>콘텐츠를 변환할 수 없습니다.</p>";
    }
  }

  return "<p>내용이 없습니다.</p>";
}

/* ─── WordPress 태그 생성/조회 ─────────────────────────── */
async function getOrCreateWpTags(
  creds: { siteUrl: string; username: string; appPassword: string },
  tagNames: string[]
): Promise<number[]> {
  const cleanPassword = creds.appPassword.replace(/\s+/g, "");
  const authHeader = `Basic ${Buffer.from(`${creds.username}:${cleanPassword}`).toString("base64")}`;
  const apiBase = `${creds.siteUrl.replace(/\/+$/, "")}/wp-json/wp/v2`;

  const tagIds: number[] = [];

  for (const name of tagNames.slice(0, 10)) {
    try {
      const searchRes = await fetch(
        `${apiBase}/tags?search=${encodeURIComponent(name)}&per_page=5`,
        { headers: { Authorization: authHeader }, signal: AbortSignal.timeout(5000) }
      );
      if (searchRes.ok) {
        const existing = await searchRes.json();
        const exact = existing.find((t: { name: string }) =>
          t.name.toLowerCase() === name.toLowerCase()
        );
        if (exact) { tagIds.push(exact.id); continue; }
      }

      const createRes = await fetch(`${apiBase}/tags`, {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
        signal: AbortSignal.timeout(5000),
      });
      if (createRes.ok) {
        const created = await createRes.json();
        tagIds.push(created.id);
      }
    } catch {
      console.log(`[WP-PUBLISH] 태그 생성 실패: ${name}`);
    }
  }

  return tagIds;
}

/* ─── POST: WordPress에 발행 ────────────────────────────── */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { contentId, socialAccountId, status, categories, scheduledAt, featuredImageUrl } =
      publishSchema.parse(body);

    /* 1. 콘텐츠 조회 — 모든 이미지를 가져옴 */
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: { images: { orderBy: { order: "asc" } } },
    });

    if (!content || content.userId !== session.user.id) {
      return NextResponse.json({ error: "콘텐츠를 찾을 수 없습니다" }, { status: 404 });
    }

    /* 2. WordPress 연동 계정 조회 (socialAccountId 지정 시 특정 사이트, 미지정 시 첫 번째 활성 계정) */
    const wpAccount = socialAccountId
      ? await prisma.socialAccount.findFirst({
          where: { id: socialAccountId, userId: session.user.id, platform: "WORDPRESS", isActive: true },
        })
      : await prisma.socialAccount.findFirst({
          where: { userId: session.user.id, platform: "WORDPRESS", isActive: true },
        });

    if (!wpAccount) {
      return NextResponse.json(
        { error: "WordPress 연동 계정이 없습니다. SNS 연동 페이지에서 먼저 연동하세요." },
        { status: 400 }
      );
    }

    /* 3. 자격 증명 파싱 */
    const creds = parseWordPressCredentials(wpAccount.accessToken, wpAccount.accountName);
    if (!creds) {
      return NextResponse.json(
        { error: "WordPress 자격 증명이 올바르지 않습니다. 재연동이 필요합니다." },
        { status: 400 }
      );
    }

    /* 4. 콘텐츠 HTML (Tiptap은 HTML로 저장, 보통 body가 이미 HTML) */
    let htmlContent = removeImageGridEditorChrome(convertContentToHtml(content.body ?? null, content.slides ?? null));
    htmlContent = hydrateEmptyImageGridsInHtml(htmlContent, content.images, (image) => (
      image.url.startsWith("data:")
        ? `/api/content/${contentId}/images/${image.id}/serve`
        : image.url
    ));
    htmlContent = normalizeSemanticContentHtml(htmlContent);

    /* 5. 모든 이미지를 WP에 업로드하고 serve URL → WP URL 교체 */
    let featuredMediaId: number | undefined;
    const contentImages = content.images || [];

    if (contentImages.length > 0) {
      console.log(`[WP-PUBLISH] ${contentImages.length}개 이미지 업로드 시작...`);

      for (let i = 0; i < contentImages.length; i++) {
        const img = contentImages[i];
        const altText = img.altText || content.title;
        console.log(`[WP-PUBLISH]   이미지 ${i + 1}/${contentImages.length}: ${img.id} (${img.url.slice(0, 30)}...)`);

        const imgResult = await uploadContentImageToWp(creds, img.url, altText);

        if (imgResult.success && imgResult.mediaId) {
          // 첫 번째 성공한 이미지를 대표 이미지로 설정
          if (!featuredMediaId) {
            featuredMediaId = imgResult.mediaId;
            console.log(`[WP-PUBLISH]   ✓ 대표 이미지 설정: mediaId=${featuredMediaId}`);
          }

          // HTML 내 이 이미지의 모든 serve URL → WP 미디어 URL로 교체
          if (imgResult.mediaUrl) {
            htmlContent = replaceServeUrls(htmlContent, img.id, contentId, imgResult.mediaUrl);
            console.log(`[WP-PUBLISH]   ✓ serve URL 교체 완료 → ${imgResult.mediaUrl}`);
          }
        } else {
          console.log(`[WP-PUBLISH]   ⚠ 업로드 실패: ${imgResult.error}`);
        }
      }
    } else if (featuredImageUrl) {
      // 외부에서 제공된 URL이 있으면 그것을 업로드
      const imgResult = await uploadImageToWordPress(creds, featuredImageUrl, content.title);
      if (imgResult.success && imgResult.mediaId) {
        featuredMediaId = imgResult.mediaId;
        if (imgResult.mediaUrl) {
          htmlContent = htmlContent.replace(
            new RegExp(featuredImageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            imgResult.mediaUrl
          );
        }
      }
    } else {
      // DB 이미지도 없으면 HTML에서 첫 외부 이미지 추출 시도
      const firstSrc = extractFirstImageFromHtml(htmlContent);
      if (firstSrc && (firstSrc.startsWith("http://") || firstSrc.startsWith("https://"))) {
        const imgResult = await uploadImageToWordPress(creds, firstSrc, content.title);
        if (imgResult.success && imgResult.mediaId) {
          featuredMediaId = imgResult.mediaId;
          if (imgResult.mediaUrl) {
            htmlContent = htmlContent.replace(
              new RegExp(firstSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
              imgResult.mediaUrl
            );
          }
        }
      }
    }

    /* 5-2. 혹시 남은 /api/content/.../serve 패턴 전부 제거 (안전장치) */
    htmlContent = htmlContent.replace(
      /src="(\/api\/content\/[^"]+\/serve)"/g,
      'src=""'
    );

    /* 5-3. 태그 생성 — keywords 메타데이터 우선, 없으면 <strong> 보조 추출 */
    let tagNames: string[] = [];

    if (content.keywords) {
      try {
        const parsed = JSON.parse(content.keywords);
        if (Array.isArray(parsed)) {
          tagNames = parsed
            .map((k: string) => k.trim())
            .filter((k: string) => k.length >= 2 && k.length <= 30);
        }
      } catch { /* JSON 파싱 실패 시 무시 */ }
    }

    if (tagNames.length === 0) {
      const strongMatches = htmlContent.match(/<strong>([^<]+)<\/strong>/g) || [];
      tagNames = [...new Set(
        strongMatches
          .map(m => m.replace(/<\/?strong>/g, "").trim())
          .filter(t => t.length >= 2 && t.length <= 15 && !/\s{2,}/.test(t))
      )];
    }

    let tagIds: number[] = [];
    if (tagNames.length > 0) {
      console.log("[WP-PUBLISH] 태그 생성:", tagNames);
      tagIds = await getOrCreateWpTags(creds, tagNames);
      console.log("[WP-PUBLISH] 태그 IDs:", tagIds);
    }

    /* 6. WordPress 포스트 발행 */
    const publishResult = await publishToWordPress(creds, {
      title: content.title,
      content: htmlContent,
      status: scheduledAt ? "future" as "publish" : status,
      categories,
      tags: tagIds.length > 0 ? tagIds : undefined,
      featuredMediaId,
      date: scheduledAt,
    });

    if (!publishResult.success || !publishResult.post) {
      return NextResponse.json(
        { error: publishResult.error ?? "WordPress 발행 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    /* 7. 발행 기록 저장 */
    const record = await prisma.publishRecord.create({
      data: {
        contentId,
        socialAccountId: wpAccount.id,
        status: "SUCCESS",
        platformPostUrl: publishResult.post.link,
        publishedAt: scheduledAt ? new Date(scheduledAt) : new Date(),
      },
    });

    /* 8. 콘텐츠 상태 업데이트 */
    await prisma.content.update({
      where: { id: contentId },
      data: {
        status: scheduledAt ? "SCHEDULED" : "PUBLISHED",
        publishedAt: scheduledAt ? undefined : new Date(),
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      platform: "WORDPRESS",
      postId: publishResult.post.id,
      postUrl: publishResult.post.link,
      status: publishResult.post.status,
      recordId: record.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("WordPress publish error:", error);
    return NextResponse.json({ error: "서버 내부 오류가 발생했습니다." }, { status: 500 });
  }
}

/* ─── GET: WordPress 연동 정보 / 카테고리 조회 ──────────── */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action"); // "test" | "categories"
  const socialAccountId = searchParams.get("socialAccountId"); // 특정 WP 사이트 지정

  /* WordPress 연동 계정 조회 (socialAccountId 지정 시 특정 사이트) */
  const wpAccount = socialAccountId
    ? await prisma.socialAccount.findFirst({
        where: { id: socialAccountId, userId: session.user.id, platform: "WORDPRESS" },
      })
    : await prisma.socialAccount.findFirst({
        where: { userId: session.user.id, platform: "WORDPRESS" },
      });

  if (!wpAccount) {
    return NextResponse.json({ connected: false });
  }

  const creds = parseWordPressCredentials(wpAccount.accessToken, wpAccount.accountName);
  if (!creds) {
    return NextResponse.json({ connected: true, error: "자격 증명 파싱 오류" });
  }

  /* 연동 테스트 */
  if (action === "test") {
    const result = await testWordPressConnection(creds);
    return NextResponse.json({ connected: true, test: result });
  }

  /* 카테고리 목록 */
  if (action === "categories") {
    const result = await getWordPressCategories(creds);
    return NextResponse.json({ connected: true, ...result });
  }

  return NextResponse.json({
    connected: true,
    accountName: wpAccount.accountName,
    connectedAt: wpAccount.connectedAt,
  });
}
