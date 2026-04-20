/**
 * Threads API 연동 라이브러리
 * - Instagram과 별도 앱 사용 (graph.threads.net)
 * - 인증: Threads OAuth 2.0
 * - 문서: https://developers.facebook.com/docs/threads
 *
 * ⚠️ 환경변수 필요:
 *   THREADS_APP_ID=<Threads 앱 ID>
 *   THREADS_APP_SECRET=<Threads 앱 시크릿>
 *   NEXTAUTH_URL=https://flow-pack.vercel.app
 */

const THREADS_BASE = "https://graph.threads.net/v1.0";

/** Threads OAuth 설정 */
export function getThreadsOAuthConfig() {
  const appId = process.env.THREADS_APP_ID;
  const appSecret = process.env.THREADS_APP_SECRET;
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/social-accounts/callback/threads`;

  if (!appId || !appSecret) {
    throw new Error("THREADS_APP_ID와 THREADS_APP_SECRET 환경변수가 설정되지 않았습니다.");
  }

  return { appId, appSecret, redirectUri };
}

/** OAuth 인증 URL 생성 */
export function buildThreadsOAuthUrl(state: string): string {
  const { appId, redirectUri } = getThreadsOAuthConfig();

  const scopes = [
    "threads_basic",
    "threads_content_publish",
    "threads_read_replies",
    "threads_manage_replies",
    "threads_manage_insights",
  ].join(",");

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: scopes,
    response_type: "code",
    state,
  });

  return `https://threads.net/oauth/authorize?${params.toString()}`;
}

/** OAuth code → access token 교환 */
export async function exchangeThreadsCodeForToken(
  code: string
): Promise<{ accessToken: string; userId: string } | null> {
  const { appId, appSecret, redirectUri } = getThreadsOAuthConfig();

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://graph.threads.net/oauth/access_token", {
    method: "POST",
    body: params,
  });

  if (!res.ok) return null;
  const data = await res.json() as { access_token?: string; user_id?: string };
  if (!data.access_token || !data.user_id) return null;

  return { accessToken: data.access_token, userId: String(data.user_id) };
}

/** 단기 토큰 → 장기 토큰 교환 (60일) */
export async function exchangeThreadsLongLivedToken(
  shortToken: string
): Promise<{ accessToken: string; expiresIn: number } | null> {
  const { appSecret } = getThreadsOAuthConfig();

  const params = new URLSearchParams({
    grant_type: "th_exchange_token",
    client_secret: appSecret,
    access_token: shortToken,
  });

  const res = await fetch(`${THREADS_BASE}/access_token?${params.toString()}`);
  if (!res.ok) return null;

  const data = await res.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;

  return { accessToken: data.access_token, expiresIn: data.expires_in ?? 5183944 };
}

/** 사용자 프로필 조회 */
export async function getThreadsUserProfile(
  userId: string,
  accessToken: string
): Promise<{ username: string; name?: string } | null> {
  const res = await fetch(
    `${THREADS_BASE}/${userId}?fields=id,username,name&access_token=${accessToken}`
  );
  if (!res.ok) return null;

  const data = await res.json() as { username?: string; name?: string };
  return { username: data.username ?? userId, name: data.name };
}

/* ─── 게시물 발행 ─────────────────────────────────────── */

/**
 * Step 1: 텍스트 전용 컨테이너 생성
 */
export async function createThreadsTextContainer(
  userId: string,
  accessToken: string,
  text: string
): Promise<{ containerId: string } | { error: string }> {
  const res = await fetch(`${THREADS_BASE}/${userId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "TEXT",
      text,
      access_token: accessToken,
    }),
  });

  const data = await res.json() as { id?: string; error?: { message: string } };
  if (!res.ok || !data.id) {
    return { error: data.error?.message ?? `컨테이너 생성 실패 (HTTP ${res.status})` };
  }
  return { containerId: data.id };
}

/**
 * Step 1b: 이미지 컨테이너 생성
 */
export async function createThreadsImageContainer(
  userId: string,
  accessToken: string,
  imageUrl: string,
  text: string
): Promise<{ containerId: string } | { error: string }> {
  const res = await fetch(`${THREADS_BASE}/${userId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "IMAGE",
      image_url: imageUrl,
      text,
      access_token: accessToken,
    }),
  });

  const data = await res.json() as { id?: string; error?: { message: string } };
  if (!res.ok || !data.id) {
    return { error: data.error?.message ?? `이미지 컨테이너 생성 실패 (HTTP ${res.status})` };
  }
  return { containerId: data.id };
}

/**
 * Step 1c: 캐러셀 컨테이너 생성 (이미지 최대 10장)
 */
export async function createThreadsCarouselContainer(
  userId: string,
  accessToken: string,
  imageUrls: string[],
  text: string
): Promise<{ containerId: string } | { error: string }> {
  if (imageUrls.length < 2 || imageUrls.length > 10) {
    return { error: "캐러셀은 이미지 2~10장이 필요합니다." };
  }

  // 개별 이미지 아이템 컨테이너 생성
  const childIds: string[] = [];
  for (const url of imageUrls) {
    const res = await fetch(`${THREADS_BASE}/${userId}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "IMAGE",
        image_url: url,
        is_carousel_item: true,
        access_token: accessToken,
      }),
    });
    const data = await res.json() as { id?: string; error?: { message: string } };
    if (!data.id) return { error: data.error?.message ?? "캐러셀 아이템 생성 실패" };
    childIds.push(data.id);
  }

  // 캐러셀 부모 컨테이너 생성
  const res = await fetch(`${THREADS_BASE}/${userId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "CAROUSEL",
      children: childIds.join(","),
      text,
      access_token: accessToken,
    }),
  });

  const data = await res.json() as { id?: string; error?: { message: string } };
  if (!data.id) return { error: data.error?.message ?? "캐러셀 컨테이너 생성 실패" };
  return { containerId: data.id };
}

/**
 * Step 2: 컨테이너를 Threads 피드에 발행
 */
export async function publishThreadsContainer(
  userId: string,
  accessToken: string,
  containerId: string
): Promise<{ postId: string; postUrl?: string } | { error: string }> {
  const res = await fetch(`${THREADS_BASE}/${userId}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: accessToken,
    }),
  });

  const data = await res.json() as { id?: string; error?: { message: string } };
  if (!res.ok || !data.id) {
    return { error: data.error?.message ?? `발행 실패 (HTTP ${res.status})` };
  }

  // 게시물 permalink 조회
  const postRes = await fetch(
    `${THREADS_BASE}/${data.id}?fields=permalink&access_token=${accessToken}`
  );
  const postData = await postRes.json() as { permalink?: string };

  return { postId: data.id, postUrl: postData.permalink };
}

/* ─── 캡션 빌더 ─────────────────────────────────────────── */

/**
 * Threads용 캡션 생성
 * - 최대 500자 (Instagram보다 짧음)
 */
export function buildThreadsCaption(
  title: string,
  body: string | null,
  tone: string | null
): string {
  void tone; // 향후 톤 활용
  const maxLength = 480;
  let caption = `${title}\n\n`;

  if (body) {
    const plainText = body.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    caption += plainText.length > 200
      ? plainText.slice(0, 200) + "..."
      : plainText;
    caption += "\n\n";
  }

  caption += "#FlowPack #AI마케팅";
  return caption.slice(0, maxLength);
}

/* ─── 자격증명 파싱 ──────────────────────────────────────── */

export interface ThreadsCredentials {
  userId: string;
  accessToken: string;
  username: string;
}

/**
 * SocialAccount.accessToken에서 Threads 자격증명 파싱
 * 저장 형식: "userId||accessToken||username"
 */
export function parseThreadsCredentials(
  accessToken: string,
  accountName: string
): ThreadsCredentials | null {
  const parts = accessToken.split("||");
  if (parts.length === 3) {
    return { userId: parts[0], accessToken: parts[1], username: parts[2] };
  }
  // 레거시: 단순 토큰 형식
  if (accessToken && !accessToken.includes("||")) {
    return { userId: accountName, accessToken, username: accountName };
  }
  return null;
}
