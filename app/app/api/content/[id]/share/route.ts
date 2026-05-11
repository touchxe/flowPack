import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ensureContentShareSchema } from "@/lib/content-share-schema";
import { prisma } from "@/lib/prisma";

function createShareToken(): string {
  return randomBytes(24).toString("base64url");
}

function getShareUrl(req: Request, shareToken: string): string {
  const origin = new URL(req.url).origin;
  return `${origin}/share/content/${shareToken}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const debug = new URL(req.url).searchParams.get("debug") === "1";

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    await ensureContentShareSchema();

    const { id } = await params;
    const content = await prisma.content.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        shareEnabled: true,
        shareToken: true,
        shareCreatedAt: true,
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
        shareCreatedAt: content.shareCreatedAt ?? new Date(),
      },
      select: { shareToken: true },
    });

    if (!updated.shareToken) {
      return NextResponse.json(
        { success: false, error: "공유 링크를 생성하지 못했습니다.", code: "INTERNAL_ERROR" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          shareToken: updated.shareToken,
          shareUrl: getShareUrl(req, updated.shareToken),
        },
      }
    );
  } catch (error) {
    console.error("Create content share link error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "공유 링크를 만들지 못했습니다.",
        code: "INTERNAL_ERROR",
        ...(debug && { debug: { reason: "SHARE_LINK_CREATE_FAILED", message: getErrorMessage(error) } }),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const debug = new URL(req.url).searchParams.get("debug") === "1";

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    await ensureContentShareSchema();

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
      },
    });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("Disable content share link error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "공유 링크를 해제하지 못했습니다.",
        code: "INTERNAL_ERROR",
        ...(debug && { debug: { reason: "SHARE_LINK_DISABLE_FAILED", message: getErrorMessage(error) } }),
      },
      { status: 500 }
    );
  }
}
