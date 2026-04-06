import * as React from "react";
import { Layers, FileText, Video, Link } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";

type ContentType = "carousel" | "blog" | "video" | "bulk";
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
  type: ContentType;
}

export function ContentTypeBadge({ type }: ContentTypeBadgeProps): React.ReactElement {
  const config = CONTENT_TYPE_CONFIG[type];
  return (
    <Badge variant={config.variant} className="gap-1">
      {config.icon}
      {config.label}
    </Badge>
  );
}

interface ContentStatusBadgeProps {
  status: ContentStatus;
}

export function ContentStatusBadge({ status }: ContentStatusBadgeProps): React.ReactElement {
  const config = CONTENT_STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
