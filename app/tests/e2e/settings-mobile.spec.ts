import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// 실제 컴포넌트·CSS 기반 레이아웃 회귀 검사. 저장 API는 호출하지 않는다.
let css: string;
let outputDir: string;
test.beforeAll(() => {
  outputDir = mkdtempSync(join(tmpdir(), "flowpack-settings-"));
  const output = join(outputDir, "styles.css");
  execFileSync(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-i", "app/globals.css", "-o", output], { stdio: "pipe" });
  css = readFileSync(output, "utf8");
});
test.afterAll(() => rmSync(outputDir, { recursive: true, force: true }));

for (const width of [320, 375, 390, 768, 1024, 1440, 1536]) {
  for (const section of ["profile", "notifications", "billing", "instructions", "instructions-edit"]) {
    test(`${section}: ${width}px에서 설정 메뉴와 콘텐츠가 화면에 들어온다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const html = execFileSync(process.execPath, ["tests/e2e/settings-render.cjs", section], { encoding: "utf8" });
      await page.setContent(`<html><head><style>${css}</style></head><body>${html}</body></html>`);
      const nav = page.getByRole("navigation", { name: "설정" });
      await expect(nav).toBeVisible();
      await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1);
      for (const link of await nav.getByRole("link").all()) {
        const box = await link.boundingBox();
        if (!box) throw new Error("설정 메뉴가 표시되지 않습니다.");
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      const overflow = await page.evaluate(() => {
        const main = document.querySelector("main");
        return {
          document: document.documentElement.scrollWidth > innerWidth,
          main: main ? main.scrollWidth > main.clientWidth : true,
          clipped: Array.from(document.querySelectorAll("main input, main button, main h1")).some(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && (rect.left < 0 || rect.right > innerWidth + 1);
          }),
        };
      });
      expect(overflow).toEqual({ document: false, main: false, clipped: false });
      if (section === "profile") {
        const input = page.locator('input[type="text"]').first();
        expect((await input.boundingBox())?.width).toBeGreaterThan(200);
        await input.fill("모바일 프로필");
        await expect(input).toHaveValue("모바일 프로필");
        await expect(page.getByRole("button", { name: "변경사항 저장" })).toBeVisible();
      }
      if (section === "billing") {
        const columns = await page.getByTestId("billing-summary").evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length);
        expect(columns).toBe(width >= 1536 ? 2 : 1);
      }
      if (width === 375) await page.screenshot({ path: test.info().outputPath(`${section}-mobile.png`), fullPage: true });
    });
  }
}
