import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { marked } from "marked";
import {
  parseWordPressCredentials,
  publishToWordPress,
  uploadImageToWordPress,
} from "@/lib/integrations/wordpress";

const publishSchema = z.object({
  contentId: z.string(),
  socialAccountIds: z.array(z.string()).min(1),
  scheduledAt: z.string().optional(),
});

/* ─── FlowPack 배포 URL (이미지 절대 경로 생성용) ───────── */
const APP_URL = process.env.NEXTAUTH_URL
  || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://flow-pack.vercel.app";

/**
 * 마크다운 본문에서 이미지 URL 추출
 */
function extractImageUrls(markdown: string): string[] {
  const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const urls: string[] = [];
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    urls.push(match[2]);
  }
  return urls;
}

/**
 * 상대 URL → 절대 URL 변환
 */
function toAbsoluteUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${APP_URL}${url}`;
  return url;
}

/**
 * 마크다운 → WordPress HTML 변환 (marked 라이브러리 사용)
 * 이미지 URL은 절대 경로로 변환
 */
function convertMarkdownToHtml(body: string): string {
  if (!body?.trim()) return "<p>내용이 없습니다.</p>";

  // 이미지 URL을 절대 경로로 변환
  let processed = body.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_, alt, url) => `![${alt}](${toAbsoluteUrl(url)})`
  );

  // marked로 마크다운 → HTML 변환
  const html = marked.parse(processed, { async: false }) as string;
  return html;
}

/**
 * 마크다운에서 적절한 제목 추출 (H1 제거, 요약)
 */
function extractTitle(body: string, originalTitle: string): string {
  // 원본 제목이 60자 이하면 그대로 사용
  if (originalTitle.length <= 60) return originalTitle;

  // H1 태그에서 제목 추출 시도
  const h1Match = body.match(/^#\s+(.+)$/m);
  if (h1Match && h1Match[1].length <= 60) return h1Match[1].trim();

  // 길면 60자로 자르기
  return originalTitle.slice(0, 57) + "...";
}

/**
 * WordPress 태그 생성/조회 후 ID 반환
 */
async function getOrCreateTags(
  creds: { siteUrl: string; username: string; appPassword: string },
  tagNames: string[]
): Promise<number[]> {
  const cleanPassword = creds.appPassword.replace(/\s+/g, "");
  const authHeader = `Basic ${Buffer.from(`${creds.username}:${cleanPassword}`).toString("base64")}`;
  const apiBase = `${creds.siteUrl.replace(/\/+$/, "")}/wp-json/wp/v2`;

  const tagIds: number[] = [];

  for (const name of tagNames.slice(0, 10)) {
    try {
      // 기존 태그 검색
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

      // 태그 생성
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
      console.log(`[WP-DEBUG] 태그 생성 실패: ${name}`);
    }
  }

  return tagIds;
}

/* ─── POST: 배포 ─────────────────────────────────────── */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { contentId, socialAccountIds, scheduledAt } = publishSchema.parse(body);

    // 콘텐츠 + 이미지 조회
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: { images: { orderBy: { order: "asc" } } },
    });

    if (!content || content.userId !== session.user.id) {
      return NextResponse.json({ error: "콘텐츠를 찾을 수 없습니다" }, { status: 404 });
    }

    // 소셜 계정 조회
    const accounts = await prisma.socialAccount.findMany({
      where: { id: { in: socialAccountIds }, userId: session.user.id, isActive: true },
    });

    if (accounts.length === 0) {
      return NextResponse.json({ error: "유효한 연동 계정이 없습니다" }, { status: 400 });
    }

    const isScheduled = !!scheduledAt;
    const scheduledDate = isScheduled ? new Date(scheduledAt) : null;
    const results = [];

    for (const account of accounts) {
      /* ── WordPress: 실제 API 호출 ──────────────────── */
      if (account.platform === "WORDPRESS") {
        console.log("[WP-DEBUG] ▶ WordPress 발행 시작");

        const creds = parseWordPressCredentials(account.accessToken, account.accountName);
        if (!creds) {
          console.error("[WP-DEBUG] ✗ 자격 증명 파싱 실패!");
          await prisma.publishRecord.create({
            data: { contentId, socialAccountId: account.id, status: "FAILED", errorMessage: "자격 증명 파싱 실패" },
          });
          results.push({ socialAccountId: account.id, platform: "WORDPRESS", accountName: account.accountName, status: "FAILED", errorMessage: "자격 증명 파싱 실패" });
          continue;
        }

        console.log("[WP-DEBUG]   siteUrl:", creds.siteUrl);

        // 1) 제목 최적화 (60자 이하)
        const wpTitle = extractTitle(content.body ?? "", content.title);
        console.log("[WP-DEBUG]   제목:", wpTitle);

        // 2) 마크다운 → HTML 변환 (marked 라이브러리)
        let htmlContent = convertMarkdownToHtml(content.body ?? "");
        console.log("[WP-DEBUG]   HTML 변환 길이:", htmlContent.length, "자");

        // 3) 첫 번째 이미지 → WordPress 대표 이미지(섬네일) 업로드
        let featuredMediaId: number | undefined;
        const contentImages = content.images || [];
        const bodyImageUrls = extractImageUrls(content.body ?? "");
        const firstImageUrl = contentImages[0]?.url || bodyImageUrls[0];

        if (firstImageUrl) {
          console.log("[WP-DEBUG]   대표 이미지 업로드 시도...");
          const absUrl = toAbsoluteUrl(
            firstImageUrl.startsWith("data:")
              ? `/api/content/${contentId}/images/${contentImages[0]?.id}/serve`
              : firstImageUrl
          );
          console.log("[WP-DEBUG]   이미지 URL:", absUrl.slice(0, 100));

          const imgResult = await uploadImageToWordPress(creds, absUrl, wpTitle);
          if (imgResult.success && imgResult.mediaId) {
            featuredMediaId = imgResult.mediaId;
            console.log("[WP-DEBUG]   ✓ 대표 이미지 업로드 성공! mediaId:", featuredMediaId);

            // 본문 내 이미지 URL도 WordPress 미디어 URL로 교체
            if (imgResult.mediaUrl && firstImageUrl) {
              const absFirstUrl = toAbsoluteUrl(firstImageUrl.startsWith("data:")
                ? `/api/content/${contentId}/images/${contentImages[0]?.id}/serve`
                : firstImageUrl);
              htmlContent = htmlContent.replace(
                new RegExp(absFirstUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
                imgResult.mediaUrl
              );
            }
          } else {
            console.log("[WP-DEBUG]   ⚠ 대표 이미지 업로드 실패:", imgResult.error);
          }
        }

        // 4) 태그 생성 (마크다운에서 ** ** 사이의 키워드 추출)
        const boldMatches = (content.body ?? "").match(/\*\*([^*]+)\*\*/g) || [];
        const tagNames = [...new Set(
          boldMatches.map(m => m.replace(/\*\*/g, "").trim()).filter(t => t.length <= 20 && t.length >= 2)
        )];
        let tagIds: number[] = [];
        if (tagNames.length > 0) {
          console.log("[WP-DEBUG]   태그 생성:", tagNames);
          tagIds = await getOrCreateTags(creds, tagNames);
          console.log("[WP-DEBUG]   태그 IDs:", tagIds);
        }

        // 5) WordPress 포스트 발행
        const wpResult = await publishToWordPress(creds, {
          title: wpTitle,
          content: htmlContent,
          status: isScheduled ? "future" as "publish" : "publish",
          featuredMediaId,
          tags: tagIds.length > 0 ? tagIds : undefined,
          date: scheduledAt,
        });

        console.log("[WP-DEBUG]   결과:", JSON.stringify({ success: wpResult.success, postId: wpResult.post?.id, link: wpResult.post?.link, error: wpResult.error }));

        if (wpResult.success && wpResult.post) {
          await prisma.publishRecord.create({
            data: { contentId, socialAccountId: account.id, status: "SUCCESS", platformPostUrl: wpResult.post.link, publishedAt: isScheduled ? undefined : new Date() },
          });
          results.push({ socialAccountId: account.id, platform: "WORDPRESS", accountName: account.accountName, status: "SUCCESS", platformPostUrl: wpResult.post.link });
        } else {
          await prisma.publishRecord.create({
            data: { contentId, socialAccountId: account.id, status: "FAILED", errorMessage: wpResult.error ?? "알 수 없는 오류" },
          });
          results.push({ socialAccountId: account.id, platform: "WORDPRESS", accountName: account.accountName, status: "FAILED", errorMessage: wpResult.error });
        }
        continue;
      }

      /* ── 기타 플랫폼: Mock ─────────────────────────── */
      const record = await prisma.publishRecord.create({
        data: { contentId, socialAccountId: account.id, status: isScheduled ? "PENDING" : "SUCCESS", platformPostUrl: isScheduled ? undefined : `https://mock.example.com/post/${Date.now()}`, publishedAt: isScheduled ? undefined : new Date() },
      });
      results.push({ socialAccountId: account.id, platform: account.platform, accountName: account.accountName, status: isScheduled ? "PENDING" : "SUCCESS", platformPostUrl: record.platformPostUrl, ...(isScheduled && { scheduledAt: scheduledDate }) });
    }

    // 상태 업데이트
    const anySuccess = results.some(r => r.status === "SUCCESS");
    if (anySuccess && !isScheduled) {
      await prisma.content.update({ where: { id: contentId }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    } else if (isScheduled) {
      await prisma.content.update({ where: { id: contentId }, data: { status: "SCHEDULED", scheduledAt: scheduledDate } });
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

/* ─── GET: 발행 기록 조회 ────────────────────────────── */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const contentId = searchParams.get("contentId");
  if (!contentId) {
    return NextResponse.json({ error: "contentId가 필요합니다" }, { status: 400 });
  }

  const records = await prisma.publishRecord.findMany({
    where: { contentId, content: { userId: session.user.id } },
    include: { socialAccount: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ records });
}
