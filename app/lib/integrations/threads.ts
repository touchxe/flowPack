import crypto from "node:crypto";

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
const THREADS_TOKEN_BASE = "https://graph.threads.net";
const THREADS_AUTH_BASE = "https://threads.net";
const THREADS_STATE_TTL_MS = 10 * 60 * 1000;
const ENCRYPTED_TOKEN_PREFIX = "enc:v1";

function getAppBaseUrl(requestUrl?: string): string {
  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim();
  if (nextAuthUrl) return nextAuthUrl.replace(/\/+$/, "");

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    const host = vercelUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    return `https://${host}`;
  }

  if (requestUrl) return new URL(requestUrl).origin;

  throw new Error("NEXTAUTH_URL 또는 요청 URL이 필요합니다.");
}

function getSecretMaterial(): string {
  const secret =
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.THREADS_APP_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET 또는 THREADS_APP_SECRET 환경변수가 필요합니다.");
  }

  return secret;
}

function getThreadsAppSecret(): string {
  const appSecret = process.env.THREADS_APP_SECRET;
  if (!appSecret) {
    throw new Error("THREADS_APP_SECRET 환경변수가 설정되지 않았습니다.");
  }
  return appSecret;
}

function signStatePayload(payload: string): string {
  return crypto
    .createHmac("sha256", getSecretMaterial())
    .update(payload)
    .digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getTokenEncryptionKey(): Buffer {
  return crypto.createHash("sha256").update(getSecretMaterial()).digest();
}

function getThreadsOAuthScopes(): string {
  const configuredScopes = process.env.THREADS_OAUTH_SCOPES?.trim();
  if (configuredScopes) return configuredScopes;

  return "threads_basic,threads_content_publish";
}

/** Threads OAuth 설정 */
export function getThreadsOAuthConfig(requestUrl?: string) {
  const appId = process.env.THREADS_APP_ID;
  const appSecret = process.env.THREADS_APP_SECRET;
  const redirectUri = `${getAppBaseUrl(requestUrl)}/api/social-accounts/callback/threads`;

  if (!appId || !appSecret) {
    throw new Error("THREADS_APP_ID와 THREADS_APP_SECRET 환경변수가 설정되지 않았습니다.");
  }

  return { appId, appSecret, redirectUri };
}

export function createThreadsOAuthState(userId: string): string {
  const payload = Buffer.from(JSON.stringify({
    userId,
    ts: Date.now(),
    nonce: crypto.randomBytes(16).toString("base64url"),
  })).toString("base64url");

  return `${payload}.${signStatePayload(payload)}`;
}

export function verifyThreadsOAuthState(state: string | null, userId: string): boolean {
  if (!state) return false;

  const [payload, signature] = state.split(".");
  if (!payload || !signature || !safeEqual(signStatePayload(payload), signature)) {
    return false;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId?: unknown;
      ts?: unknown;
    };

    return (
      parsed.userId === userId &&
      typeof parsed.ts === "number" &&
      Date.now() - parsed.ts <= THREADS_STATE_TTL_MS
    );
  } catch {
    return false;
  }
}

export function encryptThreadsToken(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getTokenEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTED_TOKEN_PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function decryptThreadsToken(storedToken: string): string | null {
  if (!storedToken.startsWith(`${ENCRYPTED_TOKEN_PREFIX}.`)) {
    return storedToken;
  }

  const [, ivText, tagText, encryptedText] = storedToken.split(".");
  if (!ivText || !tagText || !encryptedText) return null;

  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getTokenEncryptionKey(),
      Buffer.from(ivText, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedText, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/** OAuth 인증 URL 생성 */
export function buildThreadsOAuthUrl(state: string, requestUrl?: string): string {
  const { appId, redirectUri } = getThreadsOAuthConfig(requestUrl);
  const scopes = getThreadsOAuthScopes();

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: scopes,
    response_type: "code",
    state,
  });

  return `${THREADS_AUTH_BASE}/oauth/authorize?${params.toString()}`;
}

/** OAuth code → access token 교환 */
export async function exchangeThreadsCodeForToken(
  code: string,
  requestUrl?: string
): Promise<{ accessToken: string; userId: string } | null> {
  const { appId, appSecret, redirectUri } = getThreadsOAuthConfig(requestUrl);

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
  const appSecret = getThreadsAppSecret();

  const params = new URLSearchParams({
    grant_type: "th_exchange_token",
    client_secret: appSecret,
    access_token: shortToken,
  });

  const res = await fetch(`${THREADS_TOKEN_BASE}/access_token?${params.toString()}`);
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
  const decryptedToken = decryptThreadsToken(accessToken);
  if (!decryptedToken) return null;

  const parts = decryptedToken.split("||");
  if (parts.length === 3) {
    return { userId: parts[0], accessToken: parts[1], username: parts[2] };
  }
  // 레거시: 단순 토큰 형식
  if (decryptedToken && !decryptedToken.includes("||")) {
    return { userId: accountName, accessToken: decryptedToken, username: accountName };
  }
  return null;
}
