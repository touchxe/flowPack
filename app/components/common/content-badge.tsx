import * as React from "react";
import { Layers, FileText, Video, Link, RefreshCw } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";

// URL_TO_POST 포함한 전체 타입
type ContentType = "carousel" | "blog" | "video" | "bulk" | "url_to_post";
type ContentStatus = "complete" | "draft" | "scheduled" | "archived";

/* 콘텐츠 타입 배지 */
const CONTENT_TYPE_CONFIG: Record<
  ContentType,
  { label: string; icon: React.ReactNode; variant: BadgeProps["variant"] }
> = {
  carousel: {
    label: "카드뉴스",
    icon: <Layers className="h-3 w-3" />,
    variant: "carousel",
  },
  blog: {
    label: "블로그",
    icon: <FileText className="h-3 w-3" />,
    variant: "blog",
  },
  video: {
    label: "영상",
    icon: <Video className="h-3 w-3" />,
    variant: "video",
  },
  bulk: {
    label: "대량",
    icon: <Link className="h-3 w-3" />,
    variant: "secondary",
  },
  url_to_post: {
    label: "URL변환",
    icon: <RefreshCw className="h-3 w-3" />,
    variant: "secondary",
  },
};

/* 콘텐츠 상태 배지 */
const CONTENT_STATUS_CONFIG: Record<
  ContentStatus,
  { label: string; variant: BadgeProps["variant"] }
> = {
  complete: { label: "배포 완료", variant: "complete" },
  draft: { label: "초안", variant: "draft" },
  scheduled: { label: "예약됨", variant: "scheduled" },
  archived: { label: "보관됨", variant: "archived" },
};

interface ContentTypeBadgeProps {
  type: ContentType | string;
}

// 알 수 없는 타입도 폴백으로 처리
export function ContentTypeBadge({ type }: ContentTypeBadgeProps): React.ReactElement {
  const key = (type ?? "").toLowerCase() as ContentType;
  const config = CONTENT_TYPE_CONFIG[key] ?? {
    label: type ?? "기타",
    icon: <Layers className="h-3 w-3" />,
    variant: "secondary" as BadgeProps["variant"],
  };
  return (
    <Badge variant={config.variant} className="gap-1">
      {config.icon}
      {config.label}
    </Badge>
  );
}

interface ContentStatusBadgeProps {
  status: ContentStatus | string;
}

export function ContentStatusBadge({ status }: ContentStatusBadgeProps): React.ReactElement {
  const key = (status ?? "").toLowerCase() as ContentStatus;
  const config = CONTENT_STATUS_CONFIG[key] ?? { label: status ?? "알 수 없음", variant: "secondary" as BadgeProps["variant"] };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
