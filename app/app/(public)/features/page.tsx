import Link from "next/link";
import { Layers, FileText, Share2, BarChart3, Calendar, Sparkles, Check, ArrowRight } from "lucide-react";

export default function FeaturesPage() {
  const features = [
    {
      icon: <Layers className="h-8 w-8" />,
      title: "카드뉴스 생성",
      description: "주제만 입력하면 AI가 슬라이드 구성부터 디자인까지 자동으로 카드뉴스를 만들어드립니다. 레퍼런스 디자인 학습으로 무한 생성 가능합니다.",
      highlight: "5분 제작",
      color: "bg-primary/10 text-primary",
    },
    {
      icon: <FileText className="h-8 w-8" />,
      title: "블로그 작성",
      description: "SEO 최적화된 전문가 수준의 블로그 포스트를 생성합니다. 2000자 이상의 장문도 손쉽게 작성할 수 있습니다.",
      highlight: "2000자+ 장문",
      color: "bg-amber-100 text-amber-700",
    },
    {
      icon: <Share2 className="h-8 w-8" />,
      title: "멀티채널 배포",
      description: "Instagram, Facebook, Twitter, LinkedIn, 네이버 블로그 등 여러 채널에 동시에 콘텐츠를 배포할 수 있습니다.",
      highlight: "한 번의 클릭",
      color: "bg-emerald-100 text-emerald-700",
    },
    {
      icon: <Sparkles className="h-8 w-8" />,
      title: "AI 페르소나",
      description: "AI가 당신의 브랜드 스타일을 학습하여, 진짜 당신처럼 사고하고 콘텐츠를 만듭니다. 95% 스타일 일치도를 달성합니다.",
      highlight: "95% 일치도",
      color: "bg-purple-100 text-purple-700",
    },
    {
      icon: <Calendar className="h-8 w-8" />,
      title: "예약 발행",
      description: "원하는 날짜와 시간에 자동으로 콘텐츠를 발행합니다. AI가 최적의 발행 시간을 추천해드립니다.",
      highlight: "AI 시간 추천",
      color: "bg-blue-100 text-blue-700",
    },
    {
      icon: <BarChart3 className="h-8 w-8" />,
      title: "성과 분석",
      description: "채널별 조회수, 반응, engagement를 한눈에 확인하세요. 어떤 콘텐츠가 가장 효과적이었는지 AI가 분석해드립니다.",
      highlight: "실시간 분석",
      color: "bg-rose-100 text-rose-700",
    },
  ];

  const workflow = [
    {
      step: 1,
      title: "주제 입력",
      description: "만들고 싶은 콘텐츠의 주제를 입력하세요. 원하는 톤과 스타일을 선택할 수 있습니다.",
    },
    {
      step: 2,
      title: "AI 생성",
      description: "AI가 콘텐츠를 생성합니다. 마음에 들지 않으면 다시 생성할 수 있습니다.",
    },
    {
      step: 3,
      title: "배포",
      description: "원하는 채널을 선택하고 한 번의 클릭으로 배포하세요. 예약도 가능합니다.",
    },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <div className="mb-4 inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3 mr-1.5" />
          모든 기능 한눈에 보기
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground leading-tight mb-6">
          어떤 콘텐츠든,<br />
          <span className="text-primary">AI가 만들어드립니다</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
          텍스트 콘텐츠부터 카드뉴스, 블로그까지. 하나의 주제로 모든 포맷의 콘텐츠를 한번에 생성하세요.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-8 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            무료로 시작하기 <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex h-12 items-center gap-2 rounded-lg border border-border px-8 text-base font-medium text-foreground hover:bg-muted transition-colors"
          >
            요금제 보기
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">핵심 기능</h2>
        <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
          FlowPack은 홍보 콘텐츠 제작부터 배포, 분석까지 모든 과정을 자동화합니다.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-border bg-card p-6 hover:shadow-lg transition-shadow"
            >
              <div className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl ${feature.color}`}>
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{feature.description}</p>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                <Check className="h-3 w-3" />
                {feature.highlight}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works */}
      <section className="bg-muted/40 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">사용 방법</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
            3가지 간단한 단계로 시작하세요.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {workflow.map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
          지금 바로 시작하세요
        </h2>
        <p className="text-muted-foreground mb-8">
          무료로 시작하면 매월 10개 크레딧을 받을 수 있습니다.
        </p>
        <Link
          href="/register"
          className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-10 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
        >
          무료로 시작하기 <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
