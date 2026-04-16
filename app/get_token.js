/**
 * FlowPack 관리자 페이지 API 테스트 스크립트
 * 실행: node get_token.js
 *
 * 1) credentials 로그인 → 세션 쿠키 획득
 * 2) 주요 admin API 엔드포인트 순차 호출
 * 3) 결과 요약 출력
 */

const BASE_URL = "http://localhost:3000";
const EMAIL = "admin@flowpack.dev";
const PASSWORD = "Admin1234!";

// ─── 색상 출력 헬퍼 ───────────────────────────────────
const C = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
};

// ─── 세션 쿠키 추출 헬퍼 ─────────────────────────────
function parseCookies(headers) {
  const raw = headers.getSetCookie?.() ?? [];
  return raw.join("; ");
}

// ─── API 호출 헬퍼 ───────────────────────────────────
async function apiGet(path, cookie) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Cookie: cookie },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

// ─── 결과 프린터 ─────────────────────────────────────
function printResult(label, { status, body }) {
  const ok = status >= 200 && status < 300;
  const icon = ok ? "✅" : "❌";
  const statusStr = ok ? C.green(status) : C.red(status);
  console.log(`  ${icon} ${C.bold(label.padEnd(28))} HTTP ${statusStr}`);

  if (!ok) {
    console.log(`     ${C.red("오류:")} ${JSON.stringify(body)}`);
  } else {
    // 간단 요약 출력
    const summary = summarize(label, body);
    if (summary) console.log(`     ${C.cyan(summary)}`);
  }
}

function summarize(label, body) {
  if (label.startsWith("Stats")) {
    const k = body.kpi ?? {};
    return `총 가입자 ${k.totalUsers ?? "?"}명 | 활성 구독 ${k.activeSubscriptions ?? "?"}개 | 이번 달 콘텐츠 ${k.contentsThisMonth ?? "?"}개`;
  }
  if (label.startsWith("Users")) {
    const arr = Array.isArray(body) ? body : body.users ?? [];
    return `유저 ${arr.length}명 반환`;
  }
  if (label.startsWith("Subscriptions")) {
    const arr = Array.isArray(body) ? body : body.subscriptions ?? [];
    return `구독 ${arr.length}건 반환`;
  }
  if (label.startsWith("Contents")) {
    const arr = Array.isArray(body) ? body : body.contents ?? [];
    return `콘텐츠 ${arr.length}건 반환`;
  }
  return null;
}

// ─── 메인 ────────────────────────────────────────────
async function main() {
  console.log(C.bold("\n🔍 FlowPack 관리자 API 테스트"));
  console.log("━".repeat(50));

  // 1. CSRF 토큰 획득
  console.log(`\n${C.yellow("① CSRF 토큰 획득 중...")}`);
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const csrfCookie = parseCookies(csrfRes.headers);
  console.log(`  csrfToken: ${csrfToken?.slice(0, 20)}...`);

  // 2. 로그인
  console.log(`\n${C.yellow("② 로그인 중...")} (${EMAIL})`);
  const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: csrfCookie,
    },
    body: new URLSearchParams({
      csrfToken,
      email: EMAIL,
      password: PASSWORD,
      redirect: "false",
      callbackUrl: `${BASE_URL}/admin`,
      json: "true",
    }),
    redirect: "manual",
  });

  const loginCookies = parseCookies(loginRes.headers);
  const allCookies = [csrfCookie, loginCookies].filter(Boolean).join("; ");

  // 세션 확인
  const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { Cookie: allCookies },
  });
  const session = await sessionRes.json();

  if (!session?.user?.id) {
    console.log(C.red("  ❌ 로그인 실패 — 세션 없음"));
    console.log("  loginStatus:", loginRes.status, loginRes.headers.get("location"));
    return;
  }

  const role = session.user.role;
  const roleStr = role === "ADMIN" ? C.green("ADMIN") : C.red(role ?? "USER");
  console.log(`  ✅ 로그인 성공: ${session.user.email} | role: ${roleStr}`);

  if (role !== "ADMIN") {
    console.log(C.red("\n  ⚠️  ADMIN 권한 없음 — 관리자 API 테스트 불가"));
    return;
  }

  // 3. Admin API 순차 테스트
  console.log(`\n${C.yellow("③ Admin API 엔드포인트 테스트")}`);
  console.log("─".repeat(50));

  const tests = [
    ["Stats (/api/admin/stats)",                "/api/admin/stats"],
    ["Users (/api/admin/users)",                "/api/admin/users"],
    ["Users?plan=PRO",                          "/api/admin/users?plan=PRO"],
    ["Users?search=admin",                      "/api/admin/users?search=admin"],
    ["Subscriptions (/api/admin/subscriptions)","/api/admin/subscriptions"],
    ["Contents (/api/admin/contents)",          "/api/admin/contents"],
    ["Payments (/api/admin/payments)",          "/api/admin/payments"],
    ["AI Usage (/api/admin/ai-usage)",          "/api/admin/ai-usage"],
    ["Notices (/api/admin/notices)",            "/api/admin/notices"],
    ["Settings (/api/admin/settings)",          "/api/admin/settings"],
  ];

  const results = [];
  for (const [label, path] of tests) {
    const result = await apiGet(path, allCookies);
    printResult(label, result);
    results.push({ label, ...result });
  }

  // 4. 최종 요약
  console.log("\n" + "━".repeat(50));
  const passed = results.filter(r => r.status >= 200 && r.status < 300).length;
  const failed = results.length - passed;
  console.log(
    C.bold(`\n📊 결과: ${C.green(passed + "개 통과")} / ${failed > 0 ? C.red(failed + "개 실패") : "0개 실패"} (전체 ${results.length}개)\n`)
  );

  if (failed > 0) {
    console.log(C.yellow("⚠️  실패한 엔드포인트를 확인하세요.\n"));
  } else {
    console.log(C.green("🎉 모든 관리자 API가 정상 작동합니다!\n"));
  }
}

main().catch(err => {
  console.error(C.red("\n❌ 테스트 실패:"), err.message);
  process.exit(1);
});
