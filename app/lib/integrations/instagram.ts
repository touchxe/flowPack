import crypto from "node:crypto";

/**
 * Instagram API with Instagram Login 연동 라이브러리
 * - 인증: Instagram Login (Meta OAuth 2.0) — 개인/크리에이터/비즈니스 계정 지원
 * - 발행: 크리에이터 또는 비즈니스 계정 필요
 * - 참고: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
 *
 * ⚠️ 환경변수 필요 (.env.local):
 *   META_APP_ID=<Meta 앱 ID>
 *   META_APP_SECRET=<Meta 앱 시크릿>
 *   NEXTAUTH_URL=http://localhost:3000  (또는 프로덕션 URL)
 */

/** Graph API 베이스 (Instagram Login 토큰용) */
const GRAPH_BASE = "https://graph.instagram.com/v21.0";

/** 장기 토큰 교환은 버전 없는 엔드포인트 사용 */
const GRAPH_TOKEN_BASE = "https://graph.instagram.com";

/** Instagram OAuth 인증 화면 */
const IG_AUTH_BASE = "https://www.instagram.com";

/** Instagram OAuth 베이스 (인증 코드 교환용) */
const IG_API_BASE = "https://api.instagram.com";

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
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
    process.env.META_APP_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET 또는 META_APP_SECRET 환경변수가 필요합니다.");
  }

  return secret;
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

function getMetaAppSecret(): string {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    throw new Error("META_APP_SECRET 환경변수가 설정되지 않았습니다.");
  }
  return appSecret;
}

/* ─── 설정 ────────────────────────────────────────────────── */

/** Meta OAuth 설정 조회 */
export function getMetaOAuthConfig(requestUrl?: string) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = `${getAppBaseUrl(requestUrl)}/api/social-accounts/callback/instagram`;

  if (!appId || !appSecret) {
    throw new Error("META_APP_ID와 META_APP_SECRET 환경변수가 설정되지 않았습니다.");
  }

  return { appId, appSecret, redirectUri };
}

export function createInstagramOAuthState(userId: string): string {
  const payload = Buffer.from(JSON.stringify({
    userId,
    ts: Date.now(),
    nonce: crypto.randomBytes(16).toString("base64url"),
  })).toString("base64url");

  return `${payload}.${signStatePayload(payload)}`;
}

export function verifyInstagramOAuthState(state: string | null, userId: string): boolean {
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
      Date.now() - parsed.ts <= OAUTH_STATE_TTL_MS
    );
  } catch {
    return false;
  }
}

export function encryptSocialAccountToken(plainText: string): string {
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

function decryptSocialAccountToken(storedToken: string): string | null {
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

/* ─── OAuth 흐름 ──────────────────────────────────────────── */

/**
 * Instagram Login OAuth 인증 URL 생성
 * - 개인/크리에이터/비즈니스 계정 모두 로그인 가능
 * - 발행 권한(instagram_business_content_publish)은 크리에이터/비즈니스만 작동
 */
export function buildInstagramOAuthUrl(state: string, requestUrl?: string): string {
  const { appId, redirectUri } = getMetaOAuthConfig(requestUrl);

  const scopes = [
    "instagram_business_basic",
    "instagram_business_content_publish",
  ].join(",");

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: scopes,
    response_type: "code",
    state,
    enable_fb_login: "0",
    force_authentication: "1",
  });

  return `${IG_AUTH_BASE}/oauth/authorize?${params.toString()}`;
}

/**
 * OAuth code → 단기 액세스 토큰 교환
 * - POST https://api.instagram.com/oauth/access_token
 */
export async function exchangeCodeForToken(
  code: string,
  requestUrl?: string
): Promise<{ accessToken: string; userId: string } | null> {
  const { appId, appSecret, redirectUri } = getMetaOAuthConfig(requestUrl);

  console.log("[IG-DEBUG] 단기 토큰 교환 시작", { redirectUri, codeLen: code.length });

  const formData = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(`${IG_API_BASE}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[IG-DEBUG] 단기 토큰 교환 실패 (HTTP", res.status, "):", err);
    return null;
  }

  const data = await res.json() as { access_token?: string; user_id?: number; error_message?: string };
  console.log("[IG-DEBUG] 단기 토큰 응답:", { hasToken: !!data.access_token, userId: data.user_id, error: data.error_message });
  if (!data.access_token) return null;

  return {
    accessToken: data.access_token,
    userId: String(data.user_id ?? ""),
  };
}

/**
 * 단기 토큰 → 장기 토큰 교환 (60일)
 * - GET https://graph.instagram.com/access_token  (버전 없음 — Meta 스펙)
 */
export async function exchangeForLongLivedToken(
  shortToken: string
): Promise<{ accessToken: string; expiresIn: number } | null> {
  const appSecret = getMetaAppSecret();

  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: appSecret,
    access_token: shortToken,
  });

  // ⚠️ 장기 토큰 엔드포인트는 버전 없는 URL 사용
  const url = `${GRAPH_TOKEN_BASE}/access_token?${params.toString()}`;
  console.log("[IG-DEBUG] 장기 토큰 교환 시작:", url.replace(shortToken, "TOKEN_HIDDEN"));

  const res = await fetch(url);

  if (!res.ok) {
    const err = await res.text();
    console.error("[IG-DEBUG] 장기 토큰 교환 실패 (HTTP", res.status, "):", err);
    return null;
  }

  const data = await res.json() as { access_token?: string; expires_in?: number; error_message?: string };
  console.log("[IG-DEBUG] 장기 토큰 응답:", { hasToken: !!data.access_token, expiresIn: data.expires_in, error: data.error_message });
  if (!data.access_token) return null;

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in ?? 5183944, // ~60일
  };
}

/**
 * Instagram 사용자 프로필 조회
 * - GET https://graph.instagram.com/v21.0/me
 */
export async function getInstagramUserProfile(
  accessToken: string
): Promise<{ id: string; username: string; accountType: string } | null> {
  const url = `${GRAPH_BASE}/me?fields=user_id,username,account_type&access_token=${accessToken}`;
  console.log("[IG-DEBUG] 프로필 조회 시작:", url.replace(accessToken, "TOKEN_HIDDEN"));

  const res = await fetch(url);

  if (!res.ok) {
    const err = await res.text();
    console.error("[IG-DEBUG] 프로필 조회 실패 (HTTP", res.status, "):", err);
    return null;
  }

  const data = await res.json() as {
    id?: string;
    user_id?: string | number;
    username?: string;
    account_type?: string;
    error?: { message: string; type: string; code: number };
  };

  const instagramUserId = data.user_id ? String(data.user_id) : data.id;

  console.log("[IG-DEBUG] 프로필 응답:", { id: instagramUserId, username: data.username, accountType: data.account_type, error: data.error });

  if (!instagramUserId || !data.username) {
    console.error("[IG-DEBUG] 프로필 필드 누락 — account_type:", data.account_type, "| 개인계정은 크리에이터 전환 필요");
    return null;
  }

  return {
    id: instagramUserId,
    username: data.username,
    accountType: data.account_type ?? "PERSONAL",
  };
}

/* ─── 2-Step Publishing (크리에이터/비즈니스 계정 전용) ────── */

/**
 * Step 1: 이미지 미디어 컨테이너 생성
 * - imageUrl: 공개 접근 가능한 이미지 URL
 * - caption: 게시물 캡션 (#태그 포함)
 */
export async function createMediaContainer(
  igUserId: string,
  accessToken: string,
  imageUrl: string,
  caption: string
): Promise<{ containerId: string } | { error: string }> {
  const res = await fetch(`${GRAPH_BASE}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: imageUrl,
      caption,
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
 * Step 1b: 동영상 미디어 컨테이너 생성 (Reels)
 */
export async function createVideoContainer(
  igUserId: string,
  accessToken: string,
  videoUrl: string,
  caption: string,
  coverUrl?: string
): Promise<{ containerId: string } | { error: string }> {
  const payload: Record<string, string> = {
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    access_token: accessToken,
  };
  if (coverUrl) payload.cover_url = coverUrl;

  const res = await fetch(`${GRAPH_BASE}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json() as { id?: string; error?: { message: string } };

  if (!res.ok || !data.id) {
    return { error: data.error?.message ?? `동영상 컨테이너 생성 실패 (HTTP ${res.status})` };
  }

  return { containerId: data.id };
}

/**
 * 컨테이너 상태 확인 (FINISHED 될 때까지 폴링)
 * - 동영상은 처리에 시간이 걸릴 수 있음
 */
export async function waitForContainerReady(
  containerId: string,
  accessToken: string,
  maxAttempts = 12,
  intervalMs = 5000
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${GRAPH_BASE}/${containerId}?fields=status_code&access_token=${accessToken}`
    );
    const data = await res.json() as { status_code?: string };

    if (data.status_code === "FINISHED") return true;
    if (data.status_code === "ERROR") return false;

    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}

/**
 * Step 2: 컨테이너를 Instagram 피드에 발행
 */
export async function publishContainer(
  igUserId: string,
  accessToken: string,
  containerId: string
): Promise<{ postId: string; postUrl?: string } | { error: string }> {
  const res = await fetch(`${GRAPH_BASE}/${igUserId}/media_publish`, {
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

  // 발행된 포스트 permalink 조회
  const postRes = await fetch(
    `${GRAPH_BASE}/${data.id}?fields=permalink&access_token=${accessToken}`
  );
  const postData = await postRes.json() as { permalink?: string };

  return { postId: data.id, postUrl: postData.permalink };
}

/* ─── 캐러셀 게시물 ──────────────────────────────────────── */

/**
 * 캐러셀(슬라이드) 컨테이너 생성
 * - images: 이미지 URL 배열 (2~10장)
 */
export async function createCarouselContainer(
  igUserId: string,
  accessToken: string,
  imageUrls: string[],
  caption: string
): Promise<{ containerId: string } | { error: string }> {
  if (imageUrls.length < 2 || imageUrls.length > 10) {
    return { error: "캐러셀은 이미지 2~10장이 필요합니다." };
  }

  // 각 이미지를 개별 컨테이너로 생성
  const childIds: string[] = [];
  for (const imgUrl of imageUrls) {
    const res = await fetch(`${GRAPH_BASE}/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imgUrl,
        is_carousel_item: true,
        access_token: accessToken,
      }),
    });
    const data = await res.json() as { id?: string; error?: { message: string } };
    if (!data.id) return { error: data.error?.message ?? "캐러셀 아이템 생성 실패" };
    childIds.push(data.id);
  }

  // 캐러셀 부모 컨테이너 생성
  const res = await fetch(`${GRAPH_BASE}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "CAROUSEL",
      children: childIds.join(","),
      caption,
      access_token: accessToken,
    }),
  });

  const data = await res.json() as { id?: string; error?: { message: string } };
  if (!data.id) return { error: data.error?.message ?? "캐러셀 컨테이너 생성 실패" };

  return { containerId: data.id };
}

/* ─── 캡션 생성 ──────────────────────────────────────────── */

/**
 * FlowPack 콘텐츠 → Instagram 캡션 변환
 */
export function buildInstagramCaption(
  title: string,
  body: string | null,
  tone: string | null
): string {
  void tone; // 향후 톤별 해시태그 분기용
  const maxLength = 2000;
  let caption = `${title}\n\n`;

  if (body) {
    const plainText = body.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    caption += plainText.length > 300
      ? plainText.slice(0, 300) + "..."
      : plainText;
    caption += "\n\n";
  }

  caption += "#FlowPack #AI마케팅 #콘텐츠자동화";
  return caption.slice(0, maxLength);
}

/* ─── SocialAccount 자격증명 파싱 ───────────────────────── */

export interface InstagramCredentials {
  igUserId: string;
  accessToken: string;
  username: string;
}

/**
 * SocialAccount.accessToken에서 Instagram 자격 증명 파싱
 * 저장 형식: "igUserId||accessToken||username"
 */
export function parseInstagramCredentials(
  storedToken: string,
  accountName: string
): InstagramCredentials | null {
  const decryptedToken = decryptSocialAccountToken(storedToken);
  if (!decryptedToken) return null;

  const parts = decryptedToken.split("||");
  if (parts.length === 3) {
    return {
      igUserId: parts[0],
      accessToken: parts[1],
      username: parts[2],
    };
  }
  // 레거시 형식 (accessToken만 있는 경우) 하위 호환
  if (decryptedToken && !decryptedToken.includes("||")) {
    return {
      igUserId: accountName,
      accessToken: decryptedToken,
      username: accountName,
    };
  }
  return null;
}

/* ─── 이전 버전 호환 래퍼 ────────────────────────────────── */
// publish 라우트 등 기존 코드에서 pageAccessToken을 참조하는 경우를 위한 타입 별칭

/** @deprecated parseInstagramCredentials 사용 권장 */
export type LegacyInstagramCredentials = {
  igAccountId: string;
  pageAccessToken: string;
  username: string;
};
