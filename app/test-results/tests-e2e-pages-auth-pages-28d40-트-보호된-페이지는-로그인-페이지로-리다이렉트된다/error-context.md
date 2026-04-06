# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e/pages/auth-pages.spec.ts >> 인증 리다이렉트 테스트 >> 보호된 페이지는 로그인 페이지로 리다이렉트된다
- Location: tests/e2e/pages/auth-pages.spec.ts:36:7

# Error details

```
Error: browserType.launch: Executable doesn't exist at /var/folders/lj/ng8742rd3491ln0v7m3q6yk80000gn/T/cursor-sandbox-cache/39e9e6a9bdd4cbbd4cbad19dbfc92449/playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell
╔════════════════════════════════════════════════════════════╗
║ Looks like Playwright was just installed or updated.       ║
║ Please run the following command to download new browsers: ║
║                                                            ║
║     npx playwright install                                 ║
║                                                            ║
║ <3 Playwright Team                                         ║
╚════════════════════════════════════════════════════════════╝
```