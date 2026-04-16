/**
 * WordPress REST API 연동 라이브러리
 * - 인증: Application Password (Base64 인코딩)
 * - 지원: 자체 호스팅 WordPress + WordPress.com (사업자 플랜 이상)
 * - 참고: https://developer.wordpress.org/rest-api/
 */

/** WordPress 연동 자격 증명 */
export interface WordPressCredentials {
  /** WordPress 사이트 URL (예: https://myblog.com) */
  siteUrl: string;
  /** 로그인 사용자명 (이메일 또는 ID) */
  username: string;
  /** Application Password (공백 포함 또는 제거) */
  appPassword: string;
}

/** 포스트 생성 옵션 */
export interface WordPressPostOptions {
  title: string;
  content: string; // HTML 문자열
  excerpt?: string;
  status?: "publish" | "draft" | "private" | "pending";
  categories?: number[]; // 카테고리 ID 배열
  tags?: number[]; // 태그 ID 배열
  featuredMediaId?: number; // 대표 이미지 미디어 ID
  slug?: string; // URL 슬러그
  date?: string; // ISO 8601 예약 발행 날짜
}

/** WordPress 포스트 응답 */
export interface WordPressPostResponse {
  id: number;
  link: string; // 발행된 포스트 URL
  title: { rendered: string };
  status: string;
  date: string;
}

/** WordPress 카테고리 */
export interface WordPressCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
}

/** WordPress 미디어 업로드 응답 */
export interface WordPressMediaResponse {
  id: number;
  source_url: string;
  alt_text: string;
}

/** 연동 테스트 결과 */
export interface WordPressTestResult {
  success: boolean;
  siteName?: string;
  siteUrl?: string;
  wpVersion?: string;
  error?: string;
}

/**
 * Authorization 헤더 생성 (Base64 인코딩)
 * WordPress Application Password 형식: "username:app_password"
 */
function buildAuthHeader(username: string, appPassword: string): string {
  // 공백 제거 (Application Password는 공백 포함해서 표시되지만 실제론 없어야 함)
  const cleanPassword = appPassword.replace(/\s+/g, "");
  const encoded = Buffer.from(`${username}:${cleanPassword}`).toString("base64");
  return `Basic ${encoded}`;
}

/**
 * WordPress REST API 기본 URL 정규화
 * https://site.com → https://site.com/wp-json/wp/v2
 */
function buildApiBase(siteUrl: string): string {
  const clean = siteUrl.replace(/\/+$/, ""); // 후행 슬래시 제거
  return `${clean}/wp-json/wp/v2`;
}

/**
 * WordPress 연동 테스트
 * - 사이트 정보를 조회해서 자격 증명이 유효한지 확인합니다.
 */
export async function testWordPressConnection(
  creds: WordPressCredentials
): Promise<WordPressTestResult> {
  try {
    const apiBase = buildApiBase(creds.siteUrl).replace("/wp/v2", "");
    const authHeader = buildAuthHeader(creds.username, creds.appPassword);

    // 사이트 기본 정보 조회 (인증 없이도 가능)
    const siteRes = await fetch(`${apiBase}`, {
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(10000),
    });

    if (!siteRes.ok) {
      if (siteRes.status === 401) {
        return { success: false, error: "인증 실패: 사용자명 또는 Application Password를 확인하세요." };
      }
      return { success: false, error: `서버 오류 (${siteRes.status}): 사이트 URL을 확인하세요.` };
    }

    const siteData = await siteRes.json();

    // 사용자 권한 확인 (글쓰기 권한)
    const userRes = await fetch(`${apiBase}/wp/v2/users/me`, {
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(10000),
    });

    if (!userRes.ok) {
      return {
        success: false,
        error: "권한 없음: 글쓰기 권한이 있는 계정인지 확인하세요.",
      };
    }

    return {
      success: true,
      siteName: siteData.name,
      siteUrl: siteData.url,
      wpVersion: siteData.generator?.replace("WordPress ", ""),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    if (msg.includes("fetch failed") || msg.includes("ECONNREFUSED")) {
      return { success: false, error: "사이트에 접속할 수 없습니다. URL을 확인하세요." };
    }
    if (msg.includes("timeout")) {
      return { success: false, error: "연결 시간 초과. 사이트가 응답하지 않습니다." };
    }
    return { success: false, error: msg };
  }
}

/**
 * WordPress 포스트 발행
 * - 즉시 발행 또는 예약 발행 모두 지원
 * - 반환값: 발행된 포스트의 ID와 URL
 */
export async function publishToWordPress(
  creds: WordPressCredentials,
  options: WordPressPostOptions
): Promise<{ success: boolean; post?: WordPressPostResponse; error?: string }> {
  try {
    const apiBase = buildApiBase(creds.siteUrl);
    const authHeader = buildAuthHeader(creds.username, creds.appPassword);

    const payload: Record<string, unknown> = {
      title: options.title,
      content: options.content,
      status: options.status ?? "publish",
    };

    if (options.excerpt) payload.excerpt = options.excerpt;
    if (options.categories?.length) payload.categories = options.categories;
    if (options.tags?.length) payload.tags = options.tags;
    if (options.featuredMediaId) payload.featured_media = options.featuredMediaId;
    if (options.slug) payload.slug = options.slug;
    if (options.date) payload.date = options.date;

    const res = await fetch(`${apiBase}/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = (errData as { message?: string }).message ?? `HTTP ${res.status}`;
      return { success: false, error: `포스트 발행 실패: ${errMsg}` };
    }

    const post = (await res.json()) as WordPressPostResponse;
    return { success: true, post };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    return { success: false, error: msg };
  }
}

/**
 * WordPress 이미지 업로드 (미디어 라이브러리)
 * - imageUrl: 외부 이미지 URL (FlowPack CDN 등)
 * - 반환값: 업로드된 미디어 ID (포스트 대표 이미지 설정에 사용)
 */
export async function uploadImageToWordPress(
  creds: WordPressCredentials,
  imageUrl: string,
  altText?: string
): Promise<{ success: boolean; mediaId?: number; mediaUrl?: string; error?: string }> {
  try {
    const apiBase = buildApiBase(creds.siteUrl);
    const authHeader = buildAuthHeader(creds.username, creds.appPassword);

    // 이미지를 Blob으로 가져오기
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) });
    if (!imgRes.ok) {
      return { success: false, error: "이미지를 다운로드할 수 없습니다." };
    }

    const blob = await imgRes.blob();
    const contentType = imgRes.headers.get("Content-Type") ?? "image/jpeg";
    const ext = contentType.split("/")[1] ?? "jpg";
    const filename = `flowpack-${Date.now()}.${ext}`;

    const res = await fetch(`${apiBase}/media`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
      body: blob,
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      return { success: false, error: `이미지 업로드 실패 (HTTP ${res.status})` };
    }

    const media = (await res.json()) as WordPressMediaResponse;

    // alt text 업데이트
    if (altText) {
      await fetch(`${apiBase}/media/${media.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ alt_text: altText }),
      }).catch(() => {}); // alt text 실패는 무시
    }

    return { success: true, mediaId: media.id, mediaUrl: media.source_url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    return { success: false, error: msg };
  }
}

/**
 * WordPress 카테고리 목록 조회
 * - 사용자가 카테고리를 선택하여 포스트에 지정할 수 있도록 제공
 */
export async function getWordPressCategories(
  creds: WordPressCredentials
): Promise<{ success: boolean; categories?: WordPressCategory[]; error?: string }> {
  try {
    const apiBase = buildApiBase(creds.siteUrl);
    const authHeader = buildAuthHeader(creds.username, creds.appPassword);

    const res = await fetch(`${apiBase}/categories?per_page=100`, {
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return { success: false, error: `카테고리 조회 실패 (HTTP ${res.status})` };
    }

    const categories = (await res.json()) as WordPressCategory[];
    return { success: true, categories };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    return { success: false, error: msg };
  }
}

/**
 * SocialAccount.accessToken에서 WordPress 자격 증명 파싱
 * 저장 형식: "siteUrl||username||appPassword" (|| 구분자)
 */
export function parseWordPressCredentials(
  accessToken: string,
  accountName: string
): WordPressCredentials | null {
  // accountName 형식: "site.com" (siteUrl 복원에 사용)
  // accessToken 형식: "username||appPassword" 또는 "siteUrl||username||appPassword"
  const parts = accessToken.split("||");
  if (parts.length === 3) {
    return { siteUrl: parts[0], username: parts[1], appPassword: parts[2] };
  }
  if (parts.length === 2) {
    return {
      siteUrl: accountName.startsWith("http") ? accountName : `https://${accountName}`,
      username: parts[0],
      appPassword: parts[1],
    };
  }
  return null;
}
