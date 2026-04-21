import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { z } from "zod";
import { marked } from "marked";
import { parseWordPressCredentials, publishToWordPress, uploadImageToWordPress } from "@/lib/integrations/wordpress";
import {
  parseInstagramCredentials,
  buildInstagramCaption,
  createMediaContainer,
  createCarouselContainer,
  waitForContainerReady,
  publishContainer,
} from "@/lib/integrations/instagram";
import {
  parseThreadsCredentials,
  buildThreadsCaption,
  createThreadsTextContainer,
  createThreadsImageContainer,
  createThreadsCarouselContainer,
  publishThreadsContainer,
} from "@/lib/integrations/threads";

const publishSchema = z.object({
  contentId: z.string(),
  socialAccountIds: z.array(z.string()).min(1),
  scheduledAt: z.string().optional(),
});

/**
 * HTML 안 첫 번째 <img> 태그에서 src 추출
 */
function extractFirstImageFromHtml(html: string): string | null {
  const match = html.match(/<img[^>]+src="([^"]+)"/);
  return match ? match[1] : null;
}

/**
 * HTML 내 /api/content/.../serve 경로를 패턴으로 모두 제거 후 wpUrl로 대체
 * (상대 경로, 절대 경로 모두 처리)
 */
function replaceServeUrls(html: string, imageId: string, contentId: string, wpUrl: string): string {
  // /api/content/{contentId}/images/{imageId}/serve (상대 or 절대 URL 모두)
  const pattern = new RegExp(
    `(https?://[^"]*)?/api/content/${contentId}/images/${imageId}/serve`,
    'g'
  );
  return html.replace(pattern, wpUrl);
}

/**
 * 마크다운 → WordPress HTML 변환
 */
function convertMarkdownToHtml(body: string): string {
  if (!body?.trim()) return "<p>내용이 없습니다.</p>";
  const html = marked.parse(body, { async: false }) as string;
  return html;
}

/**
 * 마크다운에서 제목 추출 (60자 이하)
 */
function extractTitle(body: string, originalTitle: string): string {
  if (originalTitle.length <= 60) return originalTitle;
  const h1Match = body.match(/^#\s+(.+)$/m);
  if (h1Match && h1Match[1].length <= 60) return h1Match[1].trim();
  return originalTitle.slice(0, 57) + "...";
}

/**
 * ContentImage를 DB 데이터에서 직접 WordPress로 업로드
 * - base64 data URL → 바이너리 변환 후 직접 업로드 (serve URL 우회)
 * - 외부 URL → uploadImageToWordPress로 위임
 */
async function uploadContentImageToWp(
  creds: { siteUrl: string; username: string; appPassword: string },
  imageData: string,  // DB에 저장된 url (base64 or external)
  altText: string
): Promise<{ success: boolean; mediaId?: number; mediaUrl?: string; error?: string }> {
  // base64 data URL: 직접 바이너리 변환 후 업로드
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

      if (!res.ok) {
        return { success: false, error: `WP 미디어 업로드 실패 (HTTP ${res.status})` };
      }

      const media = await res.json();

      // alt text 설정
      if (altText) {
        await fetch(`${apiBase}/media/${media.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify({ alt_text: altText }),
        }).catch(() => {});
      }

      return { success: true, mediaId: media.id, mediaUrl: media.source_url };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "업로드 오류";
      return { success: false, error: msg };
    }
  }

  // 외부 URL (Vercel Blob 등): 기존 uploadImageToWordPress 사용
  if (imageData.startsWith("http://") || imageData.startsWith("https://")) {
    return uploadImageToWordPress(creds, imageData, altText);
  }

  return { success: false, error: "지원하지 않는 이미지 형식" };
}

/**
 * WordPress 태그 생성/조회 후 ID 반환
 * HTML <strong> 태그에서 태그명 추출 (Tiptap이 HTML로 저장하므로)
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

        // 1) 제목 최적화
        const wpTitle = extractTitle(content.body ?? "", content.title);
        console.log("[WP-DEBUG]   제목:", wpTitle);

        // 2) HTML 변환 (body가 이미 HTML인 경우 그대로, 마크다운이면 변환)
        // Tiptap은 HTML로 저장하므로 그대로 사용
        let htmlContent = content.body ?? "";
        if (htmlContent && !htmlContent.includes("<") ) {
          // 마크다운으로 보이면 변환
          htmlContent = convertMarkdownToHtml(htmlContent);
        }
        if (!htmlContent.trim()) htmlContent = "<p>내용이 없습니다.</p>";
        console.log("[WP-DEBUG]   HTML 길이:", htmlContent.length, "자");

        // 3) 이미지 처리: 모든 DB 이미지를 WordPress 미디어로 업로드
        let featuredMediaId: number | undefined;
        const contentImages = content.images || [];

        if (contentImages.length > 0) {
          console.log(`[WP-DEBUG]   ${contentImages.length}개 이미지 업로드 시작...`);

          for (let i = 0; i < contentImages.length; i++) {
            const img = contentImages[i];
            const altText = img.altText || wpTitle;
            console.log(`[WP-DEBUG]   이미지 ${i + 1}/${contentImages.length}: ${img.id}`);

            const imgResult = await uploadContentImageToWp(creds, img.url, altText);

            if (imgResult.success && imgResult.mediaId) {
              if (!featuredMediaId) {
                featuredMediaId = imgResult.mediaId;
                console.log(`[WP-DEBUG]   ✓ 대표 이미지: mediaId=${featuredMediaId}`);
              }
              if (imgResult.mediaUrl) {
                htmlContent = replaceServeUrls(htmlContent, img.id, contentId, imgResult.mediaUrl);
                console.log(`[WP-DEBUG]   ✓ URL 교체 → ${imgResult.mediaUrl}`);
              }
            } else {
              console.log(`[WP-DEBUG]   ⚠ 업로드 실패: ${imgResult.error}`);
            }
          }
        } else {
          // DB 이미지 없으면 HTML 내 외부 URL 이미지로 대표 이미지 시도
          const firstSrc = extractFirstImageFromHtml(htmlContent);
          if (firstSrc && (firstSrc.startsWith("http://") || firstSrc.startsWith("https://"))) {
            const imgResult = await uploadImageToWordPress(creds, firstSrc, wpTitle);
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

        // 잔여 serve URL 안전장치 (교체 실패 대비)
        htmlContent = htmlContent.replace(
          /src="(\/api\/content\/[^"]+\/serve)"/g,
          'src=""'
        );


        // 4) 태그 생성 — keywords 메타데이터 우선, 없으면 <strong> 보조 추출
        let tagNames: string[] = [];

        // 우선순위 1: content.keywords (AI 추천 or 사용자 입력, JSON 배열)
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

        // 우선순위 2: keywords가 비어있으면 <strong> 태그에서 2~15자 키워드 추출
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

      /* ── Instagram: 실제 Meta Graph API ─────────────── */
      if (account.platform === "INSTAGRAM") {
        const creds = parseInstagramCredentials(account.accessToken, account.accountName);
        if (!creds) {
          await prisma.publishRecord.create({ data: { contentId, socialAccountId: account.id, status: "FAILED", errorMessage: "Instagram 재연동 필요" } });
          results.push({ socialAccountId: account.id, platform: "INSTAGRAM", accountName: account.accountName, status: "FAILED", errorMessage: "Instagram 재연동이 필요합니다" });
          continue;
        }

        // 슬라이드 이미지 URL 배열 추출
        let slideUrls: string[] = [];
        if (content.slides) {
          try { slideUrls = (JSON.parse(content.slides) as { imageUrl?: string }[]).map(s => s.imageUrl).filter((u): u is string => !!u); } catch {}
        }

        const caption = buildInstagramCaption(content.title, content.body ?? null, content.tone ?? null);
        let igContainerResult: { containerId: string } | { error: string };

        if (slideUrls.length >= 2) {
          // 카드뉴스 → 캐러셀
          igContainerResult = await createCarouselContainer(creds.igAccountId, creds.pageAccessToken, slideUrls, caption);
        } else {
          const imgUrl = content.thumbnailUrl ?? content.images[0]?.url ?? slideUrls[0];
          if (!imgUrl) {
            await prisma.publishRecord.create({ data: { contentId, socialAccountId: account.id, status: "FAILED", errorMessage: "이미지 없음" } });
            results.push({ socialAccountId: account.id, platform: "INSTAGRAM", accountName: account.accountName, status: "FAILED", errorMessage: "Instagram 발행에는 이미지가 필요합니다" });
            continue;
          }
          igContainerResult = await createMediaContainer(creds.igAccountId, creds.pageAccessToken, imgUrl, caption);
        }

        if ("error" in igContainerResult) {
          await prisma.publishRecord.create({ data: { contentId, socialAccountId: account.id, status: "FAILED", errorMessage: igContainerResult.error } });
          results.push({ socialAccountId: account.id, platform: "INSTAGRAM", accountName: account.accountName, status: "FAILED", errorMessage: igContainerResult.error });
          continue;
        }

        const ready = await waitForContainerReady(igContainerResult.containerId, creds.pageAccessToken);
        if (!ready) {
          await prisma.publishRecord.create({ data: { contentId, socialAccountId: account.id, status: "FAILED", errorMessage: "미디어 처리 타임아웃" } });
          results.push({ socialAccountId: account.id, platform: "INSTAGRAM", accountName: account.accountName, status: "FAILED", errorMessage: "이미지 처리 시간 초과. 다시 시도해주세요." });
          continue;
        }

        const igResult = await publishContainer(creds.igAccountId, creds.pageAccessToken, igContainerResult.containerId);
        if ("error" in igResult) {
          await prisma.publishRecord.create({ data: { contentId, socialAccountId: account.id, status: "FAILED", errorMessage: igResult.error } });
          results.push({ socialAccountId: account.id, platform: "INSTAGRAM", accountName: account.accountName, status: "FAILED", errorMessage: igResult.error });
        } else {
          await prisma.publishRecord.create({ data: { contentId, socialAccountId: account.id, status: "SUCCESS", platformPostUrl: igResult.postUrl, publishedAt: new Date() } });
          results.push({ socialAccountId: account.id, platform: "INSTAGRAM", accountName: account.accountName, status: "SUCCESS", platformPostUrl: igResult.postUrl });
        }
        continue;
      }

      /* ── Threads: 실제 Threads Graph API ────────────── */
      if (account.platform === "THREADS") {
        const creds = parseThreadsCredentials(account.accessToken, account.accountName);
        if (!creds) {
          await prisma.publishRecord.create({ data: { contentId, socialAccountId: account.id, status: "FAILED", errorMessage: "Threads 재연동 필요" } });
          results.push({ socialAccountId: account.id, platform: "THREADS", accountName: account.accountName, status: "FAILED", errorMessage: "Threads 재연동이 필요합니다" });
          continue;
        }

        let slideUrls: string[] = [];
        if (content.slides) {
          try { slideUrls = (JSON.parse(content.slides) as { imageUrl?: string }[]).map(s => s.imageUrl).filter((u): u is string => !!u); } catch {}
        }

        const caption = buildThreadsCaption(content.title, content.body ?? null, content.tone ?? null);
        let thrContainerResult: { containerId: string } | { error: string };

        if (slideUrls.length >= 2) {
          thrContainerResult = await createThreadsCarouselContainer(creds.userId, creds.accessToken, slideUrls, caption);
        } else {
          const imgUrl = content.thumbnailUrl ?? content.images[0]?.url ?? slideUrls[0];
          if (imgUrl) {
            thrContainerResult = await createThreadsImageContainer(creds.userId, creds.accessToken, imgUrl, caption);
          } else {
            thrContainerResult = await createThreadsTextContainer(creds.userId, creds.accessToken, caption);
          }
        }

        if ("error" in thrContainerResult) {
          await prisma.publishRecord.create({ data: { contentId, socialAccountId: account.id, status: "FAILED", errorMessage: thrContainerResult.error } });
          results.push({ socialAccountId: account.id, platform: "THREADS", accountName: account.accountName, status: "FAILED", errorMessage: thrContainerResult.error });
          continue;
        }

        const thrResult = await publishThreadsContainer(creds.userId, creds.accessToken, thrContainerResult.containerId);
        if ("error" in thrResult) {
          await prisma.publishRecord.create({ data: { contentId, socialAccountId: account.id, status: "FAILED", errorMessage: thrResult.error } });
          results.push({ socialAccountId: account.id, platform: "THREADS", accountName: account.accountName, status: "FAILED", errorMessage: thrResult.error });
        } else {
          await prisma.publishRecord.create({ data: { contentId, socialAccountId: account.id, status: "SUCCESS", platformPostUrl: thrResult.postUrl, publishedAt: new Date() } });
          results.push({ socialAccountId: account.id, platform: "THREADS", accountName: account.accountName, status: "SUCCESS", platformPostUrl: thrResult.postUrl });
        }
        continue;
      }

      /* ── 기타 플랫폼: Mock ─────────────────────────── */
      const record = await prisma.publishRecord.create({
        data: { contentId, socialAccountId: account.id, status: isScheduled ? "PENDING" : "SUCCESS", platformPostUrl: isScheduled ? undefined : `https://mock.example.com/post/${Date.now()}`, publishedAt: isScheduled ? undefined : new Date() },
      });
      results.push({ socialAccountId: account.id, platform: account.platform, accountName: account.accountName, status: isScheduled ? "PENDING" : "SUCCESS", platformPostUrl: record.platformPostUrl, ...(isScheduled && { scheduledAt: scheduledDate }) });
    }

    const anySuccess = results.some(r => r.status === "SUCCESS");
    if (anySuccess && !isScheduled) {
      await prisma.content.update({ where: { id: contentId }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    } else if (isScheduled) {
      await prisma.content.update({ where: { id: contentId }, data: { status: "SCHEDULED", scheduledAt: scheduledDate } });
    }

    // 알림: 플랫폼별 발행 성공/실패
    for (const r of results) {
      if (r.status === "SUCCESS") {
        createNotification(session.user!.id, "PUBLISH_SUCCESS", {
          title: "콘텐츠 발행 완료",
          message: `'${content.title}' 콘텐츠가 ${r.accountName || r.platform}에 발행되었습니다`,
          actionUrl: r.platformPostUrl ?? "/contents",
          metadata: { contentId, platform: r.platform },
        });
      } else if (r.status === "FAILED") {
        createNotification(session.user!.id, "PUBLISH_FAILED", {
          title: "콘텐츠 발행 실패",
          message: `'${content.title}' ${r.accountName || r.platform} 발행이 실패했습니다 — ${r.errorMessage || "알 수 없는 오류"}`,
          actionUrl: "/contents",
          metadata: { contentId, platform: r.platform, error: r.errorMessage },
        });
      }
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
