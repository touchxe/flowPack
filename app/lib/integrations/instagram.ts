/**
 * Instagram Graph API 연동 라이브러리
 * - 인증: Meta OAuth 2.0 (Facebook Login)
 * - 지원: Instagram Business / Creator 계정
 * - 참고: https://developers.facebook.com/docs/instagram-api
 *
 * ⚠️ 환경변수 필요 (.env.local):
 *   META_APP_ID=<Meta 앱 ID>
 *   META_APP_SECRET=<Meta 앱 시크릿>
 *   NEXTAUTH_URL=http://localhost:3000  (리다이렉트 URI 기반)
 */

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

/** Meta OAuth 설정 */
export function getMetaOAuthConfig() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/social-accounts/callback/instagram`;

  if (!appId || !appSecret) {
    throw new Error("META_APP_ID와 META_APP_SECRET 환경변수가 설정되지 않았습니다.");
  }

  return { appId, appSecret, redirectUri };
}

/** OAuth 인증 URL 생성 */
export function buildInstagramOAuthUrl(state: string): string {
  const { appId, redirectUri } = getMetaOAuthConfig();

  const scopes = [
    "instagram_basic",
    "instagram_content_publish",
    "pages_read_engagement",
    "pages_show_list",
  ].join(",");

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: scopes,
    response_type: "code",
    state,
  });

  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

/** OAuth code → access token 교환 */
export async function exchangeCodeForToken(
  code: string
): Promise<{ accessToken: string; tokenType: string } | null> {
  const { appId, appSecret, redirectUri } = getMetaOAuthConfig();

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`);
  if (!res.ok) return null;

  const data = await res.json() as { access_token?: string; token_type?: string };
  if (!data.access_token) return null;

  return { accessToken: data.access_token, tokenType: data.token_type ?? "bearer" };
}

/** 단기 토큰 → 장기 토큰 교환 (60일) */
export async function exchangeForLongLivedToken(
  shortToken: string
): Promise<{ accessToken: string; expiresIn: number } | null> {
  const { appSecret, appId } = getMetaOAuthConfig();

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

  return { accessToken: data.access_token, expiresIn: data.expires_in ?? 5183944 };
}

/** Facebook 사용자의 Facebook 페이지 목록 조회 */
export async function getUserPages(
  accessToken: string
): Promise<{ id: string; name: string; accessToken: string }[]> {
  const res = await fetch(
    `${GRAPH_BASE}/me/accounts?fields=id,name,access_token&access_token=${accessToken}`
  );
  if (!res.ok) return [];

  const data = await res.json() as {
    data?: { id: string; name: string; access_token: string }[]
  };

  return (data.data ?? []).map(p => ({
    id: p.id,
    name: p.name,
    accessToken: p.access_token,
  }));
}

/** Facebook 페이지에 연결된 Instagram 비즈니스 계정 조회 */
export async function getInstagramAccountId(
  pageId: string,
  pageAccessToken: string
): Promise<{ igAccountId: string; username: string } | null> {
  const res = await fetch(
    `${GRAPH_BASE}/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`
  );
  if (!res.ok) return null;

  const data = await res.json() as {
    instagram_business_account?: { id: string }
  };

  const igAccountId = data.instagram_business_account?.id;
  if (!igAccountId) return null;

  // 사용자명 조회
  const igRes = await fetch(
    `${GRAPH_BASE}/${igAccountId}?fields=username&access_token=${pageAccessToken}`
  );
  const igData = await igRes.json() as { username?: string };

  return { igAccountId, username: igData.username ?? igAccountId };
}

/* ─── 2-Step Publishing ─────────────────────────────────── */

/**
 * Step 1: 이미지 미디어 컨테이너 생성
 * - imageUrl: 공개 접근 가능한 이미지 URL
 * - caption: 게시물 캡션 (#태그 포함)
 */
export async function createMediaContainer(
  igAccountId: string,
  pageAccessToken: string,
  imageUrl: string,
  caption: string
): Promise<{ containerId: string } | { error: string }> {
  const res = await fetch(`${GRAPH_BASE}/${igAccountId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: imageUrl,
      caption,
      access_token: pageAccessToken,
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
  igAccountId: string,
  pageAccessToken: string,
  videoUrl: string,
  caption: string,
  coverUrl?: string
): Promise<{ containerId: string } | { error: string }> {
  const payload: Record<string, string> = {
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    access_token: pageAccessToken,
  };
  if (coverUrl) payload.cover_url = coverUrl;

  const res = await fetch(`${GRAPH_BASE}/${igAccountId}/media`, {
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
 * - 동영상의 경우 처리에 시간이 걸릴 수 있음
 */
export async function waitForContainerReady(
  containerId: string,
  pageAccessToken: string,
  maxAttempts = 12,  // 최대 60초 (5초 간격)
  intervalMs = 5000
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${GRAPH_BASE}/${containerId}?fields=status_code&access_token=${pageAccessToken}`
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
  igAccountId: string,
  pageAccessToken: string,
  containerId: string
): Promise<{ postId: string; postUrl?: string } | { error: string }> {
  const res = await fetch(`${GRAPH_BASE}/${igAccountId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: pageAccessToken,
    }),
  });

  const data = await res.json() as { id?: string; error?: { message: string } };

  if (!res.ok || !data.id) {
    return { error: data.error?.message ?? `발행 실패 (HTTP ${res.status})` };
  }

  // 발행된 포스트 URL 조회
  const postRes = await fetch(
    `${GRAPH_BASE}/${data.id}?fields=permalink&access_token=${pageAccessToken}`
  );
  const postData = await postRes.json() as { permalink?: string };

  return { postId: data.id, postUrl: postData.permalink };
}

/* ─── 카드뉴스 → 캐러셀 게시물 ─────────────────────────── */

/**
 * 캐러셀(슬라이드) 컨테이너 생성
 * - images: 이미지 URL 배열 (2~10장)
 */
export async function createCarouselContainer(
  igAccountId: string,
  pageAccessToken: string,
  imageUrls: string[],
  caption: string
): Promise<{ containerId: string } | { error: string }> {
  if (imageUrls.length < 2 || imageUrls.length > 10) {
    return { error: "캐러셀은 이미지 2~10장이 필요합니다." };
  }

  // 각 이미지를 개별 컨테이너로 생성
  const childIds: string[] = [];
  for (const imgUrl of imageUrls) {
    const res = await fetch(`${GRAPH_BASE}/${igAccountId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imgUrl,
        is_carousel_item: true,
        access_token: pageAccessToken,
      }),
    });
    const data = await res.json() as { id?: string; error?: { message: string } };
    if (!data.id) return { error: data.error?.message ?? "캐러셀 아이템 생성 실패" };
    childIds.push(data.id);
  }

  // 캐러셀 부모 컨테이너 생성
  const res = await fetch(`${GRAPH_BASE}/${igAccountId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "CAROUSEL",
      children: childIds.join(","),
      caption,
      access_token: pageAccessToken,
    }),
  });

  const data = await res.json() as { id?: string; error?: { message: string } };
  if (!data.id) return { error: data.error?.message ?? "캐러셀 컨테이너 생성 실패" };

  return { containerId: data.id };
}

/* ─── 콘텐츠 타입 → 캡션 변환 ───────────────────────────── */

/**
 * FlowPack 콘텐츠의 태그, 톤에 맞는 Instagram 캡션 생성
 */
export function buildInstagramCaption(
  title: string,
  body: string | null,
  tone: string | null
): string {
  // 본문을 캡션용으로 요약 (Instagram 최대 2,200자)
  const maxLength = 2000;
  let caption = `${title}\n\n`;

  if (body) {
    // HTML 태그 제거
    const plainText = body.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    caption += plainText.length > 300
      ? plainText.slice(0, 300) + "..."
      : plainText;
    caption += "\n\n";
  }

  // 플로우팩 워터마크 + 브랜드 해시태그
  caption += "#FlowPack #AI마케팅 #콘텐츠자동화";

  return caption.slice(0, maxLength);
}

/* ─── SocialAccount에서 자격증명 파싱 ───────────────────── */

export interface InstagramCredentials {
  igAccountId: string;
  pageAccessToken: string;
  username: string;
}

/**
 * SocialAccount.accessToken에서 Instagram 자격 증명 파싱
 * 저장 형식: "igAccountId||pageAccessToken||username"
 */
export function parseInstagramCredentials(
  accessToken: string,
  accountName: string
): InstagramCredentials | null {
  const parts = accessToken.split("||");
  if (parts.length === 3) {
    return {
      igAccountId: parts[0],
      pageAccessToken: parts[1],
      username: parts[2],
    };
  }
  // 레거시 형식 (accessToken만 있는 경우)
  if (accessToken && !accessToken.includes("||")) {
    return {
      igAccountId: accountName,
      pageAccessToken: accessToken,
      username: accountName,
    };
  }
  return null;
}
