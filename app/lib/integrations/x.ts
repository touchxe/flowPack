import crypto from "crypto";
import { decryptSocialToken } from "@/lib/social-token-crypto";

const X_AUTH_BASE = "https://twitter.com/i/oauth2/authorize";
const X_API_BASE = "https://api.twitter.com/2";

export interface XOAuthConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
}

export function getXOAuthConfig(): XOAuthConfig {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/social-accounts/callback/twitter`;

  if (!clientId) {
    throw new Error("TWITTER_CLIENT_ID 환경변수가 설정되지 않았습니다.");
  }

  return { clientId, clientSecret, redirectUri };
}

export function createXCodeVerifier(): string {
  return crypto.randomBytes(48).toString("base64url");
}

export function createXCodeChallenge(codeVerifier: string): string {
  return crypto.createHash("sha256").update(codeVerifier).digest("base64url");
}

export function buildXOAuthUrl(state: string, codeVerifier: string): string {
  const { clientId, redirectUri } = getXOAuthConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "tweet.read users.read tweet.write offline.access",
    state,
    code_challenge: createXCodeChallenge(codeVerifier),
    code_challenge_method: "S256",
  });

  return `${X_AUTH_BASE}?${params.toString()}`;
}

export async function exchangeXCodeForToken(
  code: string,
  codeVerifier: string
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number } | null> {
  const { clientId, clientSecret, redirectUri } = getXOAuthConfig();
  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const headers: HeadersInit = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  }

  const res = await fetch(`${X_API_BASE}/oauth2/token`, {
    method: "POST",
    headers,
    body: body.toString(),
  });
  if (!res.ok) return null;

  const data = await res.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) return null;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export async function getXUserProfile(
  accessToken: string
): Promise<{ id: string; username: string; name?: string } | null> {
  const res = await fetch(`${X_API_BASE}/users/me?user.fields=username,name`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;

  const data = await res.json() as {
    data?: { id?: string; username?: string; name?: string };
  };
  if (!data.data?.id || !data.data.username) return null;

  return {
    id: data.data.id,
    username: data.data.username,
    name: data.data.name,
  };
}

export interface XCredentials {
  userId: string;
  accessToken: string;
  username: string;
}

export function parseXCredentials(
  storedToken: string,
  accountName: string
): XCredentials | null {
  const token = decryptSocialToken(storedToken);
  const parts = token.split("||");
  if (parts.length === 3) {
    return { userId: parts[0], accessToken: parts[1], username: parts[2] };
  }
  if (token && !token.includes("||")) {
    return { userId: accountName, accessToken: token, username: accountName };
  }
  return null;
}
