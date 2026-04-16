/**
 * 네이버 블로그 검색 셀렉터 진단 (결과 파일 저장)
 */
import { chromium } from "playwright";
import { addExtra } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const log = [];
  const out = (msg) => { console.log(msg); log.push(msg); };

  const chromiumExtra = addExtra(chromium);
  chromiumExtra.use(StealthPlugin());

  const browser = await chromiumExtra.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled", "--window-size=1280,900"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    window.chrome = { runtime: {} };
  });

  const page = await context.newPage();

  const url = "https://search.naver.com/search.naver?where=blog&query=" + encodeURIComponent("서울 카페 마케팅 후기");
  out("URL: " + url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  await sleep(4000); // JS 렌더링 대기

  // 셀렉터 테스트
  const selectorTests = [
    ".api_txt_lines.total_tit",
    ".title_area a",
    "a.title_link",
    "a[href*='blog.naver.com']",
    ".link_title a",
    ".total_tit",
    ".api_subject_bx a",
    "[class*='title'] a[href*='blog']",
    "div.fds-comps-right-image-text-title a",
    ".sds-comps-text-ellipsis",
    "li.bx",
    ".blog_type",
    ".total_wrap li",
    "ul.lst_total > li",
    "#main_pack .bx",
  ];

  out("\n=== 셀렉터 테스트 결과 ===");
  for (const sel of selectorTests) {
    const count = await page.$$eval(sel, els => els.length).catch(() => 0);
    const sample = count > 0
      ? await page.$eval(sel, el => el.textContent?.trim().replace(/\s+/g,' ').slice(0, 80) ?? "").catch(() => "")
      : "";
    out(`[${count > 0 ? "O" : "X"}] "${sel}" count=${count}${sample ? ` => "${sample}"` : ""}`);
  }

  // a[href*='blog.naver.com'] 상세
  out("\n=== 블로그 링크 a태그 상세 ===");
  const blogLinks = await page.$$eval(
    "a[href*='blog.naver.com']",
    els => els.slice(0, 12).map(el => ({
      text: el.textContent?.trim().replace(/\s+/g,' ').slice(0, 80) ?? "",
      href: el.href?.slice(0, 90) ?? "",
      cls: el.className?.slice(0, 60) ?? "",
      parentTag: el.parentElement?.tagName ?? "",
      parentCls: el.parentElement?.className?.slice(0, 60) ?? "",
      grandParentCls: el.parentElement?.parentElement?.className?.slice(0, 60) ?? "",
    }))
  ).catch(() => []);

  blogLinks.forEach((l, i) => {
    if (l.text || l.href) {
      out(`[${i+1}] text: "${l.text}"`);
      out(`     cls: "${l.cls}"`);
      out(`     parent: <${l.parentTag}> "${l.parentCls}"`);
      out(`     grand: "${l.grandParentCls}"`);
      out(`     href: ${l.href}`);
    }
  });

  // 결과 저장
  const outputDir = path.join(__dirname, "output");
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, "selector-analysis.txt"), log.join("\n"), "utf8");
  out("\n저장: scripts/output/selector-analysis.txt");

  await sleep(1000);
  await browser.close();
}

main().catch(e => { console.error("오류:", e.message); process.exit(1); });
