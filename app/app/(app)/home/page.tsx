import { FileText, Eye, Send, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContentTypeBadge, ContentStatusBadge } from "@/components/common/content-badge";

const RECENT_CONTENTS = [
  { id: "1", title: "봄 신메뉴 출시 카드뉴스", type: "carousel" as const, status: "complete" as const, date: "2026-03-30" },
  { id: "2", title: "3월 고객 감사 이벤트 안내", type: "blog" as const, status: "draft" as const, date: "2026-03-29" },
  { id: "3", title: "매장 리뉴얼 오픈 소식", type: "carousel" as const, status: "scheduled" as const, date: "2026-03-28" },
];

export default function HomePage(): React.ReactElement {
  return (
    <>
      <PageHeader
        title="안녕하세요, 테스트 유저님 👋"
        description="오늘도 FlowPack으로 멋진 콘텐츠를 만들어보세요."
        actions={
          <Link href="/carousel-lab">
            <Button>
              <Plus className="h-4 w-4" />
              새 콘텐츠 만들기
            </Button>
          </Link>
        }
      />

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
        <StatCard
          title="이번 달 생성"
          value={3}
          subtitle="/ 10건"
          trend={50}
          trendLabel="전월 대비"
          icon={<FileText className="h-5 w-5" />}
        />
        <StatCard
          title="총 조회수"
          value={1240}
          trend={18}
          trendLabel="이번 주"
          icon={<Eye className="h-5 w-5" />}
          iconBgClassName="bg-amber-100 text-amber-700"
        />
        <StatCard
          title="배포 완료"
          value={7}
          icon={<Send className="h-5 w-5" />}
          iconBgClassName="bg-emerald-100 text-emerald-700"
        />
      </div>

      {/* 빠른 시작 */}
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-foreground">빠른 시작</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { href: "/carousel-lab", label: "카드뉴스 생성", desc: "SNS용 슬라이드 카드" },
            { href: "/ai/longform", label: "블로그 작성", desc: "SEO 장문 포스트" },
            { href: "/social-accounts", label: "SNS 연동", desc: "Instagram · 네이버 연결" },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* 최근 콘텐츠 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>최근 콘텐츠</CardTitle>
          <Link href="/calendar">
            <Button variant="ghost" size="sm">
              전체 보기 <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {RECENT_CONTENTS.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-3">
                  <ContentTypeBadge type={item.type} />
                  <span className="text-sm text-foreground">{item.title}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{item.date}</span>
                  <ContentStatusBadge status={item.status} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
