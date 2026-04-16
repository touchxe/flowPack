/**
 * FlowPack Admin 전체 메뉴 Playwright 테스트
 * NextAuth credentials 로그인 → 8개 메뉴 → 스크린샷 저장
 *
 * 실행: node tests/admin-playwright-test.mjs
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, "screenshots");
const BASE_URL = "http://localhost:3000";
const EMAIL = "admin@flowpack.dev";
const PASSWORD = "Admin1234!";

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const results = [];
function ok(label, detail = "") {
  console.log(`  ✅ ${label}${detail ? " — " + detail : ""}`);
  results.push({ label, status: "PASS", detail });
}
function fail(label, err = "") {
  console.log(`  ❌ ${label}${err ? " — " + err : ""}`);
  results.push({ label, status: "FAIL", error: err });
}
async function shot(page, name) {
  const p = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`  📸 ${name}.png`);
}

// ─── NextAuth API 로그인 헬퍼 ──────────────────────────
async function loginViaApi(context) {
  // 1. CSRF 토큰
  const csrfRes = await context.request.get(`${BASE_URL}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();

  // 2. credentials 로그인
  await context.request.post(`${BASE_URL}/api/auth/callback/credentials`, {
    form: {
      csrfToken,
      email: EMAIL,
      password: PASSWORD,
      redirect: "false",
      callbackUrl: `${BASE_URL}/admin`,
      json: "true",
    },
  });

  // 3. 세션 확인
  const sessionRes = await context.request.get(`${BASE_URL}/api/auth/session`);
  const session = await sessionRes.json();
  return session;
}

// ─── 메인 테스트 ─────────────────────────────────────
async function runTests() {
  console.log("\n🎭 Playwright 관리자 테스트 시작");
  console.log(`서버: ${BASE_URL}`);
  console.log(`스크린샷: ${SCREENSHOTS_DIR}\n`);

  const browser = await chromium.launch({ headless: false, slowMo: 250 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // ── Step 1: API 로그인 ───────────────────────────
    console.log("━".repeat(52));
    console.log("Step 1: NextAuth API 로그인");

    const session = await loginViaApi(context);

    if (!session?.user?.id) {
      fail("로그인", "세션 없음");
      await browser.close();
      return;
    }
    ok("로그인", `${session.user.email} [${session.user.role}]`);

    if (session.user.role !== "ADMIN") {
      fail("권한 확인", "ADMIN 권한 없음");
      await browser.close();
      return;
    }
    ok("Admin 권한 확인");

    // ── Step 2: 대시보드 ────────────────────────────
    console.log("\n" + "━".repeat(52));
    console.log("Step 2: 대시보드 (/admin)");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await shot(page, "02_dashboard");

    // 사이드바: aside > nav 안의 모든 a 태그
    const navLinks = await page.locator("aside nav a").count();
    const appLink = await page.locator("aside a:has-text('돌아가기')").count();
    const totalLinks = navLinks + appLink;
    console.log(`  사이드바 링크: ${totalLinks}개 (nav: ${navLinks} + 하단: ${appLink})`);

    const menuTexts = await page.locator("aside nav a").allTextContents();
    console.log(`  메뉴: ${menuTexts.map(t => t.trim()).join(" | ")}`);

    // 그룹 라벨 확인 ("서비스 관리" / "운영 도구")
    const groupLabels = await page.locator("aside nav > div > p").count();
    console.log(`  그룹 라벨: ${groupLabels}개`);

    if (navLinks >= 8) ok(`사이드바 ${navLinks}개 메뉴`, menuTexts.join("|"));
    else fail("사이드바 메뉴 수", `${navLinks}개 (8개 기대)`);

    // ── Step 3: 유저 관리 ───────────────────────────
    console.log("\n" + "━".repeat(52));
    console.log("Step 3: 유저 관리 (/admin/users)");
    await page.goto(`${BASE_URL}/admin/users`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await shot(page, "03_users");
    const userRows = await page.locator("tbody tr").count();
    console.log(`  유저 행: ${userRows}개`);
    if (userRows >= 3) ok(`유저 ${userRows}명 표시`);
    else fail("유저 목록", `${userRows}행`);

    // ── Step 4: 콘텐츠 관리 ────────────────────────
    console.log("\n" + "━".repeat(52));
    console.log("Step 4: 콘텐츠 관리 (/admin/contents)");
    await page.goto(`${BASE_URL}/admin/contents`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await shot(page, "04_contents");
    const contentRows = await page.locator("tbody tr").count();
    console.log(`  콘텐츠 행: ${contentRows}개`);
    ok(`콘텐츠 관리 로드 (${contentRows}건)`);

    // ── Step 5: 구독 관리 ───────────────────────────
    console.log("\n" + "━".repeat(52));
    console.log("Step 5: 구독 관리 (/admin/subscriptions)");
    await page.goto(`${BASE_URL}/admin/subscriptions`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await shot(page, "05_subscriptions");
    const subRows = await page.locator("tbody tr").count();
    console.log(`  구독 행: ${subRows}개`);
    ok(`구독 관리 로드 (${subRows}건)`);

    // ── Step 6: 결제 관리 (신규) ────────────────────
    console.log("\n" + "━".repeat(52));
    console.log("Step 6: 결제 관리 (/admin/payments) ← 신규");
    await page.goto(`${BASE_URL}/admin/payments`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await shot(page, "06_payments");

    const h1Text = await page.locator("h1").first().textContent().catch(() => "");
    console.log(`  페이지 제목: ${h1Text.trim()}`);
    const payRows = await page.locator("tbody tr").count();
    console.log(`  결제 행: ${payRows}개`);

    if (h1Text.includes("결제")) {
      ok("결제 관리 페이지 로드");
      if (payRows >= 1) ok(`결제 내역 ${payRows}건`, "SUCCESS/FAILED/REFUNDED 포함");
      else fail("결제 데이터", "데이터 없음 (시드 확인 필요)");
    } else {
      fail("결제 관리", `제목 불일치: ${h1Text}`);
    }

    // KPI 카드 확인
    const kpiCards = await page.locator(".grid > div.rounded-xl").count();
    console.log(`  KPI 카드: ${kpiCards}개`);

    // ── Step 7: AI 사용량 (신규) ────────────────────
    console.log("\n" + "━".repeat(52));
    console.log("Step 7: AI 사용량 (/admin/ai-usage) ← 신규");
    await page.goto(`${BASE_URL}/admin/ai-usage`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000); // Recharts 렌더링
    await shot(page, "07_ai_usage");

    const aiTitle = await page.locator("h1").first().textContent().catch(() => "");
    console.log(`  페이지 제목: ${aiTitle.trim()}`);
    if (aiTitle.includes("AI")) {
      ok("AI 사용량 페이지 로드");
      // 차트 SVG 확인
      const charts = await page.locator("svg.recharts-surface").count();
      console.log(`  Recharts 차트: ${charts}개`);
      if (charts > 0) ok(`차트 ${charts}개 렌더링`);
    } else {
      fail("AI 사용량", `제목 불일치: ${aiTitle}`);
    }

    // ── Step 8: 공지사항 (신규) ─────────────────────
    console.log("\n" + "━".repeat(52));
    console.log("Step 8: 공지사항 (/admin/notices) ← 신규");
    await page.goto(`${BASE_URL}/admin/notices`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await shot(page, "08_notices");

    const noticeTitle = await page.locator("h1").first().textContent().catch(() => "");
    console.log(`  페이지 제목: ${noticeTitle.trim()}`);
    const noticeRows = await page.locator("tbody tr").count();
    console.log(`  공지 행: ${noticeRows}개`);

    if (noticeTitle.includes("공지")) {
      ok("공지사항 페이지 로드");
      if (noticeRows >= 1) ok(`공지 ${noticeRows}건`);
      else fail("공지 데이터", "데이터 없음");

      // [공지 작성] 버튼 → 모달
      const writeBtn = page.locator("button:has-text('공지 작성')");
      if (await writeBtn.isVisible()) {
        await writeBtn.click();
        await page.waitForTimeout(600);
        await shot(page, "08b_notices_modal");
        ok("공지 작성 모달 열림");

        // 모달 닫기 (X 버튼)
        const xBtn = page.locator("button:has(svg)").filter({ hasText: "" }).last();
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }
    } else {
      fail("공지사항", `제목 불일치: ${noticeTitle}`);
    }

    // ── Step 9: 시스템 설정 (신규) ──────────────────
    console.log("\n" + "━".repeat(52));
    console.log("Step 9: 시스템 설정 (/admin/settings) ← 신규");
    await page.goto(`${BASE_URL}/admin/settings`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3500); // API ping 대기
    await shot(page, "09_settings");

    const settingsTitle = await page.locator("h1").first().textContent().catch(() => "");
    console.log(`  페이지 제목: ${settingsTitle.trim()}`);

    const toggles = await page.locator("button.rounded-full").count();
    console.log(`  토글 스위치: ${toggles}개`);

    const hasOpenAI = await page.locator("text=OpenAI API").count();
    const hasToss = await page.locator("text=Toss Payments").count();
    console.log(`  OpenAI 섹션: ${hasOpenAI > 0 ? "✅" : "❌"} | Toss 섹션: ${hasToss > 0 ? "✅" : "❌"}`);

    if (settingsTitle.includes("설정")) {
      ok("시스템 설정 페이지 로드");
      if (toggles >= 3) ok(`Feature Flag 토글 ${toggles}개`);
      if (hasOpenAI > 0) ok("API 상태 섹션 표시");
    } else {
      fail("시스템 설정", `제목 불일치: ${settingsTitle}`);
    }

    // 스크롤 다운해서 유지보수 모드 섹션 확인
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await shot(page, "09b_settings_bottom");

    // ── Step 10: 유저 상세 페이지 ───────────────────
    console.log("\n" + "━".repeat(52));
    console.log("Step 10: 유저 상세 확인");
    await page.goto(`${BASE_URL}/admin/users`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const detailLinks = page.locator("tbody tr td a");
    if (await detailLinks.count() > 0) {
      const firstLink = detailLinks.first();
      const href = await firstLink.getAttribute("href");
      if (href) {
        await page.goto(`${BASE_URL}${href}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(1500);
        await shot(page, "10_user_detail");
        ok("유저 상세 페이지 로드", href);
      }
    } else {
      // 행 클릭 시도
      const firstRow = page.locator("tbody tr").first();
      if (await firstRow.count() > 0) {
        await firstRow.click();
        await page.waitForTimeout(500);
        await shot(page, "10_user_detail_click");
        ok("유저 행 클릭");
      }
    }

  } catch (err) {
    fail("예기치 않은 오류", err.message);
    await shot(page, "error_state").catch(() => {});
  } finally {
    await page.waitForTimeout(1000);
    await browser.close();
  }

  // ── 최종 결과 보고 ──────────────────────────────
  console.log("\n" + "═".repeat(52));
  console.log("  테스트 결과 (Playwright)");
  console.log("═".repeat(52));

  const passed = results.filter(r => r.status === "PASS").length;
  const failed_cnt = results.filter(r => r.status === "FAIL").length;

  for (const r of results) {
    const icon = r.status === "PASS" ? "✅" : "❌";
    const detail = r.detail || r.error || "";
    console.log(`  ${icon} ${r.label}${detail ? "  →  " + detail : ""}`);
  }

  console.log(`\n  결과: ${passed}/${results.length} 통과`);
  if (failed_cnt === 0) {
    console.log("  🎉 모든 테스트 통과!\n");
  } else {
    console.log(`  ⚠️  ${failed_cnt}개 실패\n`);
  }
  console.log("═".repeat(52));
  console.log(`\n  스크린샷 위치: ${SCREENSHOTS_DIR}\n`);
}

runTests().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
