/** 콘텐츠 타입 */
export type ContentType = "carousel" | "blog" | "video" | "bulk";

/** 콘텐츠 배포 상태 */
export type ContentStatus = "draft" | "scheduled" | "complete" | "archived";

/** SNS 플랫폼 */
export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "twitter"
  | "linkedin"
  | "naver_blog"
  | "wordpress"
  | "threads";

/** 요금제 */
export type PlanTier = "free" | "starter" | "pro" | "enterprise";

/** 콘텐츠 아이템 */
export interface ContentItem {
  id: string;
  title: string;
  type: ContentType;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  platforms: SocialPlatform[];
  viewCount: number;
  thumbnailUrl?: string;
}

/** 사용자 */
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  plan: PlanTier;
  usedCredits: number;
  totalCredits: number;
}

/** SNS 연동 계정 */
export interface SocialAccount {
  id: string;
  platform: SocialPlatform;
  accountName: string;
  isConnected: boolean;
  connectedAt?: string;
}

/** 대시보드 통계 */
export interface DashboardStats {
  totalCreated: number;
  totalViews: number;
  totalPublished: number;
  creditsUsed: number;
  creditsTotal: number;
}

/** Result 패턴 (API 응답) */
export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };
