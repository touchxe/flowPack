import { defineConfig } from "@playwright/test";

const port = 3002;
const baseURL = `http://127.0.0.1:${port}`;
const projectRoot = process.cwd();
const nextCommand = `${process.execPath} node_modules/next/dist/bin/next ${process.env.CI ? "start" : "dev"} -H 127.0.0.1 -p ${port}`;

export default defineConfig({
  testDir: ".",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
      },
    },
  ],
  webServer: {
    command: nextCommand,
    cwd: projectRoot,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
