import { decryptSocialToken } from "@/lib/social-token-crypto";

const LINKEDIN_AUTH_BASE = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

export function getLinkedInOAuthConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/social-accounts/callback/linkedin`;

  if (!clientId || !clientSecret) {
    throw new Error("LINKEDIN_CLIENT_ID와 LINKEDIN_CLIENT_SECRET 환경변수가 설정되지 않았습니다.");
  }

  return { clientId, clientSecret, redirectUri };
}

export function buildLinkedInOAuthUrl(state: string): string {
  const { clientId, redirectUri } = getLinkedInOAuthConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "openid profile w_member_social",
    state,
  });

  return `${LINKEDIN_AUTH_BASE}?${params.toString()}`;
}

export async function exchangeLinkedInCodeForToken(
  code: string
): Promise<{ accessToken: string; expiresIn?: number } | null> {
  const { clientId, clientSecret, redirectUri } = getLinkedInOAuthConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) return null;

  const data = await res.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;

  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export async function getLinkedInProfile(
  accessToken: string
): Promise<{ id: string; name: string } | null> {
  const res = await fetch(LINKEDIN_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;

  const data = await res.json() as { sub?: string; name?: string; given_name?: string };
  if (!data.sub) return null;

  return {
    id: data.sub,
    name: data.name ?? data.given_name ?? data.sub,
  };
}

export interface LinkedInCredentials {
  personId: string;
  accessToken: string;
  displayName: string;
}

export function parseLinkedInCredentials(
  storedToken: string,
  accountName: string
): LinkedInCredentials | null {
  const token = decryptSocialToken(storedToken);
  const parts = token.split("||");
  if (parts.length === 3) {
    return { personId: parts[0], accessToken: parts[1], displayName: parts[2] };
  }
  if (token && !token.includes("||")) {
    return { personId: accountName, accessToken: token, displayName: accountName };
  }
  return null;
}
