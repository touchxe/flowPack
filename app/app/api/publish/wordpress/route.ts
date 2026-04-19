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

/* ─── 요청 스키마 ────────────────────────────────────────── */
const publishSchema = z.object({
  contentId: z.string(),
  /** 발행 상태: "publish"(즉시) | "draft"(임시저장) | "private" */
  status: z.enum(["publish", "draft", "private"]).default("publish"),
  /** 카테고리 ID 배열 (WordPress의 카테고리 ID, optional) */
  categories: z.array(z.number()).optional(),
  /** 예약 발행 날짜 ISO 8601 (선택) */
  scheduledAt: z.string().optional(),
  /** 대표 이미지 URL (FlowPack에서 생성된 이미지, optional) */
  featuredImageUrl: z.string().url().optional(),
});

/* ─── APP URL (이미지 절대 경로용) ──────────────────────────── */
const APP_URL = process.env.NEXTAUTH_URL
  || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://flow-pack.vercel.app";

/**
 * HTML 본문 내 모든 이미지 src를 절대 URL로 변환
 * /api/... 상대 경로 → https://... 절대 경로
 */
function makeImageSrcsAbsolute(html: string): string {
  return html.replace(
    /src="(\/?api\/[^"]+)"/g,
    (_, path) => `src="${APP_URL}${path.startsWith('/') ? '' : '/'}${path}"`
  );
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

/* ─── POST: WordPress에 발행 ────────────────────────────── */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { contentId, status, categories, scheduledAt, featuredImageUrl } =
      publishSchema.parse(body);

    /* 1. 콘텐츠 조회 */
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: { images: { orderBy: { order: "asc" }, take: 1 } },
    });

    if (!content || content.userId !== session.user.id) {
      return NextResponse.json({ error: "콘텐츠를 찾을 수 없습니다" }, { status: 404 });
    }

    /* 2. WordPress 연동 계정 조회 */
    const wpAccount = await prisma.socialAccount.findUnique({
      where: {
        userId_platform: {
          userId: session.user.id,
          platform: "WORDPRESS",
        },
      },
    });

    if (!wpAccount || !wpAccount.isActive) {
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

    /* 4. 콘텐츠 HTML 변환 + 이미지 절대 URL 처리 */
    let htmlContent = convertContentToHtml(content.body ?? null, content.slides ?? null);
    // HTML 안 /api/... 상대 경로를 절대 URL로 변환
    htmlContent = makeImageSrcsAbsolute(htmlContent);

    /* 5. 대표 이미지 업로드 (선택) */
    let featuredMediaId: number | undefined;
    // ContentImage DB에서 첫 번째 이미지 우선, 없으면 HTML에서 추출
    const firstImageUrl = featuredImageUrl
      ?? (content.images[0]
        ? `${APP_URL}/api/content/${contentId}/images/${content.images[0].id}/serve`
        : null)
      ?? extractFirstImageFromHtml(htmlContent);

    if (firstImageUrl) {
      const imgResult = await uploadImageToWordPress(creds, firstImageUrl, content.title);
      if (imgResult.success && imgResult.mediaId) {
        featuredMediaId = imgResult.mediaId;
        // 본문 내 동일 이미지를 WordPress 미디어 URL로 교체
        if (imgResult.mediaUrl) {
          htmlContent = htmlContent.replace(
            new RegExp(firstImageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            imgResult.mediaUrl
          );
        }
      }
      // 이미지 업로드 실패해도 포스트 발행은 계속 진행
    }

    /* 6. WordPress 포스트 발행 */
    const publishResult = await publishToWordPress(creds, {
      title: content.title,
      content: htmlContent,
      status: scheduledAt ? "future" as "publish" : status,
      categories,
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

  /* WordPress 연동 계정 조회 */
  const wpAccount = await prisma.socialAccount.findUnique({
    where: {
      userId_platform: {
        userId: session.user.id,
        platform: "WORDPRESS",
      },
    },
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
