/**
 * Instagram 발행 전용 API 라우트
 * POST /api/publish/instagram  — 콘텐츠를 Instagram에 발행
 * GET  /api/publish/instagram  — 연동 상태 확인
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  parseInstagramCredentials,
  buildInstagramCaption,
  createMediaContainer,
  createCarouselContainer,
  waitForContainerReady,
  publishContainer,
} from "@/lib/integrations/instagram";

/* ─── 요청 스키마 ─────────────────────────────────────── */
const publishSchema = z.object({
  contentId: z.string(),
  /** 단일 이미지 URL (BLOG, SNS 타입에서 우선 사용) */
  imageUrl: z.string().url().optional(),
  /** 캐러셀 이미지 URL 배열 (CAROUSEL 타입, 2~10장) */
  imageUrls: z.array(z.string().url()).min(1).max(10).optional(),
  /** 커스텀 캡션 (없으면 자동 생성) */
  caption: z.string().max(2200).optional(),
});

/* ─── 슬라이드 JSON에서 이미지 URL 배열 추출 ──────────── */
function extractSlideImageUrls(slides: string | null): string[] {
  if (!slides) return [];
  try {
    const parsed = JSON.parse(slides) as { imageUrl?: string }[];
    return parsed.map(s => s.imageUrl).filter((url): url is string => !!url);
  } catch {
    return [];
  }
}

function getAppBaseUrl(req: Request): string {
  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim();
  if (nextAuthUrl) return nextAuthUrl.replace(/\/+$/, "");

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    const host = vercelUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    return `https://${host}`;
  }

  return new URL(req.url).origin;
}

function toAbsoluteUrl(url: string, req: Request): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${getAppBaseUrl(req)}${url}`;
  return url;
}

function getInstagramImageUrl(
  req: Request,
  contentId: string,
  image?: { id: string; url: string } | null
): string | null {
  if (!image) return null;

  if (image.url.startsWith("data:")) {
    return `${getAppBaseUrl(req)}/api/content/${contentId}/images/${image.id}/serve`;
  }

  return toAbsoluteUrl(image.url, req);
}

function normalizeInstagramImageUrl(req: Request, url?: string | null): string | null {
  if (!url || url.startsWith("data:")) return null;
  return toAbsoluteUrl(url, req);
}

/* ─── POST: Instagram 발행 ────────────────────────────── */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { contentId, imageUrl, imageUrls, caption: customCaption } = publishSchema.parse(body);

    /* 1. 콘텐츠 조회 */
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: { images: { orderBy: { order: "asc" } } },
    });

    if (!content || content.userId !== session.user.id) {
      return NextResponse.json({ error: "콘텐츠를 찾을 수 없습니다" }, { status: 404 });
    }

    /* 2. Instagram 연동 계정 조회 */
    const igAccount = await prisma.socialAccount.findFirst({
      where: { userId: session.user.id, platform: "INSTAGRAM" },
    });

    if (!igAccount || !igAccount.isActive) {
      return NextResponse.json(
        { error: "Instagram 연동 계정이 없습니다. SNS 연동 페이지에서 먼저 연동하세요." },
        { status: 400 }
      );
    }

    /* 3. 자격 증명 파싱 */
    const creds = parseInstagramCredentials(igAccount.accessToken, igAccount.accountName);
    if (!creds) {
      return NextResponse.json(
        { error: "Instagram 자격 증명이 올바르지 않습니다. 재연동이 필요합니다." },
        { status: 400 }
      );
    }

    /* 4. 캡션 준비 */
    const caption = customCaption ?? buildInstagramCaption(
      content.title,
      content.body ?? null,
      content.tone ?? null
    );

    /* 5. 이미지 URL 결정 */
    // 명시적 인수 > 슬라이드 이미지 > 콘텐츠 이미지 > 썸네일
    const resolvedImageUrls: string[] = (imageUrls
      ?? extractSlideImageUrls(content.slides ?? null))
      .map(url => normalizeInstagramImageUrl(req, url))
      .filter((url): url is string => !!url);

    const singleImageUrl: string | undefined = imageUrl
      ? normalizeInstagramImageUrl(req, imageUrl) ?? undefined
      : normalizeInstagramImageUrl(req, content.thumbnailUrl)
        ?? getInstagramImageUrl(req, content.id, content.images[0])
        ?? undefined;

    /* 6. 미디어 타입 결정 및 컨테이너 생성 */
    let containerResult: { containerId: string } | { error: string };

    if (resolvedImageUrls.length >= 2) {
      // 카드뉴스(캐러셀) 발행
      containerResult = await createCarouselContainer(
        creds.igUserId,
        creds.accessToken,
        resolvedImageUrls,
        caption
      );
    } else if (singleImageUrl) {
      // 단일 이미지 발행
      containerResult = await createMediaContainer(
        creds.igUserId,
        creds.accessToken,
        singleImageUrl,
        caption
      );
    } else {
      return NextResponse.json(
        { error: "Instagram 발행에는 이미지가 필요합니다. 콘텐츠에 이미지를 추가하거나 imageUrl을 지정하세요." },
        { status: 400 }
      );
    }

    if ("error" in containerResult) {
      return NextResponse.json({ error: containerResult.error }, { status: 500 });
    }

    /* 7. 컨테이너 처리 완료 대기 */
    const ready = await waitForContainerReady(
      containerResult.containerId,
      creds.accessToken
    );
    if (!ready) {
      return NextResponse.json(
        { error: "Instagram 미디어 처리가 완료되지 않았습니다. 잠시 후 다시 시도해주세요." },
        { status: 504 }
      );
    }

    /* 8. Step 2: 컨테이너 발행 */
    const publishResult = await publishContainer(
      creds.igUserId,
      creds.accessToken,
      containerResult.containerId
    );

    if ("error" in publishResult) {
      // DB에 실패 기록 저장
      await prisma.publishRecord.create({
        data: {
          contentId,
          socialAccountId: igAccount.id,
          status: "FAILED",
        },
      });
      return NextResponse.json({ error: publishResult.error }, { status: 500 });
    }

    /* 9. 발행 기록 저장 */
    const record = await prisma.publishRecord.create({
      data: {
        contentId,
        socialAccountId: igAccount.id,
        status: "SUCCESS",
        platformPostUrl: publishResult.postUrl,
        publishedAt: new Date(),
      },
    });

    /* 10. 콘텐츠 상태 업데이트 */
    await prisma.content.update({
      where: { id: contentId },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      platform: "INSTAGRAM",
      postId: publishResult.postId,
      postUrl: publishResult.postUrl,
      recordId: record.id,
      mediaType: resolvedImageUrls.length >= 2 ? "CAROUSEL" : "IMAGE",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Instagram publish error:", error);
    return NextResponse.json({ error: "서버 내부 오류가 발생했습니다." }, { status: 500 });
  }
}

/* ─── GET: 연동 상태 확인 ────────────────────────────── */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const igAccount = await prisma.socialAccount.findFirst({
    where: { userId: session.user.id, platform: "INSTAGRAM" },
  });

  if (!igAccount) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    accountName: igAccount.accountName,
    isActive: igAccount.isActive,
    connectedAt: igAccount.connectedAt,
  });
}
