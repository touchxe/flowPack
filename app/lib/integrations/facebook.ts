import { decryptSocialToken } from "@/lib/social-token-crypto";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";
const FACEBOOK_DIALOG_BASE = "https://www.facebook.com/v21.0/dialog/oauth";

export interface FacebookPage {
  id: string;
  name: string;
  accessToken: string;
}

export function getFacebookOAuthConfig(): {
  appId: string;
  appSecret: string;
  redirectUri: string;
} {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/social-accounts/callback/facebook`;

  if (!appId || !appSecret) {
    throw new Error("META_APP_ID와 META_APP_SECRET 환경변수가 설정되지 않았습니다.");
  }

  return { appId, appSecret, redirectUri };
}

export function buildFacebookOAuthUrl(state: string): string {
  const { appId, redirectUri } = getFacebookOAuthConfig();
  const scopes = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
  ].join(",");

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    state,
  });

  return `${FACEBOOK_DIALOG_BASE}?${params.toString()}`;
}

export async function exchangeFacebookCodeForToken(
  code: string
): Promise<{ accessToken: string; expiresIn?: number } | null> {
  const { appId, appSecret, redirectUri } = getFacebookOAuthConfig();
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

export async function getFacebookPages(
  userAccessToken: string
): Promise<FacebookPage[]> {
  const params = new URLSearchParams({
    fields: "id,name,access_token",
    access_token: userAccessToken,
  });
  const res = await fetch(`${GRAPH_BASE}/me/accounts?${params.toString()}`);
  if (!res.ok) return [];

  const data = await res.json() as {
    data?: Array<{ id?: string; name?: string; access_token?: string }>;
  };

  return (data.data ?? []).flatMap((page) => {
    if (!page.id || !page.name || !page.access_token) return [];
    return [{ id: page.id, name: page.name, accessToken: page.access_token }];
  });
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
  const token = decryptSocialToken(storedToken);
  const parts = token.split("||");
  if (parts.length === 3) {
    return { pageId: parts[0], pageAccessToken: parts[1], pageName: parts[2] };
  }
  if (token && !token.includes("||")) {
    return { pageId: accountName, pageAccessToken: token, pageName: accountName };
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
