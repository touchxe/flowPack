"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BarChart3, CheckCircle2, Clock3, Quote, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/* ─── 더미 데이터 ────────────────────────────────────────── */
const CASES = [
  {
    id: "case-01",
    company: "뷰티셀러 A",
    industry: "뷰티/화장품",
    size: "소상공인",
    avatar: "뷰",
    color: "#E1306C",
    bg: "#FFF0F5",
    summary: "인스타그램 팔로워 500명에서 FlowPack으로 매일 콘텐츠 발행 후 3개월 만에 팔로워 3,200명, DM 문의 월 40건 달성.",
    challenge: "매일 콘텐츠를 만들기 위해 밤새 디자이너에게 의뢰 → 건당 7만원, 월 21만원 지출. 피드백 반영에 3일 소요.",
    solution: "FlowPack으로 카드뉴스 5분 제작. 하루 한 장씩 자동 스케줄링. 브랜드 톤 학습 후 일관된 스타일 유지.",
    results: [
      { label: "팔로워 증가", value: "×6.4", sub: "500 → 3,200명", color: "#E1306C" },
      { label: "콘텐츠 제작 비용", value: "-95%", sub: "월 21만원 → 9,900원", color: "#059669" },
      { label: "월 DM 문의", value: "40건", sub: "이전 대비 +800%", color: "var(--brand-500)" },
      { label: "제작 시간", value: "5분", sub: "이전 3일 → 5분", color: "#D97706" },
    ],
    quote: "FlowPack 쓰기 전엔 디자이너한테 눈치 보면서 부탁했어요. 이제는 아침에 커피 한 잔 하면서 오늘 콘텐츠 뽑아냅니다.",
    period: "3개월",
    rating: 5,
    tags: ["카드뉴스", "Instagram", "소상공인"],
  },
  {
    id: "case-02",
    company: "스타트업 B (SaaS)",
    industry: "IT/소프트웨어",
    size: "스타트업",
    avatar: "S",
    color: "var(--brand-500)",
    bg: "#EEF2FF",
    summary: "기술 블로그 0개에서 시작해 6개월 만에 네이버 검색 노출 520개 키워드, 월 유기 트래픽 8,400명 달성.",
    challenge: "개발자 중심 팀 → 마케터 없음. 블로그 글 1편 쓰는 데 반나절, 주 1편이 한계. SEO 최적화 불가능.",
    solution: "FlowPack 블로그 기능으로 주 5편 발행. 키워드 자동 최적화. 네이버 블로그 + WordPress 동시 배포.",
    results: [
      { label: "검색 노출 키워드", value: "520개", sub: "0에서 시작", color: "var(--brand-500)" },
      { label: "월 유기 트래픽", value: "8,400", sub: "+무한대 (기존 0)", color: "#059669" },
      { label: "주당 발행량", value: "5편", sub: "이전 1편 대비 ×5", color: "#D97706" },
      { label: "콘텐츠 팀 인력", value: "0명", sub: "추가 채용 없이 달성", color: "var(--brand-500)" },
    ],
    quote: "개발팀 혼자 SaaS 운영하면서 마케팅까지 했어요. FlowPack이 없었다면 콘텐츠 마케팅은 꿈도 못 꿨을 거예요.",
    period: "6개월",
    rating: 5,
    tags: ["블로그", "SEO", "네이버", "WordPress"],
  },
  {
    id: "case-03",
    company: "퍼스널 트레이너 C",
    industry: "건강/피트니스",
    size: "1인 사업자",
    avatar: "트",
    color: "#059669",
    bg: "#ECFDF5",
    summary: "SNS 4채널 동시 운영, 1개월 만에 PT 등록 고객 월 12명 → 28명(+133%). 콘텐츠 제작 시간 하루 3시간 → 20분으로 감소.",
    challenge: "인스타, 유튜브, 블로그, 스레드를 각각 따로 관리. 같은 내용을 4번 복붙하고 수정하는 데 하루 3시간 소요.",
    solution: "FlowPack으로 하나의 원고로 4채널 콘텐츠 생성. 채널별 톤앤매너 자동 최적화. 예약 발행으로 일정 관리.",
    results: [
      { label: "신규 PT 고객", value: "+133%", sub: "12명 → 28명/월", color: "#059669" },
      { label: "일일 콘텐츠 시간", value: "-89%", sub: "3시간 → 20분", color: "var(--brand-500)" },
      { label: "운영 채널", value: "4개", sub: "동시 운영 (이전 1개)", color: "#D97706" },
      { label: "월 구독료", value: "₩19,900", sub: "대행사 대비 -97%", color: "#E1306C" },
    ],
    quote: "운동 가르치는 게 업인데 SNS 관리에 3시간을 쓰고 있었어요. FlowPack으로 그 시간을 다시 운동 지도에 쓸 수 있게 됐어요.",
    period: "1개월",
    rating: 5,
    tags: ["SNS", "멀티채널", "1인사업자"],
  },
  {
    id: "case-04",
    company: "마케팅 대행사 D",
    industry: "마케팅/광고",
    size: "중소기업",
    avatar: "대",
    color: "var(--brand-500)",
    bg: "#F5F3FF",
    summary: "담당 클라이언트 수 1인당 3개 → 8개로 확대. 콘텐츠 납기 3일 → 당일 처리. 고객 만족도 4.2 → 4.9점.",
    challenge: "클라이언트마다 다른 브랜드 톤. 카드뉴스 하나 만들 때마다 디자이너-카피라이터 협업 필요. 납기 압박.",
    solution: "FlowPack에 클라이언트별 브랜드 프로필 학습. 요청 즉시 시안 생성. 담당자 검토 후 즉시 배포.",
    results: [
      { label: "담당 클라이언트", value: "×2.7", sub: "3개 → 8개/인", color: "var(--brand-500)" },
      { label: "콘텐츠 납기", value: "당일", sub: "이전 평균 3일", color: "#059669" },
      { label: "고객 만족도", value: "4.9점", sub: "4.2점 → 4.9점 (/5)", color: "#D97706" },
      { label: "인력 추가 채용", value: "0명", sub: "매출 2.3배 증가", color: "var(--brand-500)" },
    ],
    quote: "대행사 입장에서 가장 무서운 건 납기 못 맞추는 거예요. FlowPack으로 그 걱정이 없어졌고, 클라이언트를 더 받을 수 있게 됐습니다.",
    period: "2개월",
    rating: 5,
    tags: ["대행사", "멀티클라이언트", "카드뉴스"],
  },
  {
    id: "case-05",
    company: "온라인 쇼핑몰 E",
    industry: "이커머스",
    size: "소상공인",
    avatar: "몰",
    color: "#D97706",
    bg: "#FFFBEB",
    summary: "상품 소개 콘텐츠 자동화로 신상품 출시 주기 단축. SNS 광고 CTR 3.1% → 6.8%, 월 매출 +42%.",
    challenge: "신상품 출시마다 상품 사진+설명 콘텐츠를 카카오, 인스타, 블로그 각각에 올려야 해서 오픈 날짜를 맞추기가 힘들었음.",
    solution: "상품 이미지 업로드 → FlowPack이 채널별 설명문 자동 생성 → 동시 배포. 출시 당일 3채널 동시 오픈.",
    results: [
      { label: "SNS 광고 CTR", value: "+119%", sub: "3.1% → 6.8%", color: "#D97706" },
      { label: "월 매출 증가", value: "+42%", sub: "콘텐츠 개선 효과", color: "#059669" },
      { label: "신상품 출시 리드타임", value: "-67%", sub: "3일 → 1일", color: "var(--brand-500)" },
      { label: "채널별 콘텐츠 제작", value: "자동", sub: "인스타·블로그·카카오", color: "var(--brand-500)" },
    ],
    quote: "신상 나올 때마다 사진 찍고, 글 쓰고, 올리는 게 너무 힘들었어요. FlowPack이 글을 다 써줘서 저는 상품 기획에만 집중하면 돼요.",
    period: "2개월",
    rating: 5,
    tags: ["이커머스", "상품소개", "멀티채널"],
  },
  {
    id: "case-06",
    company: "음식점 F (프랜차이즈)",
    industry: "외식업",
    size: "소상공인",
    avatar: "식",
    color: "#DC2626",
    bg: "#FEF2F2",
    summary: "메뉴 소개 카드뉴스 + 블로그 리뷰 자동화. 네이버 플레이스 방문자 수 월 340명 → 890명(+162%).",
    challenge: "매장 운영하면서 SNS까지 관리 불가. 대행사에 월 30만원 주고 맡겼는데 게시물이 형식적이고 반응 없음.",
    solution: "메뉴 사진 촬영 → FlowPack으로 맛 설명 카드뉴스 + 블로그 동시 생성. 네이버 블로그 예약 발행.",
    results: [
      { label: "네이버 플레이스 방문", value: "+162%", sub: "340 → 890명/월", color: "#DC2626" },
      { label: "대행사 비용 절감", value: "₩30만", sub: "월 0원으로 대체", color: "#059669" },
      { label: "발행 콘텐츠 수", value: "×4", sub: "월 2건 → 8건", color: "#D97706" },
      { label: "고객 예약 증가", value: "+55%", sub: "블로그 유입 효과", color: "var(--brand-500)" },
    ],
    quote: "대행사 돈 주면서 했는데 우리 가게 음식을 제대로 표현 못 했어요. FlowPack으로 제가 직접 하니까 훨씬 생생하게 나와요.",
    period: "3개월",
    rating: 5,
    tags: ["외식업", "네이버블로그", "소상공인"],
  },
  {
    id: "case-07",
    company: "성수동 카페 쑥림이",
    industry: "카페/F&B",
    size: "소상공인",
    avatar: "카",
    color: "#92400E",
    bg: "#FFF7ED",
    summary: "성수동 카페 체험단 모집 블로그 마케팅으로 3개월 만에 월 방문자 1,200명 → 3,800명(+217%). 예약 문의 하루 평균 12건 달성.",
    challenge: "임대료가 높은 성수동 상권에서 유동인구에만 의존. SNS 콘텐츠를 직접 만들 시간이 없어 아르바이트에게 맡겼지만 퀄리티가 들쑥날쑥.",
    solution: "FlowPack으로 메뉴 사진 → 카드뉴스 자동 생성. 네이버 블로그 체험단 모집 포스팅은 AI가 키워드 최적화. 주 3회 예약 발행.",
    results: [
      { label: "월 방문자", value: "+217%", sub: "1,200 → 3,800명", color: "#92400E" },
      { label: "일 예약 문의", value: "12건", sub: "이전 평균 2건 대비", color: "#D97706" },
      { label: "체험단 지원자", value: "84명", sub: "1회 모집 기준", color: "var(--brand-500)" },
      { label: "콘텐츠 제작비", value: "-100%", sub: "월 15만원 → 0원", color: "#059669" },
    ],
    quote: "직접 글 쓰면 어색하고, 아르바이트한테 맡기면 진짜 우리 카페 감성이 안 나왔어요. FlowPack이 제 말투를 학습해서 이제는 제가 쓴 것보다 더 잘 씁니다.",
    period: "3개월",
    rating: 5,
    tags: ["카페", "네이버블로그", "체험단", "서울성수"],
  },
  {
    id: "case-08",
    company: "서울 소상공인 마케팅 컨설팅",
    industry: "마케팅/광고",
    size: "소상공인",
    avatar: "컨",
    color: "#0891B2",
    bg: "#ECFEFF",
    summary: "소상공인 클라이언트 블로그 관리 대행으로 네이버 검색 유입이 인스타그램의 3배. 월 10개 업체 동시 관리로 매출 2.8배 성장.",
    challenge: "각 클라이언트마다 네이버 블로그, 인스타, 카카오를 따로 관리. 한 명이 10개 업체를 맡으면 글 하나 쓰는 데 2시간 소요.",
    solution: "FlowPack으로 업체별 브랜드 톤 세팅 후 블로그 초안 자동 생성. SEO 키워드 최적화 포함. 동시 배포로 납기 당일 처리.",
    results: [
      { label: "관리 가능 업체", value: "×3", sub: "4개 → 12개/인", color: "#0891B2" },
      { label: "네이버 검색 유입", value: "×3", sub: "인스타 대비 효율", color: "var(--brand-500)" },
      { label: "월 매출 증가", value: "+180%", sub: "콘텐츠 자동화 효과", color: "#059669" },
      { label: "클라이언트 만족도", value: "4.9점", sub: "평균 재계약률 92%", color: "#D97706" },
    ],
    quote: "오프라인 광고에 돈 쓰던 클라이언트들을 블로그로 전환시켰더니 ROI가 확실히 나왔어요. 데이터로 보여주니까 재계약률이 올라갔습니다.",
    period: "2개월",
    rating: 5,
    tags: ["마케팅대행", "블로그관리", "소상공인", "SEO"],
  },
  {
    id: "case-09",
    company: "재활필라테스 스튜디오",
    industry: "건강/피트니스",
    size: "1인 사업자",
    avatar: "필",
    color: "#059669",
    bg: "#F0FDF4",
    summary: "신규 회원 모집 블로그 포스팅 자동화로 월 등록률 +89%. 강남/서초 지역 필라테스 키워드 상위 노출 달성.",
    challenge: "수업 준비와 운영에 집중하다 보니 SNS 관리는 뒷전. 회원 모집 공고를 네이버 카페에만 올리고 홍보가 없어 공실이 많았음.",
    solution: "FlowPack으로 기구필라테스 효과, 재활 사례, 회원 모집 안내를 블로그 포스팅으로 자동화. '강남 필라테스', '재활 필라테스 추천' 키워드 집중 공략.",
    results: [
      { label: "신규 회원 등록", value: "+89%", sub: "월 평균 6명 → 11명", color: "#059669" },
      { label: "블로그 검색 유입", value: "1,240명", sub: "월 기준 (3개월 차)", color: "var(--brand-500)" },
      { label: "상위 키워드 노출", value: "14개", sub: "재활/기구필라테스 계열", color: "#D97706" },
      { label: "포스팅 시간", value: "15분", sub: "이전 2시간 → 15분", color: "var(--brand-500)" },
    ],
    quote: "운동 가르치면서 블로그도 써야 한다는 게 스트레스였어요. FlowPack이 초안을 써주면 저는 전문 용어만 살짝 다듬어요. 30분이면 끝납니다.",
    period: "3개월",
    rating: 5,
    tags: ["필라테스", "재활운동", "네이버블로그", "강남"],
  },
];

const INDUSTRIES = ["전체", "뷰티/화장품", "카페/F&B", "IT/소프트웨어", "건강/피트니스", "마케팅/광고", "이커머스", "외식업"];

const STATS = [
  { value: "평균 +143%", label: "SNS 팔로워 증가", icon: <Users className="h-6 w-6" />, color: "var(--brand-500)" },
  { value: "평균 -89%", label: "콘텐츠 제작 시간 감소", icon: <Clock3 className="h-6 w-6" />, color: "#059669" },
  { value: "평균 -93%", label: "마케팅 비용 절감", icon: <BarChart3 className="h-6 w-6" />, color: "#D97706" },
  { value: "4.9점", label: "고객 만족도 (/5)", icon: <Star className="h-6 w-6" />, color: "#E1306C" },
];

export default function CasesPage() {
  const [activeIndustry, setActiveIndustry] = useState("전체");
  const [selectedCase, setSelectedCase] = useState<(typeof CASES)[number] | null>(null);

  const filtered = activeIndustry === "전체"
    ? CASES
    : CASES.filter(c => c.industry === activeIndustry);

  return (
    <div className="overflow-hidden bg-white text-[var(--fp-heading)]">
      <section className="border-b border-[var(--fp-border-soft)] bg-[radial-gradient(circle_at_50%_-30%,var(--fp-primary-subtle),transparent_58%)] px-6 pb-16 pt-20 text-center sm:pb-20 sm:pt-28">
        <div className="mx-auto max-w-4xl">
          <p className="inline-flex items-center gap-2 border-l-2 border-[var(--brand-500)] bg-[var(--fp-primary-subtle)] px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-600)]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            실제 사용 사례
          </p>
          <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-extrabold leading-[1.04] tracking-[-0.055em] text-[var(--fp-heading)] sm:text-6xl">
            숫자로 증명된<br />
            <span className="text-[var(--brand-500)]">성장의 이야기</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-7 text-[var(--fp-secondary)] sm:text-lg">
            소상공인부터 마케팅 대행사까지, FlowPack을 도입한 팀들이 만든 구체적인 변화입니다.
          </p>

          <dl className="mx-auto mt-12 grid max-w-4xl grid-cols-2 divide-x divide-y divide-[var(--fp-border-soft)] border border-[var(--fp-border-soft)] bg-white text-left sm:grid-cols-4 sm:divide-y-0">
            {STATS.map((stat) => (
              <div key={stat.label} className="p-5 sm:p-6">
                <div className="mb-6 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--fp-primary-subtle)] text-[var(--brand-500)]">
                  {stat.icon}
                </div>
                <dd className="font-mono text-xl font-bold tracking-[-0.06em] text-[var(--fp-heading)] sm:text-2xl">{stat.value}</dd>
                <dt className="mt-2 text-xs font-medium leading-5 text-[var(--fp-muted)]">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
        <div className="flex flex-col justify-between gap-6 border-b border-[var(--fp-border-soft)] pb-8 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-600)]">Customer outcomes</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] sm:text-3xl">우리와 닮은 팀의 성과를 찾아보세요</h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-[var(--fp-secondary)]">각 사례의 핵심 성과와 도입 과정을 짧고 명확하게 확인할 수 있습니다.</p>
        </div>

        <div className="mt-7 flex flex-wrap gap-2" aria-label="업종별 사례 필터">
          {INDUSTRIES.map((industry) => {
            const isActive = activeIndustry === industry;

            return (
              <button
                key={industry}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveIndustry(industry)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] focus-visible:ring-offset-2 ${
                  isActive
                    ? "border-[var(--brand-500)] bg-[var(--brand-500)] text-black"
                    : "border-[var(--fp-border)] bg-white text-[var(--fp-secondary)] hover:border-[var(--brand-500)] hover:text-[var(--fp-heading)]"
                }`}
              >
                {industry}
              </button>
            );
          })}
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((caseItem) => {
            const isFeatured = activeIndustry === "전체" && caseItem.id === "case-01";
            const primaryResult = caseItem.results[0];

            return (
              <article
                key={caseItem.id}
                className={`group relative flex min-h-[390px] flex-col overflow-hidden border border-[var(--fp-border)] bg-white transition-[border-color,transform] duration-200 hover:-translate-y-1 hover:border-[var(--brand-500)] focus-within:-translate-y-1 focus-within:border-[var(--brand-500)] ${
                  isFeatured ? "lg:col-span-2 lg:min-h-[422px]" : ""
                }`}
              >
                <div className="relative overflow-hidden border-b border-[var(--fp-border-soft)] bg-[var(--fp-primary-subtle)] p-6 sm:p-7">
                  <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full border border-[var(--brand-500)]/20" />
                  <div className="relative flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[var(--brand-500)] font-mono text-sm font-bold text-black">
                        {caseItem.avatar}
                      </div>
                      <div>
                        <h3 className="text-base font-bold tracking-[-0.03em] text-[var(--fp-heading)]">{caseItem.company}</h3>
                        <p className="mt-1 text-xs text-[var(--fp-secondary)]">{caseItem.industry} · {caseItem.size}</p>
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--brand-700)]">{caseItem.period}</span>
                  </div>
                  <p className={`relative mt-7 text-pretty font-medium leading-6 text-[var(--fp-heading)] ${isFeatured ? "max-w-xl text-base" : "text-sm"}`}>
                    {caseItem.summary}
                  </p>
                </div>

                <div className="flex flex-1 flex-col p-6 sm:p-7">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--fp-muted)]">핵심 성과</p>
                  <div className="mt-2 flex items-end gap-3">
                    <strong className="font-mono text-4xl font-bold leading-none tracking-[-0.08em] text-[var(--brand-500)]">{primaryResult.value}</strong>
                    <span className="pb-0.5 text-sm font-semibold text-[var(--fp-heading)]">{primaryResult.label}</span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--fp-secondary)]">{primaryResult.sub}</p>

                  <dl className="mt-7 grid grid-cols-2 border-y border-[var(--fp-border-soft)]">
                    {caseItem.results.slice(1, 3).map((result, index) => (
                      <div key={result.label} className={`py-4 ${index === 0 ? "border-r border-[var(--fp-border-soft)] pr-3" : "pl-3"}`}>
                        <dt className="text-[11px] font-medium leading-4 text-[var(--fp-muted)]">{result.label}</dt>
                        <dd className="mt-1 font-mono text-lg font-bold tracking-[-0.05em] text-[var(--fp-heading)]">{result.value}</dd>
                        <p className="mt-1 text-[11px] leading-4 text-[var(--fp-secondary)]">{result.sub}</p>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-auto flex items-end justify-between gap-4 pt-6">
                    <p className="line-clamp-2 max-w-[18rem] text-xs italic leading-5 text-[var(--fp-secondary)]">“{caseItem.quote}”</p>
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => setSelectedCase(caseItem)}
                      className="h-auto shrink-0 p-0 text-xs font-bold no-underline hover:no-underline"
                      aria-label={`${caseItem.company} 사례 자세히 보기`}
                    >
                      자세히 보기
                      <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-t border-[var(--fp-border-soft)] bg-[var(--fp-section-bg)] px-6 py-16 text-center sm:py-20">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-600)]">Start your story</p>
        <h2 className="mx-auto mt-3 max-w-2xl text-balance text-3xl font-extrabold tracking-[-0.05em] text-[var(--fp-heading)] sm:text-5xl">다음 성공 사례는 당신의 팀입니다</h2>
        <p className="mx-auto mt-5 max-w-lg text-pretty leading-7 text-[var(--fp-secondary)]">콘텐츠 제작과 배포에 쓰는 시간을 줄이고, 고객을 만나는 일에 더 집중해 보세요.</p>
        <Button asChild size="lg" className="mt-8 px-7">
          <Link href="/register">
            무료로 시작하기 <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </section>

      <Dialog open={selectedCase !== null} onOpenChange={(isOpen) => !isOpen && setSelectedCase(null)}>
        {selectedCase && (
          <DialogContent className="max-h-[min(760px,calc(100vh-2rem))] max-w-2xl gap-0 overflow-y-auto border-[var(--fp-border)] bg-white p-0 text-[var(--fp-heading)] [&>button_svg]:text-[var(--fp-heading)]">
            <DialogHeader className="border-b border-[var(--fp-border-soft)] bg-[var(--fp-primary-subtle)] p-6 pr-14 text-left sm:p-8 sm:pr-16">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-700)]">{selectedCase.industry} · {selectedCase.size} · 도입 {selectedCase.period}</p>
              <DialogTitle className="mt-3 text-2xl font-bold tracking-[-0.04em] text-[var(--fp-heading)] sm:text-3xl">{selectedCase.company}</DialogTitle>
              <DialogDescription className="mt-3 max-w-xl text-sm leading-6 text-[var(--fp-secondary)]">{selectedCase.summary}</DialogDescription>
            </DialogHeader>

            <div className="p-6 sm:p-8">
              <dl className="grid grid-cols-2 gap-px overflow-hidden border border-[var(--fp-border-soft)] bg-[var(--fp-border-soft)] sm:grid-cols-4">
                {selectedCase.results.map((result) => (
                  <div key={result.label} className="bg-white p-4">
                    <dt className="text-[11px] font-medium leading-4 text-[var(--fp-muted)]">{result.label}</dt>
                    <dd className="mt-2 font-mono text-xl font-bold tracking-[-0.06em] text-[var(--brand-500)]">{result.value}</dd>
                    <p className="mt-1 text-[11px] leading-4 text-[var(--fp-secondary)]">{result.sub}</p>
                  </div>
                ))}
              </dl>

              <div className="mt-8 grid gap-7 sm:grid-cols-2">
                <div>
                  <h4 className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--fp-muted)]">도입 전 문제</h4>
                  <p className="mt-3 text-sm leading-6 text-[var(--fp-secondary)]">{selectedCase.challenge}</p>
                </div>
                <div>
                  <h4 className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--fp-muted)]">FlowPack 활용법</h4>
                  <p className="mt-3 text-sm leading-6 text-[var(--fp-secondary)]">{selectedCase.solution}</p>
                </div>
              </div>

              <figure className="mt-8 border-l-2 border-[var(--brand-500)] bg-[var(--fp-primary-subtle)] px-5 py-5">
                <Quote className="h-5 w-5 text-[var(--brand-500)]" />
                <blockquote className="mt-3 text-sm italic leading-6 text-[var(--fp-heading)]">“{selectedCase.quote}”</blockquote>
                <figcaption className="mt-3 text-xs font-medium text-[var(--fp-secondary)]">— {selectedCase.company} 대표</figcaption>
              </figure>

              <div className="mt-6 flex flex-wrap gap-2">
                {selectedCase.tags.map((tag) => (
                  <span key={tag} className="border border-[var(--fp-primary-border)] bg-[var(--fp-primary-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--brand-700)]">{tag}</span>
                ))}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
