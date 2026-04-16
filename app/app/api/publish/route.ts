import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  parseWordPressCredentials,
  publishToWordPress,
} from "@/lib/integrations/wordpress";

const publishSchema = z.object({
  contentId: z.string(),
  socialAccountIds: z.array(z.string()).min(1),
  scheduledAt: z.string().optional(),
});

/**
 * 마크다운 → WordPress HTML 변환
 */
function mdToHtml(body: string): string {
  if (!body) return "<p>내용이 없습니다.</p>";
  if (body.includes("<") && body.includes(">")) return body; // 이미 HTML

  return body
    .split("\n\n")
    .map(para => {
      const trimmed = para.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("### ")) return `<h3>${trimmed.slice(4)}</h3>`;
      if (trimmed.startsWith("## ")) return `<h2>${trimmed.slice(3)}</h2>`;
      if (trimmed.startsWith("# ")) return `<h1>${trimmed.slice(2)}</h1>`;
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const items = trimmed.split("\n").map(l => `<li>${l.replace(/^[-*]\s*/, "")}</li>`).join("");
        return `<ul>${items}</ul>`;
      }
      if (trimmed.startsWith("> ")) {
        return `<blockquote><p>${trimmed.slice(2).replace(/\n>\s*/g, "<br />")}</p></blockquote>`;
      }
      // 인라인 마크다운 처리
      let html = trimmed
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/_(.+?)_/g, "<em>$1</em>")
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:8px;" />')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        .replace(/\n/g, "<br />");
      return `<p>${html}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { contentId, socialAccountIds, scheduledAt } = publishSchema.parse(body);

    // 콘텐츠 조회
    const content = await prisma.content.findUnique({
      where: { id: contentId },
    });

    if (!content || content.userId !== session.user.id) {
      return NextResponse.json(
        { error: "콘텐츠를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 소셜 계정 조회
    const accounts = await prisma.socialAccount.findMany({
      where: {
        id: { in: socialAccountIds },
        userId: session.user.id,
        isActive: true,
      },
    });

    if (accounts.length === 0) {
      return NextResponse.json(
        { error: "유효한 연동 계정이 없습니다" },
        { status: 400 }
      );
    }

    const isScheduled = !!scheduledAt;
    const scheduledDate = isScheduled ? new Date(scheduledAt) : null;
    const results = [];

    for (const account of accounts) {
      /* ── WordPress: 실제 API 호출 ─────────────────── */
      if (account.platform === "WORDPRESS") {
        console.log("[WP-DEBUG] ▶ WordPress 발행 시작");
        console.log("[WP-DEBUG]   contentId:", contentId);
        console.log("[WP-DEBUG]   accountName:", account.accountName);
        console.log("[WP-DEBUG]   accessToken (앞 50자):", account.accessToken.slice(0, 50) + "...");

        const creds = parseWordPressCredentials(account.accessToken, account.accountName);
        if (!creds) {
          console.error("[WP-DEBUG] ✗ 자격 증명 파싱 실패! accessToken:", account.accessToken);
          const record = await prisma.publishRecord.create({
            data: {
              contentId, socialAccountId: account.id,
              status: "FAILED", errorMessage: "WordPress 자격 증명 파싱 실패",
            },
          });
          results.push({
            socialAccountId: account.id, platform: account.platform,
            accountName: account.accountName, status: "FAILED",
            errorMessage: "자격 증명 파싱 실패. 재연동이 필요합니다.",
          });
          continue;
        }

        console.log("[WP-DEBUG]   siteUrl:", creds.siteUrl);
        console.log("[WP-DEBUG]   username:", creds.username);
        console.log("[WP-DEBUG]   appPassword (앞 8자):", creds.appPassword.slice(0, 8) + "...");

        // 콘텐츠 HTML 변환
        const htmlContent = mdToHtml(content.body ?? "");
        console.log("[WP-DEBUG]   HTML 변환 길이:", htmlContent.length, "자");
        console.log("[WP-DEBUG]   HTML 앞 200자:", htmlContent.slice(0, 200));

        const wpStatus = isScheduled ? "future" as "publish" : "publish";
        console.log("[WP-DEBUG]   발행 상태:", wpStatus);
        console.log("[WP-DEBUG]   예약 일시:", scheduledAt ?? "없음 (즉시 발행)");

        const wpResult = await publishToWordPress(creds, {
          title: content.title,
          content: htmlContent,
          status: wpStatus,
          date: scheduledAt,
        });

        console.log("[WP-DEBUG]   publishToWordPress 결과:", JSON.stringify(wpResult, null, 2));

        if (wpResult.success && wpResult.post) {
          console.log("[WP-DEBUG] ✓ 발행 성공! postId:", wpResult.post.id, "link:", wpResult.post.link);
          const record = await prisma.publishRecord.create({
            data: {
              contentId, socialAccountId: account.id,
              status: "SUCCESS",
              platformPostUrl: wpResult.post.link,
              publishedAt: isScheduled ? undefined : new Date(),
            },
          });
          results.push({
            socialAccountId: account.id, platform: account.platform,
            accountName: account.accountName, status: "SUCCESS",
            platformPostUrl: wpResult.post.link,
          });
        } else {
          console.error("[WP-DEBUG] ✗ 발행 실패!", wpResult.error);
          const record = await prisma.publishRecord.create({
            data: {
              contentId, socialAccountId: account.id,
              status: "FAILED",
              errorMessage: wpResult.error ?? "알 수 없는 오류",
            },
          });
          results.push({
            socialAccountId: account.id, platform: account.platform,
            accountName: account.accountName, status: "FAILED",
            errorMessage: wpResult.error,
          });
        }
        continue;
      }

      /* ── 기타 플랫폼: Mock (TODO: 실제 구현 예정) ── */
      const record = await prisma.publishRecord.create({
        data: {
          contentId,
          socialAccountId: account.id,
          status: isScheduled ? "PENDING" : "SUCCESS",
          platformPostUrl: isScheduled ? undefined : `https://mock.example.com/post/${Date.now()}`,
          publishedAt: isScheduled ? undefined : new Date(),
        },
      });

      results.push({
        socialAccountId: account.id,
        platform: account.platform,
        accountName: account.accountName,
        status: isScheduled ? "PENDING" : "SUCCESS",
        platformPostUrl: record.platformPostUrl,
        ...(isScheduled && { scheduledAt: scheduledDate }),
      });
    }

    // 콘텐츠 상태 업데이트
    const anySuccess = results.some(r => r.status === "SUCCESS");
    if (anySuccess && !isScheduled) {
      await prisma.content.update({
        where: { id: contentId },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      });
    } else if (isScheduled) {
      await prisma.content.update({
        where: { id: contentId },
        data: { status: "SCHEDULED", scheduledAt: scheduledDate },
      });
    }

    return NextResponse.json({ success: true, results, isScheduled, scheduledAt: scheduledDate });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[WP-DEBUG] Publish error:", error);
    return NextResponse.json({ error: "배포 중 오류가 발생했습니다" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const contentId = searchParams.get("contentId");

  if (!contentId) {
    return NextResponse.json(
      { error: "contentId가 필요합니다" },
      { status: 400 }
    );
  }

  const records = await prisma.publishRecord.findMany({
    where: {
      contentId,
      content: { userId: session.user.id },
    },
    include: {
      socialAccount: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ records });
}
