import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function createShareToken(): string {
  return randomBytes(24).toString("base64url");
}

function getShareUrl(req: Request, contentId: string, shareToken: string): string {
  const origin = new URL(req.url).origin;
  return `${origin}/content/${contentId}/view?token=${shareToken}`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "인증이 필요합니다.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const content = await prisma.content.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      shareEnabled: true,
      shareToken: true,
    },
  });

  if (!content) {
    return NextResponse.json(
      { success: false, error: "콘텐츠를 찾을 수 없습니다.", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  if (content.userId !== session.user.id) {
    return NextResponse.json(
      { success: false, error: "접근 권한이 없습니다.", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  const shareToken = content.shareToken ?? createShareToken();
  const updated = await prisma.content.update({
    where: { id },
    data: {
      shareEnabled: true,
      shareToken,
      shareCreatedAt: content.shareEnabled ? undefined : new Date(),
    },
    select: { shareToken: true },
  });

  if (!updated.shareToken) {
    return NextResponse.json(
      { success: false, error: "공유 링크를 생성하지 못했습니다.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      shareToken: updated.shareToken,
      shareUrl: getShareUrl(req, id, updated.shareToken),
    },
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "인증이 필요합니다.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const content = await prisma.content.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!content) {
    return NextResponse.json(
      { success: false, error: "콘텐츠를 찾을 수 없습니다.", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  if (content.userId !== session.user.id) {
    return NextResponse.json(
      { success: false, error: "접근 권한이 없습니다.", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  await prisma.content.update({
    where: { id },
    data: {
      shareEnabled: false,
      shareToken: null,
      shareCreatedAt: null,
    },
  });

  return NextResponse.json({ success: true, data: { id } });
}
