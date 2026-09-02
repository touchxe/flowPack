import { test, expect } from "@playwright/test";

/**
 * 공개 페이지 테스트
 */

test.describe("로그인 페이지", () => {
  test("페이지가 정상 로드된다", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/FlowPack/);
    await expect(page.getByRole("heading", { name: /로그인/i })).toBeVisible({ timeout: 10000 });
  });

  test("폼 요소들이 존재한다", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("아이디 또는 이메일")).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.getByRole("button", { name: /로그인/i })).toBeVisible();
  });

  test("소셜 로그인 설정 오류를 화면에 안내한다", async ({ page }) => {
    await page.goto("/login?error=Configuration");
    await expect(page.getByText(/소셜 로그인 설정 또는 계정 연결 처리 중 오류/)).toBeVisible({ timeout: 10000 });
  });
});

test.describe("회원가입 페이지", () => {
  test("페이지가 정상 로드된다", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: /회원가입/i })).toBeVisible({ timeout: 10000 });
  });

  test("폼 요소들이 존재한다", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByLabel("이메일")).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel(/아이디/)).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });
});

test.describe("인증 리다이렉트 테스트", () => {
  test("보호된 페이지는 로그인 페이지로 리다이렉트된다", async ({ page }) => {
    await page.goto("/home");
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  });

  test("요금제 페이지는 접근 가능하다", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page).not.toHaveURL(/login/, { timeout: 10000 });
  });
});
