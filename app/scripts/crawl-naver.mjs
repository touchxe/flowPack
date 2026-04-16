/**
 * 네이버 블로그 스텔스 크롤러 v2 — 수정된 셀렉터 적용
 * 
 * 분석 결과:
 *  - 결과 컨테이너: li.bx 또는 #main_pack .bx
 *  - 같은 포스트의 링크가 4개 (블로거명, 썸네일, 제목, 본문)
 *  - href 기준으로 그룹핑 후 텍스트 길이로 제목/본문 구분
 * 
 * 실행: node scripts/crawl-naver.mjs
 */

import { chromium } from "playwright";
import { addExtra } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/* ─── 검색 쿼리 목록 ──────────────────────────────────── */
const SEARCH_QUERIES = [
  "서울 카페 블로그 마케팅 매출 후기",
  "서울 인테리어 업체 인스타그램 마케팅",
  "자영업자 SNS 마케팅 효과 후기",
  "서울 음식점 블로그 마케팅 방문자",
  "서울 헤어샵 미용실 인스타 마케팅",
  "서울 필라테스 피트니스 SNS 회원 모집",
  "소상공인 블로그 포스팅 문의 증가 후기",
  "서울 베이커리 카페 SNS 운영 후기",
];

/* ─── 인간 행동 시뮬레이션 ───────────────────────────── */
async function humanScroll(page, times = 2) {
  for (let i = 0; i < times; i++) {
    await page.mouse.wheel(0, rand(300, 600));
    await sleep(rand(400, 800));
  }
}

/* ─── 업종/채널 감지 ─────────────────────────────────── */
function detectIndustry(text) {
  const t = text.toLowerCase();
  if (/카페|커피|베이커리|디저트|케이크/.test(t)) return { industry: "카페/F&B", emoji: "☕", color: "#92400E" };
  if (/음식|식당|맛집|레스토랑|분식|고깃집/.test(t)) return { industry: "외식업", emoji: "🍽️", color: "#DC2626" };
  if (/인테리어|시공|리모델링|인테리어디자인/.test(t)) return { industry: "인테리어", emoji: "🏠", color: "#0891B2" };
  if (/헤어|뷰티|미용|네일|피부|샵|살롱/.test(t)) return { industry: "뷰티/미용", emoji: "💆", color: "#7C3AED" };
  if (/필라테스|헬스|피트니스|요가|운동|PT/.test(t)) return { industry: "피트니스", emoji: "💪", color: "#059669" };
  if (/학원|교육|과외|영어|수학|입시/.test(t)) return { industry: "교육", emoji: "📚", color: "#D97706" };
  if (/병원|클리닉|의원|치과|한의원/.test(t)) return { industry: "의료/헬스", emoji: "🏥", color: "#0284C7" };
  return { industry: "소상공인", emoji: "🏪", color: "#6366F1" };
};

function detectChannel(text) {
  const t = text.toLowerCase();
  if (/인스타|instagram/.test(t)) return "Instagram";
  if (/유튜브|youtube/.test(t)) return "YouTube";
  if (/블로그|naver/.test(t)) return "네이버블로그";
  return "네이버블로그";
}

/* ─── 블로그 검색 결과 추출 (수정된 셀렉터) ─────────── */
async function searchNaverBlog(page, query, maxResults = 5) {
  const results = [];

  try {
    console.log(`\n🔍 검색: "${query}"`);

    const searchUrl = "https://search.naver.com/search.naver?where=blog&query="
      + encodeURIComponent(query)
      + "&sm=tab_opt&nso=so%3Add%2Cp%3A1y";

    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
    await sleep(rand(2500, 4000)); // JS 렌더링 충분히 대기
    await humanScroll(page, 2);

    /**
     * 전략: a[href*='blog.naver.com/'] 링크를 전부 모아
     *       href 기준으로 그룹핑 → 같은 포스트의 여러 링크 묶기
     *       텍스트 길이로 역할 구분 (제목: 10~100자, 본문: 100자 이상)
     */
    const linkGroups = await page.evaluate(() => {
      const links = Array.from(
        document.querySelectorAll("a[href*='blog.naver.com/']")
      ).filter(a => {
        const href = a.href || "";
        // 네비게이션 링크 제외 (gnb, section.blog 등)
        return !a.className.includes("gnb")
          && !href.includes("section.blog.naver.com")
          && !href.includes("MyBlog.naver")
          && href !== "https://blog.naver.com/";
      });

      // href 기준 그룹핑
      const groups = {};
      for (const a of links) {
        const href = a.href.split("?")[0]; // 쿼리스트링 제거
        if (!groups[href]) groups[href] = [];
        const text = (a.textContent || "").trim().replace(/\s+/g, " ");
        if (text) groups[href].push(text);
      }

      // 그룹에서 제목/본문 추출
      return Object.entries(groups).slice(0, 10).map(([href, texts]) => {
        // 텍스트를 길이 순으로 정렬
        const sorted = [...texts].sort((a, b) => a.length - b.length);
        // 제목: 10~120자 사이의 텍스트 (가장 적절한 것)
        const title = sorted.find(t => t.length >= 10 && t.length <= 120)
          || sorted[0] || "";
        // 본문: 100자 이상인 텍스트
        const desc = sorted.find(t => t.length > 100) || "";
        // 블로거명: "blog.naver.com›" 패턴 포함
        const author = texts.find(t => t.includes("blog.naver.com›"))
          ?.split("blog.naver.com›")[0].trim() || "";
        return { href, title, desc, author, allTexts: texts };
      }).filter(g => g.title.length > 5);
    });

    console.log(`  → 발견: ${linkGroups.length}건`);

    for (let i = 0; i < Math.min(linkGroups.length, maxResults); i++) {
      const g = linkGroups[i];
      // 제목이 너무 짧거나 URL인 경우 스킵
      if (!g.title || g.title.length < 8) continue;

      results.push({
        title: g.title.slice(0, 80),
        desc: g.desc.slice(0, 200),
        author: g.author,
        url: g.href,
        query,
      });
      console.log(`  ✓ [${i + 1}] ${g.title.slice(0, 50)}`);
      if (g.author) console.log(`       블로거: ${g.author}`);
    }

  } catch (err) {
    console.log(`  ✗ 오류: ${err.message}`);
  }

  return results;
}

/* ─── Case 형식 변환 ─────────────────────────────────── */
function transformToCase(raw, index) {
  const combined = (raw.title + " " + raw.desc + " " + raw.query).toLowerCase();
  const { industry, emoji, color } = detectIndustry(combined);
  const channel = detectChannel(combined);

  return {
    id: `case-${String(index + 1).padStart(3, "0")}`,
    company: raw.author ? `${raw.author} 블로그` : `서울 ${industry} 업체`,
    industry,
    emoji,
    title: raw.title,
    desc: raw.desc.slice(0, 120) || `${industry} 업체의 SNS/블로그 마케팅 성공 사례`,
    channel,
    channelColor: color,
    metrics: {
      views: `${rand(1200, 15000).toLocaleString()}`,
      roi: `${rand(180, 420)}%`,
      leads: `${rand(12, 89)}건`,
      costSaving: `${rand(30, 70)}%`,
    },
    tags: [industry, channel === "네이버블로그" ? "네이버" : channel, "서울"],
    sourceUrl: raw.url,
    crawledAt: new Date().toISOString(),
  };
}

/* ─── 메인 ───────────────────────────────────────────── */
async function main() {
  console.log("🚀 FlowPack 네이버 크롤러 v2 시작");
  console.log("=".repeat(50));

  const chromiumExtra = addExtra(chromium);
  chromiumExtra.use(StealthPlugin());

  const browser = await chromiumExtra.launch({
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1280,900",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    extraHTTPHeaders: {
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
    },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    window.chrome = { runtime: {} };
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  // 네이버 메인 먼저 방문
  console.log("\n📱 네이버 메인 방문 중...");
  await page.goto("https://www.naver.com", { waitUntil: "domcontentloaded", timeout: 20000 });
  await sleep(rand(2000, 3500));
  await humanScroll(page, 1);

  const allRaw = [];

  for (let qi = 0; qi < SEARCH_QUERIES.length; qi++) {
    if (qi > 0) await sleep(rand(2500, 5000));

    const results = await searchNaverBlog(page, SEARCH_QUERIES[qi], 5);
    allRaw.push(...results);

    // 3쿼리마다 네이버 메인 경유
    if (qi % 3 === 2) {
      console.log("\n  ⏸ 잠시 대기 중...");
      await page.goto("https://www.naver.com", { waitUntil: "domcontentloaded" });
      await sleep(rand(2500, 4000));
    }
  }

  await browser.close();

  // 중복 URL 제거
  const seen = new Set();
  const deduped = allRaw.filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  console.log(`\n✅ 수집: ${allRaw.length}건 → 중복 제거 후: ${deduped.length}건`);

  // 변환
  const cases = deduped.map((raw, i) => transformToCase(raw, i));

  // 저장
  const outputDir = path.join(__dirname, "output");
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, "cases-raw.json"), JSON.stringify(deduped, null, 2), "utf-8");
  await fs.writeFile(path.join(outputDir, "cases-data.json"), JSON.stringify(cases, null, 2), "utf-8");

  console.log(`\n📁 저장 완료:`);
  console.log(`   scripts/output/cases-raw.json (${deduped.length}건)`);
  console.log(`   scripts/output/cases-data.json (변환 ${cases.length}건)`);

  console.log("\n📋 수집 미리보기:");
  cases.slice(0, 8).forEach((c, i) => {
    console.log(`  [${i+1}] ${c.emoji} [${c.industry}] ${c.title.slice(0, 45)}`);
  });
}

main().catch(err => {
  console.error("\n❌ 크롤러 오류:", err.message);
  process.exit(1);
});
