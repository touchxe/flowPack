import crypto from "node:crypto";

/**
 * Facebook Pages API 연동 라이브러리
 * - 인증: Facebook Login OAuth 2.0
 * - 연동 대상: 사용자가 관리 권한을 가진 Facebook Page
 * - 발행: Page access token으로 /feed 또는 /photos에 게시
 */

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const FACEBOOK_AUTH_BASE = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
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
    process.env.FACEBOOK_APP_SECRET ??
    process.env.META_APP_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET 또는 FACEBOOK_APP_SECRET 환경변수가 필요합니다.");
  }

  return secret;
}

function getFacebookOAuthScopes(): string {
  const configuredScopes = process.env.FACEBOOK_OAUTH_SCOPES?.trim();
  if (configuredScopes) return configuredScopes;

  return "pages_show_list,pages_read_engagement,pages_manage_posts";
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

function getFacebookAppSecret(): string {
  const appSecret = process.env.FACEBOOK_APP_SECRET ?? process.env.META_APP_SECRET;
  if (!appSecret) {
    throw new Error("FACEBOOK_APP_SECRET 또는 META_APP_SECRET 환경변수가 설정되지 않았습니다.");
  }
  return appSecret;
}

export function getFacebookOAuthConfig(requestUrl?: string): {
  appId: string;
  appSecret: string;
  redirectUri: string;
} {
  const appId = process.env.FACEBOOK_APP_ID ?? process.env.META_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET ?? process.env.META_APP_SECRET;
  const redirectUri = `${getAppBaseUrl(requestUrl)}/api/social-accounts/callback/facebook`;

  if (!appId || !appSecret) {
    throw new Error("FACEBOOK_APP_ID와 FACEBOOK_APP_SECRET 환경변수가 설정되지 않았습니다.");
  }

  return { appId, appSecret, redirectUri };
}

export function createFacebookOAuthState(userId: string): string {
  const payload = Buffer.from(JSON.stringify({
    userId,
    ts: Date.now(),
    nonce: crypto.randomBytes(16).toString("base64url"),
  })).toString("base64url");

  return `${payload}.${signStatePayload(payload)}`;
}

export function verifyFacebookOAuthState(state: string | null, userId: string): boolean {
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

export function encryptFacebookToken(plainText: string): string {
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

function decryptFacebookToken(storedToken: string): string | null {
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

export function buildFacebookOAuthUrl(state: string, requestUrl?: string): string {
  const { appId, redirectUri } = getFacebookOAuthConfig(requestUrl);
  const scopes = getFacebookOAuthScopes();

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    state,
  });

  return `${FACEBOOK_AUTH_BASE}?${params.toString()}`;
}

export async function exchangeFacebookCodeForToken(
  code: string,
  requestUrl?: string
): Promise<{ accessToken: string; expiresIn?: number } | null> {
  const { appId, appSecret, redirectUri } = getFacebookOAuthConfig(requestUrl);

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`);
  if (!res.ok) return null;

  const data = await res.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;

  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export async function exchangeFacebookLongLivedToken(
  shortToken: string
): Promise<{ accessToken: string; expiresIn?: number } | null> {
  const { appId } = getFacebookOAuthConfig();
  const appSecret = getFacebookAppSecret();

  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortToken,
  });

  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`);
  if (!res.ok) return null;

  const data = await res.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;

  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export interface FacebookPage {
  id: string;
  name: string;
  accessToken: string;
}

export async function getFacebookPages(userAccessToken: string): Promise<FacebookPage[]> {
  const params = new URLSearchParams({
    fields: "id,name,access_token",
    access_token: userAccessToken,
  });

  const res = await fetch(`${GRAPH_BASE}/me/accounts?${params.toString()}`);
  if (!res.ok) return [];

  const data = await res.json() as {
    data?: Array<{ id?: string; name?: string; access_token?: string }>;
  };

  return (data.data ?? [])
    .filter((page): page is { id: string; name: string; access_token: string } =>
      Boolean(page.id && page.name && page.access_token)
    )
    .map(page => ({
      id: page.id,
      name: page.name,
      accessToken: page.access_token,
    }));
}

export interface FacebookCredentials {
  pageId: string;
  pageAccessToken: string;
  pageName: string;
}

export function parseFacebookCredentials(
  storedToken: string,
  accountName: string
): FacebookCredentials | null {
  const decryptedToken = decryptFacebookToken(storedToken);
  if (!decryptedToken) return null;

  const parts = decryptedToken.split("||");
  if (parts.length === 3) {
    return {
      pageId: parts[0],
      pageAccessToken: parts[1],
      pageName: parts[2],
    };
  }

  if (decryptedToken && !decryptedToken.includes("||")) {
    return {
      pageId: accountName,
      pageAccessToken: decryptedToken,
      pageName: accountName,
    };
  }

  return null;
}

export function buildFacebookMessage(title: string, body: string | null): string {
  const plainText = body?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const message = plainText ? `${title}\n\n${plainText}` : title;
  return message.slice(0, 5000);
}

export async function publishFacebookFeedPost(
  pageId: string,
  pageAccessToken: string,
  message: string
): Promise<{ postId: string; postUrl?: string } | { error: string }> {
  const res = await fetch(`${GRAPH_BASE}/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      access_token: pageAccessToken,
    }),
  });

  const data = await res.json() as { id?: string; error?: { message?: string } };
  if (!res.ok || !data.id) {
    return { error: data.error?.message ?? `Facebook 게시 실패 (HTTP ${res.status})` };
  }

  return {
    postId: data.id,
    postUrl: `https://www.facebook.com/${data.id}`,
  };
}

export async function publishFacebookPhotoPost(
  pageId: string,
  pageAccessToken: string,
  imageUrl: string,
  caption: string
): Promise<{ postId: string; postUrl?: string } | { error: string }> {
  const res = await fetch(`${GRAPH_BASE}/${pageId}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: imageUrl,
      caption,
      access_token: pageAccessToken,
    }),
  });

  const data = await res.json() as {
    id?: string;
    post_id?: string;
    error?: { message?: string };
  };

  if (!res.ok || (!data.id && !data.post_id)) {
    return { error: data.error?.message ?? `Facebook 사진 게시 실패 (HTTP ${res.status})` };
  }

  const postId = data.post_id ?? data.id ?? "";
  return {
    postId,
    postUrl: postId ? `https://www.facebook.com/${postId}` : undefined,
  };
}
