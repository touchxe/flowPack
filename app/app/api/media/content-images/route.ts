/**
 * GET /api/media/content-images
 * 현재 사용자의 모든 콘텐츠에 첨부된 이미지를 반환
 * - serve URL 형태로 제공 (base64 직접 노출 없음)
 * - MediaLibPicker에서 "내 모든 이미지" 탭으로 사용
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 현재 사용자의 모든 콘텐츠 이미지 조회 (콘텐츠 제목 포함)
  const images = await prisma.contentImage.findMany({
    where: {
      content: { userId: session.user.id },
    },
    include: {
      content: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200, // 최대 200개
  });

  // serve URL 형태로 변환 (base64 노출 방지)
  const result = images.map((img) => ({
    id: img.id,
    contentId: img.content.id,
    contentTitle: img.content.title,
    // serve API URL — 브라우저에서 이미지로 표시 가능
    url: `/api/content/${img.content.id}/images/${img.id}/serve`,
    alt: img.altText || img.content.title,
    name: img.altText || `${img.content.title} 이미지`,
    createdAt: img.createdAt,
  }));

  return NextResponse.json({ images: result, total: result.length });
}
