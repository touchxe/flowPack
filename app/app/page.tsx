"use client";

import Link from "next/link";
import { Zap, ArrowRight, Layers, FileText, Share2, BarChart3, Sparkles, Check, Clock, TrendingUp, MessageCircle, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

const problems = [
  {
    icon: <Clock className="h-6 w-6" />,
    title: "기획의 고통",
    description: "좋은 정보는 머릿속에 있는데, 이걸 어떻게 콘텐츠로 풀지?",
  },
  {
    icon: <Layers className="h-6 w-6" />,
    title: "제작 시간 부족",
    description: "카드뉴스, 블로그, 영상... 하나만 만들어도 반나절이 간다.",
  },
  {
    icon: <TrendingUp className="h-6 w-6" />,
    title: "일관성 실패",
    description: "바빠서 며칠 쉬었더니 알고리즘 끊기고, 다시 시작하기 두렵다.",
  },
  {
    icon: <MessageCircle className="h-6 w-6" />,
    title: "반응 없는 콘텐츠",
    description: "열심히 만들었는데, 댓글도 없고 매출도 없다.",
  },
];

const features = [
  {
    icon: <Layers className="h-8 w-8" />,
    title: "카드뉴스",
    description: "레퍼런스 디자인 학습으로 무한 생성",
    highlight: "5분 제작",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: <FileText className="h-8 w-8" />,
    title: "텍스트 콘텐츠",
    description: "Threads, X, LinkedIn 최적화 글",
    highlight: "채널별 최적화",
    color: "bg-amber-100 text-amber-700",
  },
  {
    icon: <FileText className="h-8 w-8" />,
    title: "블로그",
    description: "SEO 최적화된 전문가 수준의 글",
    highlight: "2000자+ 장문",
    color: "bg-emerald-100 text-emerald-700",
  },
  {
    icon: <Share2 className="h-8 w-8" />,
    title: "멀티채널 배포",
    description: "Instagram, Facebook, Twitter 동시 배포",
    highlight: "한 번의 클릭",
    color: "bg-purple-100 text-purple-700",
  },
];

const painPoints = [
  { text: "기획만 2시간째: 뭘 올려야 할지 몰라 빈 화면만 보고 있다." },
  { text: "비효율적 반복: 트렌드 찾고, 글 쓰고, 디자인하느라 본업을 못 한다." },
  { text: "들쑥날쑥한 운영: 바빠서 며칠 쉬었더니 노출이 뚝 떨어졌다." },
  { text: "반응 없는 콘텐츠: 열심히 만들었는데, 매출이나 문의로 연결되지 않는다." },
  { text: "복붙 지옥: 매일 ChatGPT에서 복사-붙여넣기 반복하느라 지쳤다." },
  { text: "디자인 시간: 글 쓰는 것보다 카드뉴스 만드는 데 더 오래 걸린다." },
  { text: "알고리즘 스트레스: 규칙이 자꾸 바뀌어서 따라가기 버겁다." },
  { text: "멀티채널 관리: 인스타, 쓰레드, 링크드인 각각 다르게 써야 해서 미치겠다." },
];

const channels = [
  { name: "Instagram", icon: "📷" },
  { name: "Facebook", icon: "📘" },
  { name: "Twitter", icon: "🐦" },
  { name: "LinkedIn", icon: "💼" },
  { name: "Naver", icon: "📝" },
  { name: "WordPress", icon: "🌐" },
];

const steps = [
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

const comparisonItems = [
  { label: "매일 2시간 → 5분으로", chatgpt: "복붙 반복", flowpack: "✓ 기획부터 관리까지 (5분)" },
  { label: "카드뉴스, 블로그, 숏폼까지", chatgpt: "텍스트만", flowpack: "✓ 카드뉴스/블로그/숏폼/텍스트" },
  { label: "브랜드 스타일 학습", chatgpt: "매번 프롬프트", flowpack: "✓ 브랜드 언어 완벽 학습" },
  { label: "이미지, 영상까지 한번에", chatgpt: "따로 만들어야 함", flowpack: "✓ 카드뉴스/숏폼 동시 생성" },
];

const testimonials = [
  {
    name: "김",
    handle: "devoutsource_kim",
    role: "외주개발 회사 대표",
    content: "\"개발자라 글 쓰는 게 제일 싫었어요. 근데 FlowPack이 제 기술 블로그 톤으로 쓰레드 글을 뽑아주니까, 3개월 만에 팔로워 3천명. 거기서 개발 외주 리드만 10건 넘게 들어왔어요.\"",
    replies: 42,
    likes: 312,
  },
  {
    name: "R",
    handle: "revive_official",
    role: "여성건기식 브랜드",
    content: "\"솔직히 500명이면 아무것도 못 한다고 생각했거든요. 근데 FlowPack로 타겟에 맞는 콘텐츠를 매일 올리니까 DM 문의가 쏟아졌어요. 팔로워 수는 중요하지 않더라고요.\"",
    replies: 28,
    likes: 189,
  },
];

const faqs = [
  {
    question: "어떤 종류의 콘텐츠를 만들 수 있나요?",
    answer: "카드뉴스, 블로그 아티클, 텍스트 SNS 콘텐츠(Threads, X, LinkedIn 최적화) 등을 지원합니다. 하나의 주제로 여러 포맷의 콘텐츠를 한번에 생성할 수도 있습니다.",
  },
  {
    question: "어떤 채널을 지원하나요?",
    answer: "현재 Instagram, Facebook, Twitter/X, LinkedIn, 네이버 블로그, WordPress 등을 지원합니다. 더 많은 채널의 지원이 곧 추가될 예정입니다.",
  },
  {
    question: "크레딧은 어떻게 사용되나요?",
    answer: "카드뉴스, 블로그, 이미지 생성 등 AI 기능을 사용할 때마다 1개 크레딧이 차감됩니다. 월 10개 크레딧은 무료로 제공되며, 더 많은 크레딧이 필요하시면 유료 플랜을 이용해주세요.",
  },
  {
    question: "구독은 언제부터 시작되나요?",
    answer: "결제 직후 바로 적용되며, 다음 달 같은 날 자동으로 갱신됩니다.",
  },
  {
    question: "구독을 취소할 수 있나요?",
    answer: "네, 언제든지 취소할 수 있습니다. 현재 구독 기간이 끝날 때까지는 기존 플랜을 계속 이용하실 수 있습니다.",
  },
  {
    question: "생성된 콘텐츠의 소유권은 누구에게 있나요?",
    answer: "생성된 콘텐츠의 소유권은 이용자에게 있습니다. FlowPack은 서비스 제공을 위해서만 콘텐츠를 이용하며, 동의 없이 제3자에게 공유하거나 판매하지 않습니다.",
  },
];

export default function RootPage(): React.ReactElement {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const navLinks = [
    { href: "/features", label: "기능" },
    { href: "/pricing", label: "요금제" },
    { href: "/contact", label: "문의하기" },
  ];

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Zap className="h-4 w-4" />
              </div>
              <span className="text-lg font-bold text-foreground">FlowPack</span>
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                로그인
              </Link>
              <Link
                href="/register"
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                무료로 시작 <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <button
              className="md:hidden p-2 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <span className="text-lg">✕</span>
              ) : (
                <span className="text-lg">☰</span>
              )}
            </button>
          </div>

          {mobileMenuOpen && (
            <nav className="md:hidden py-4 border-t border-border mt-4">
              <div className="flex flex-col gap-3">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="flex flex-col gap-3 pt-3 border-t border-border">
                  <Link
                    href="/login"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    로그인
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    무료로 시작
                  </Link>
                </div>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* 히어로 */}
      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm text-primary font-medium">
          <Sparkles className="h-4 w-4" />
          AI 기반 홍보 콘텐츠 플랫폼
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-tight mb-6">
          홍보 콘텐츠,<br />
          <span className="text-primary">AI가 만들어드립니다</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          주제만 입력하면 카드뉴스와 블로그를 자동 생성하고,
          SNS와 블로그까지 한 번에 배포하세요.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-8 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            1분 만에 무료 시작하기 <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex h-12 items-center gap-2 rounded-lg border border-border bg-background px-8 text-base font-medium text-foreground hover:bg-muted transition-colors"
          >
            요금제 보기
          </Link>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          무료로 시작하면 매월 10개 크레딧을 받을 수 있습니다.
        </p>
      </section>

      {/* 문제점 4가지 */}
      <section className="bg-muted/30 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-4">
            홍보가 본업보다 힘들지 않나요?
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
            사업가, 마케터, 부업... 누구보다 바쁜 당신의 하루를 압니다.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {problems.map((problem) => (
              <Card key={problem.title} className="bg-background border-border/50 hover:border-primary/30 transition-colors">
                <CardContent className="p-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {problem.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{problem.title}</h3>
                  <p className="text-sm text-muted-foreground">{problem.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="py-16 bg-primary/5">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {painPoints.map((point, index) => (
              <div key={index} className="flex items-start gap-3 text-sm text-muted-foreground">
                <span className="text-primary mt-0.5">•</span>
                <span>{point.text}</span>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <p className="text-lg font-medium text-foreground mb-4">
              ... 브랜드가 FlowPack과 함께합니다
            </p>
            <p className="text-muted-foreground">
              홍보에 쓰는 시간을 90% 줄이고 본업에 집중하세요
            </p>
          </div>
        </div>
      </section>

      {/* 강점 */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-4">
            어떤 콘텐츠든, AI가 만들어드립니다
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
            텍스트 콘텐츠부터 카드뉴스, 블로그까지. 하나의 주제로 모든 포맷의 콘텐츠를 한번에 생성하세요.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="bg-card hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl ${feature.color}`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{feature.description}</p>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                    <Check className="h-3 w-3" />
                    {feature.highlight}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* AI 페르소나 */}
      <section className="bg-gradient-to-b from-primary/5 to-background py-20">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-purple-100 text-purple-700 px-4 py-2 text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            NEW
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            AI가 당신처럼 생각하고 기획합니다
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-12">
            당신의 브랜드 스타일을 학습하여, 진짜 당신처럼 사고하고 콘텐츠를 만듭니다.
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
            <div className="text-center">
              <div className="text-5xl font-bold text-primary mb-2">95%</div>
              <p className="text-sm text-muted-foreground">스타일 일치도</p>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold text-emerald-600 mb-2">80%</div>
              <p className="text-sm text-muted-foreground">기획 시간 절감</p>
            </div>
          </div>
        </div>
      </section>

      {/* 채널 */}
      <section className="py-16 border-y border-border">
        <div className="mx-auto max-w-6xl px-6">
          <h3 className="text-sm font-medium text-muted-foreground text-center mb-8">
            연결된 채널
          </h3>
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
            {channels.map((channel) => (
              <div
                key={channel.name}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="text-2xl">{channel.icon}</span>
                <span className="text-sm font-medium">{channel.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 사용 방법 */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-12">
            사용 방법
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((item) => (
              <div key={item.step} className="relative">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                {item.step < 3 && (
                  <div className="hidden md:block absolute top-6 left-[60%] w-[80%] border-t border-dashed border-border" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 비교표 */}
      <section className="py-20 bg-muted/30">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-4">
            아직도 3개 도구 따로 쓰고 계세요?
          </h2>
          <p className="text-muted-foreground text-center mb-12">
            ChatGPT로 글 쓰고, Canva로 디자인하고... FlowPack 하나면 전부 됩니다.
          </p>
          <div className="bg-background rounded-xl border border-border overflow-hidden">
            <div className="hidden md:grid grid-cols-3 gap-4 p-4 border-b border-border bg-muted/50">
              <div className="text-sm font-medium text-muted-foreground"></div>
              <div className="text-sm font-medium text-center text-muted-foreground">ChatGPT</div>
              <div className="text-sm font-medium text-center text-primary">FlowPack</div>
            </div>
            {comparisonItems.map((item, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 p-4 border-b border-border last:border-b-0">
                <div className="text-sm font-medium text-foreground mb-2 md:mb-0">{item.label}</div>
                <div className="text-xs text-muted-foreground md:text-sm md:text-center pl-4 md:pl-0 border-l-2 md:border-l-0 border-muted">{item.chatgpt}</div>
                <div className="text-xs text-primary md:text-sm md:text-center font-medium pl-4 md:pl-0 border-l-2 md:border-l-0 border-primary/30">{item.flowpack}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 고객 후기 */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-4">
            FlowPack을 체험하신 분들의 생생한 실제 후기
          </h2>
          <p className="text-muted-foreground text-center mb-12">
            크리에이터부터 소형브랜드, 대행사등의 다양한 팀이 이미 사용 중이에요.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {testimonials.map((testimonial) => (
              <Card key={testimonial.handle} className="bg-card">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                      {testimonial.name[0]}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-foreground">{testimonial.name}</p>
                      <p className="text-xs text-muted-foreground">@{testimonial.handle}</p>
                    </div>
                  </div>
                  <p className="text-sm text-foreground mb-4">{testimonial.content}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>답글 ({testimonial.replies})</span>
                    <span>좋아요 ({testimonial.likes})</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 무료 체험 CTA */}
      <section className="bg-gradient-to-r from-primary/10 to-purple-100/10 py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            지금 가입하면 1주일 완전 무료!
          </h2>
          <p className="text-muted-foreground mb-8">
            카드 등록 없이, 부담 없이 모든 기능을 체험해보세요.
          </p>
          <Link
            href="/register"
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-8 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            무료 체험 시작하기 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-4">
            무엇이든 물어보세요
          </h2>
          <p className="text-muted-foreground text-center mb-12">
            FlowPack에 대해 자주 묻는 질문
          </p>
          <div className="space-y-2">
            {faqs.map((faq, index) => (
              <Card key={index} className="bg-card">
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full text-left p-4 flex items-center justify-between"
                >
                  <span className="font-medium text-sm">{faq.question}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      openFaqIndex === index ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openFaqIndex === index && (
                  <CardContent className="pt-0 pb-4 text-sm text-muted-foreground">
                    {faq.answer}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 최종 CTA */}
      <section className="bg-primary text-primary-foreground py-20">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            마케팅, 더 이상 직접 하지 마세요
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            FlowPack과 함께라면 홍보에 쓰는 시간을 90% 줄이고 본업에 집중하세요.
          </p>
          <Link
            href="/register"
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-white text-primary px-8 text-base font-semibold hover:bg-white/90 transition-colors shadow-sm"
          >
            1주 무료 시작하기 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Zap className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-bold text-foreground">FlowPack</span>
              </div>
              <p className="text-xs text-muted-foreground">
                AI 기반 홍보 콘텐츠 플랫폼
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">서비스</h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li><Link href="/features" className="hover:text-foreground">기능</Link></li>
                <li><Link href="/pricing" className="hover:text-foreground">요금제</Link></li>
                <li><Link href="/contact" className="hover:text-foreground">문의하기</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">회사</h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li><Link href="/privacy" className="hover:text-foreground">개인정보처리방침</Link></li>
                <li><Link href="/terms" className="hover:text-foreground">이용약관</Link></li>
                <li><Link href="/cookie" className="hover:text-foreground">쿠키 정책</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">지원</h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li><Link href="/contact" className="hover:text-foreground">문의하기</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-border text-center text-xs text-muted-foreground">
            © 2026 FlowPack. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
