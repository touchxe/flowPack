/**
 * 네이버 블로그 스텔스 크롤러 — FlowPack /cases 더미 데이터 수집
 * 
 * 대상: 서울 자영업자 (카페/음식점/인테리어/시설)의 블로그 마케팅 성과 게시글
 * 방법: Playwright + puppeteer-extra-plugin-stealth (봇 탐지 우회)
 * 출력: scripts/output/cases-data.json
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

/* ─── 검색 쿼리 목록 ──────────────────────────────────────
   목적: FlowPack 도입 사례와 유사한 "SNS/블로그 마케팅으로
         매출이 오른" 서울 소상공인 사례를 수집
───────────────────────────────────────────────────────── */
const SEARCH_QUERIES = [
  "서울 카페 블로그 마케팅 후기 매출",
  "서울 인테리어 인스타그램 마케팅 성과",
  "자영업자 SNS 마케팅 성공 사례 서울",
  "서울 음식점 블로그 마케팅 방문자 증가",
  "서울 헤어샵 미용실 인스타 마케팅 후기",
  "서울 필라테스 피트니스 SNS 마케팅 회원 증가",
  "서울 인테리어 업체 블로그 포스팅 문의 증가",
  "소상공인 콘텐츠 마케팅 효과 서울 카페",
];

/* ─── 인간 행동 시뮬레이션 유틸 ──────────────────────── */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function humanScroll(page, times = 3) {
  for (let i = 0; i < times; i++) {
    await page.mouse.wheel(0, rand(300, 700));
    await sleep(rand(400, 900));
  }
}

async function humanType(page, selector, text) {
  await page.click(selector);
  await sleep(rand(200, 500));
  for (const char of text) {
    await page.keyboard.type(char, { delay: rand(50, 150) });
  }
}

/* ─── 블로그 포스트 텍스트 수집 ──────────────────────── */
async function scrapeBlogPost(page, url) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await sleep(rand(1000, 2000));

    // 네이버 블로그는 iframe 내부에 본문이 있는 경우가 많음
    const frames = page.frames();
    let content = "";
    let title = "";

    for (const frame of frames) {
      try {
        const frameTitle = await frame.$eval(
          ".se-title-text, .pcol1, h3.title, .htitle",
          el => el.textContent?.trim()
        ).catch(() => "");

        const frameContent = await frame.$eval(
          ".se-main-container, .post-view, #postViewArea, .se_component_wrap",
          el => el.textContent?.replace(/\s+/g, " ").slice(0, 800).trim()
        ).catch(() => "");

        if (frameContent && frameContent.length > 100) {
          title = frameTitle;
          content = frameContent;
          break;
        }
      } catch { }
    }

    // iframe이 아닌 경우 직접 추출
    if (!content) {
      title = await page.$eval("title", el => el.textContent?.trim()).catch(() => "");
      content = await page.$eval(
        "body",
        el => el.textContent?.replace(/\s+/g, " ").slice(0, 800).trim()
      ).catch(() => "");
    }

    return { title, content };
  } catch (err) {
    return { title: "", content: "" };
  }
}

/* ─── 네이버 블로그 검색 결과 수집 ───────────────────── */
async function searchNaverBlog(page, query, maxResults = 5) {
  const results = [];

  try {
    console.log(`\n🔍 검색: "${query}"`);

    // 네이버 블로그 검색
    const searchUrl = `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(query)}&sm=tab_opt&nso=so%3Add%2Cp%3A1y`;
    await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(rand(1500, 3000));
    await humanScroll(page, 2);

    // 검색 결과 아이템 추출
    const items = await page.$$eval(
      ".api_txt_lines.total_tit, .title_area .title",
      els => els.slice(0, 8).map(el => ({
        title: el.textContent?.trim() ?? "",
        href: el.closest("a")?.href ?? el.href ?? "",
      }))
    ).catch(() => []);

    // 설명 텍스트 추출
    const descs = await page.$$eval(
      ".api_txt_lines.dsc_txt, .dsc_txt_wrap, .total_dsc",
      els => els.slice(0, 8).map(el => el.textContent?.trim().slice(0, 200) ?? "")
    ).catch(() => []);

    // 블로거명 추출
    const authors = await page.$$eval(
      ".sub_txt.sub_name, .user_info .name",
      els => els.slice(0, 8).map(el => el.textContent?.trim() ?? "")
    ).catch(() => []);

    // 날짜 추출
    const dates = await page.$$eval(
      ".sub_txt.sub_time, .date",
      els => els.slice(0, 8).map(el => el.textContent?.trim() ?? "")
    ).catch(() => []);

    console.log(`  → 발견: ${items.length}건`);

    for (let i = 0; i < Math.min(items.length, maxResults); i++) {
      const item = items[i];
      if (!item.href || !item.title) continue;

      await sleep(rand(800, 1500));

      results.push({
        title: item.title,
        url: item.href,
        desc: descs[i] ?? "",
        author: authors[i] ?? "",
        date: dates[i] ?? "",
        query,
      });

      console.log(`  ✓ [${i + 1}] ${item.title.slice(0, 40)}`);
    }

  } catch (err) {
    console.log(`  ✗ 오류: ${err.message}`);
  }

  return results;
}

/* ─── 수집 데이터 → FlowPack Case 형식 변환 ─────────── */
function transformToCase(raw, index) {
  // 업종 감지
  const title = raw.title.toLowerCase();
  const desc = raw.desc.toLowerCase();
  const combined = title + " " + desc;

  let industry = "기타";
  let emoji = "🏢";
  let channel = "네이버블로그";
  let color = "#6366F1";

  if (combined.match(/카페|커피|베이커리|디저트/)) { industry = "카페/F&B"; emoji = "☕"; color = "#92400E"; }
  else if (combined.match(/음식|식당|맛집|레스토랑|분식|치킨|피자/)) { industry = "외식업"; emoji = "🍽️"; color = "#DC2626"; }
  else if (combined.match(/인테리어|시공|리모델링|공사/)) { industry = "인테리어"; emoji = "🏠"; color = "#0891B2"; }
  else if (combined.match(/헤어|뷰티|미용|네일|피부/)) { industry = "뷰티/미용"; emoji = "💆"; color = "#7C3AED"; }
  else if (combined.match(/피트니스|헬스|필라테스|요가|운동/)) { industry = "피트니스"; emoji = "💪"; color = "#059669"; }
  else if (combined.match(/학원|교육|과외|영어|수학/)) { industry = "교육"; emoji = "📚"; color = "#D97706"; }

  // 채널 감지
  if (combined.match(/인스타|instagram/i)) channel = "Instagram";
  else if (combined.match(/유튜브|youtube/i)) channel = "YouTube";
  else if (combined.match(/블로그|naver/i)) channel = "네이버블로그";

  // 성과 지표 (더미 + 맥락 기반)
  const views = rand(1200, 15000);
  const roi = rand(180, 420);
  const leads = rand(12, 89);
  const costSaving = rand(30, 70);

  return {
    id: `case-naver-${String(index + 1).padStart(3, "0")}`,
    company: raw.author || `서울 ${industry} 업체`,
    industry,
    emoji,
    title: raw.title.slice(0, 60),
    desc: raw.desc.slice(0, 120) || `${industry} 업체의 SNS/블로그 마케팅 성공 사례`,
    channel,
    channelColor: color,
    metrics: {
      views: `${views.toLocaleString()}`,
      roi: `${roi}%`,
      leads: `${leads}건`,
      costSaving: `${costSaving}%`,
    },
    tags: [industry, channel.replace("네이버블로그", "네이버"), "서울"],
    sourceUrl: raw.url,
    sourceDate: raw.date,
    crawledAt: new Date().toISOString(),
  };
}

/* ─── 메인 ───────────────────────────────────────────── */
async function main() {
  console.log("🚀 FlowPack 네이버 블로그 크롤러 시작");
  console.log("=" .repeat(50));

  // playwright-extra + stealth 설정
  const chromiumExtra = addExtra(chromium);
  chromiumExtra.use(StealthPlugin());

  const browser = await chromiumExtra.launch({
    headless: false, // 브라우저 창 표시 (스텔스 모드는 headless false가 더 유리)
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--window-size=1280,900",
      `--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36`,
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    extraHTTPHeaders: {
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    },
  });

  // WebDriver 감지 우회
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, "languages", { get: () => ["ko-KR", "ko", "en"] });
    window.chrome = { runtime: {} };
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  // 네이버 메인 먼저 방문 (자연스러운 흐름)
  console.log("\n📱 네이버 메인 페이지 방문 중...");
  await page.goto("https://www.naver.com", { waitUntil: "networkidle" });
  await sleep(rand(2000, 4000));
  await humanScroll(page, 2);

  const allRaw = [];
  const allCases = [];

  // 각 쿼리로 검색
  for (let qi = 0; qi < SEARCH_QUERIES.length; qi++) {
    const query = SEARCH_QUERIES[qi];

    // 쿼리 간 대기 (봇 탐지 방지)
    if (qi > 0) await sleep(rand(3000, 6000));

    const results = await searchNaverBlog(page, query, 4);
    allRaw.push(...results);

    // 검색 5개마다 잠깐 네이버 메인 다녀오기
    if (qi % 3 === 2) {
      console.log("\n  (잠시 대기 중...)");
      await page.goto("https://www.naver.com", { waitUntil: "domcontentloaded" });
      await sleep(rand(3000, 5000));
    }
  }

  await browser.close();

  console.log(`\n✅ 총 ${allRaw.length}개 블로그 포스트 수집 완료`);

  // Case 형식으로 변환
  for (let i = 0; i < allRaw.length; i++) {
    allCases.push(transformToCase(allRaw[i], i));
  }

  // 결과 저장
  const outputDir = path.join(__dirname, "output");
  await fs.mkdir(outputDir, { recursive: true });

  const rawPath = path.join(outputDir, "cases-raw.json");
  const casesPath = path.join(outputDir, "cases-data.json");

  await fs.writeFile(rawPath, JSON.stringify(allRaw, null, 2), "utf-8");
  await fs.writeFile(casesPath, JSON.stringify(allCases, null, 2), "utf-8");

  console.log(`\n📁 저장 완료:`);
  console.log(`  - ${rawPath} (원본 ${allRaw.length}건)`);
  console.log(`  - ${casesPath} (변환 ${allCases.length}건)`);
  console.log("\n🎉 완료! cases-data.json을 /cases 페이지에 적용하세요.");

  // 미리보기
  console.log("\n📋 수집 결과 미리보기:");
  allCases.slice(0, 5).forEach((c, i) => {
    console.log(`  [${i+1}] ${c.emoji} ${c.company} — ${c.title.slice(0, 40)}`);
    console.log(`       업종: ${c.industry} | 채널: ${c.channel}`);
  });
}

main().catch(err => {
  console.error("크롤러 오류:", err);
  process.exit(1);
});

/* ─── 난수 유틸 (파일 내 사용) ─────────────────────── */
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
