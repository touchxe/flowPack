import { defineConfig } from "@playwright/test";

// SSR 컴포넌트 레이아웃 검사는 Next 서버와 운영 DB 연결이 필요하지 않다.
export default defineConfig({
  testDir: ".",
  testMatch: "settings-mobile.spec.ts",
  workers: 1,
  reporter: "list",
  use: { browserName: "chromium" },
});
