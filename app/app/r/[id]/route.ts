/**
 * GET /r/[id] — 리다이렉트 클릭 추적
 * 
 * PublishRecord ID를 받아 clickCount +1 후 platformPostUrl로 리다이렉트
 * - 봇 필터링 (User-Agent 검사)
 * - 동일 IP 5초 내 중복 클릭 무시 (메모리 캐시)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 간단한 중복 클릭 방지 (IP + recordId 기반, 5초 TTL)
const recentClicks = new Map<string, number>();
const DEDUP_INTERVAL = 5000; // 5초

// 봇 User-Agent 패턴
const BOT_PATTERNS = /bot|crawl|spider|slurp|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegram|preview|fetch/i;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. PublishRecord 조회
  const record = await prisma.publishRecord.findUnique({
    where: { id },
    select: { platformPostUrl: true, status: true },
  });

  if (!record || !record.platformPostUrl) {
    // 레코드 없음 → 홈으로
    return NextResponse.redirect(new URL("/", req.url));
  }

  // 2. 봇 필터링
  const ua = req.headers.get("user-agent") || "";
  const isBot = BOT_PATTERNS.test(ua);

  // 3. 중복 클릭 방지 (IP + recordId)
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  const dedupeKey = `${ip}:${id}`;
  const lastClick = recentClicks.get(dedupeKey);
  const now = Date.now();
  const isDuplicate = lastClick && (now - lastClick) < DEDUP_INTERVAL;

  // 4. 클릭 카운트 증가 (봇이 아니고 중복이 아닌 경우만)
  if (!isBot && !isDuplicate) {
    recentClicks.set(dedupeKey, now);

    // 비동기로 DB 업데이트 (리다이렉트 속도에 영향 주지 않음)
    prisma.publishRecord.update({
      where: { id },
      data: { clickCount: { increment: 1 } },
    }).catch(() => {});

    // 오래된 캐시 정리 (100개 넘으면)
    if (recentClicks.size > 100) {
      for (const [key, time] of recentClicks) {
        if (now - time > DEDUP_INTERVAL) recentClicks.delete(key);
      }
    }
  }

  // 5. 실제 URL로 302 리다이렉트
  return NextResponse.redirect(record.platformPostUrl, { status: 302 });
}
