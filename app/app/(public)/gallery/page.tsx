"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye, Heart, Share2, Filter, Grid, List } from "lucide-react";

/* ─── 더미 갤러리 데이터 ─────────────────────────────────── */
const GALLERY_ITEMS = [
  {
    id: "g-01", type: "카드뉴스", title: "스타트업 마케팅 전략 5가지",
    brand: "뷰티셀러 A", channel: "Instagram", color: "#E1306C",
    views: 4820, likes: 312, tags: ["마케팅", "스타트업"],
    gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", emoji: "🚀",
    image: "/gallery/card-marketing.png",
    desc: "2026년 스타트업이 반드시 알아야 할 마케팅 트렌드 5가지를 정리했습니다.",
  },
  {
    id: "g-02", type: "블로그", title: "네이버 SEO 완벽 가이드 2026",
    brand: "스타트업 B", channel: "네이버블로그", color: "#03C75A",
    views: 8930, likes: 241, tags: ["SEO", "네이버"],
    gradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)", emoji: "📈",
    image: "/gallery/blog-seo.png",
    desc: "네이버 검색 상위 노출을 위한 2026년 최신 SEO 전략을 상세히 설명합니다.",
  },
  {
    id: "g-03", type: "카드뉴스", title: "오늘의 운동 루틴 3가지",
    brand: "퍼스널 트레이너 C", channel: "Instagram", color: "#E1306C",
    views: 3200, likes: 189, tags: ["피트니스", "헬스"],
    gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", emoji: "💪",
    image: "/gallery/card-fitness.png",
    desc: "바쁜 직장인을 위한 15분 완성 홈트 루틴. 오늘부터 시작하세요.",
  },
  {
    id: "g-04", type: "SNS 텍스트", title: "신상 신발 출시 안내",
    brand: "온라인 쇼핑몰 E", channel: "X (Twitter)", color: "#111827",
    views: 1540, likes: 98, tags: ["패션", "이커머스"],
    gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", emoji: "👟",
    image: "/gallery/sns-sneaker.png",
    desc: "이번 시즌 가장 핫한 스니커즈 컬렉션이 도착했습니다. 한정 수량 선착순 구매.",
  },
  {
    id: "g-05", type: "블로그", title: "카페 창업 전 알아야 할 10가지",
    brand: "음식점 F", channel: "네이버블로그", color: "#03C75A",
    views: 6780, likes: 432, tags: ["창업", "카페", "외식"],
    gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)", emoji: "☕",
    image: "/gallery/blog-cafe.png",
    desc: "카페 창업을 준비 중이라면 반드시 읽어야 할 실전 체크리스트 10가지.",
  },
  {
    id: "g-06", type: "카드뉴스", title: "콘텐츠 마케팅 ROI 높이는 법",
    brand: "마케팅 대행사 D", channel: "LinkedIn", color: "#0A66C2",
    views: 5410, likes: 367, tags: ["마케팅", "ROI", "B2B"],
    gradient: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)", emoji: "💡",
    image: "/gallery/card-roi.png",
    desc: "콘텐츠 마케팅에 투자한 비용 대비 최대 효과를 내는 3가지 핵심 전략.",
  },
  {
    id: "g-07", type: "SNS 텍스트", title: "오늘의 특가 메뉴 소개",
    brand: "음식점 F", channel: "Instagram", color: "#E1306C",
    views: 2190, likes: 144, tags: ["외식", "음식점"],
    gradient: "linear-gradient(135deg, #fd746c 0%, #ff9068 100%)", emoji: "🍽️",
    image: "/gallery/sns-restaurant.png",
    desc: "오늘만 특별 할인! 계절 한정 메뉴를 지금 예약하시면 20% 할인됩니다.",
  },
  {
    id: "g-08", type: "블로그", title: "뷰티 루틴 봄 에디션 2026",
    brand: "뷰티셀러 A", channel: "네이버블로그", color: "#03C75A",
    views: 11200, likes: 892, tags: ["뷰티", "스킨케어"],
    gradient: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)", emoji: "🌸",
    image: "/gallery/blog-beauty.png",
    desc: "봄철 피부 변화에 맞게 루틴을 업데이트하는 방법. 피부과 전문의 추천 성분 포함.",
  },
  {
    id: "g-09", type: "카드뉴스", title: "개발자 생산성 올리는 도구 7가지",
    brand: "스타트업 B", channel: "LinkedIn", color: "#0A66C2",
    views: 7350, likes: 519, tags: ["IT", "개발", "생산성"],
    gradient: "linear-gradient(135deg, #30cfd0 0%, #330867 100%)", emoji: "⚡",
    image: "/gallery/card-devtools.png",
    desc: "2026년 현시점 개발자들이 실제로 쓰는 생산성 도구 7가지를 소개합니다.",
  },
];

const TYPE_FILTERS = ["전체", "카드뉴스", "블로그", "SNS 텍스트"];
const CHANNEL_FILTERS = ["전체", "Instagram", "네이버블로그", "LinkedIn", "X (Twitter)"];

const TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  "카드뉴스": { color: "#6366F1", bg: "#EEF2FF" },
  "블로그": { color: "#059669", bg: "#ECFDF5" },
  "SNS 텍스트": { color: "#8B5CF6", bg: "#F5F3FF" },
};

export default function GalleryPage() {
  const [typeFilter, setTypeFilter] = useState("전체");
  const [channelFilter, setChannelFilter] = useState("전체");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [hovered, setHovered] = useState<string | null>(null);

  const filtered = GALLERY_ITEMS.filter(item => {
    const typeOk = typeFilter === "전체" || item.type === typeFilter;
    const chOk = channelFilter === "전체" || item.channel === channelFilter;
    return typeOk && chOk;
  });

  return (
    <>
      <style>{`
        .gallery-card { background:#fff; border:1.5px solid #E5E7EB; border-radius:20px; overflow:hidden; transition:all 0.25s; }
        .gallery-card:hover { box-shadow:0 12px 40px rgba(0,0,0,0.1); transform:translateY(-4px); }
        .filter-pill { padding:7px 16px; border-radius:9999px; border:1.5px solid #E5E7EB; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.15s; background:#fff; color:#6B7280; }
        .filter-pill.active { background:#6366F1; color:#fff; border-color:#6366F1; }
      `}</style>

      {/* 히어로 */}
      <section style={{ padding: "64px 24px 40px", textAlign: "center", background: "linear-gradient(180deg,#F8F7FF 0%,#fff 100%)" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 14px", borderRadius: 9999, background: "#EEF2FF", border: "1px solid #C7D2FE", marginBottom: 20 }}>
          <Grid className="h-3.5 w-3.5" style={{ color: "#6366F1" }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#6366F1" }}>AI 생성 콘텐츠 갤러리</span>
        </div>
        <h1 style={{ fontSize: "clamp(26px,4.5vw,44px)", fontWeight: 800, color: "#111827", lineHeight: 1.2, letterSpacing: "-0.02em", marginBottom: 14 }}>
          FlowPack으로 만든 실제 콘텐츠
        </h1>
        <p style={{ fontSize: 16, color: "#6B7280", maxWidth: 480, margin: "0 auto" }}>
          카드뉴스, 블로그, SNS — AI가 5분 만에 완성한 퀄리티를 직접 확인하세요.
        </p>
      </section>

      {/* 필터 & 뷰 모드 */}
      <section style={{ padding: "0 24px 24px", maxWidth: 1152, margin: "0 auto" }}>
        <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB", padding: "16px 20px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Filter className="h-4 w-4" style={{ color: "#9CA3AF" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF" }}>타입</span>
            {TYPE_FILTERS.map(f => (
              <button key={f} className={`filter-pill${typeFilter === f ? " active" : ""}`} onClick={() => setTypeFilter(f)}>{f}</button>
            ))}
          </div>
          <div style={{ width: 1, height: 24, background: "#E5E7EB" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF" }}>채널</span>
            {CHANNEL_FILTERS.map(f => (
              <button key={f} className={`filter-pill${channelFilter === f ? " active" : ""}`} onClick={() => setChannelFilter(f)}>{f}</button>
            ))}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            <button onClick={() => setViewMode("grid")} style={{ width: 32, height: 32, borderRadius: 8, border: "1.5px solid", borderColor: viewMode === "grid" ? "#6366F1" : "#E5E7EB", background: viewMode === "grid" ? "#EEF2FF" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Grid className="h-4 w-4" style={{ color: viewMode === "grid" ? "#6366F1" : "#9CA3AF" }} />
            </button>
            <button onClick={() => setViewMode("list")} style={{ width: 32, height: 32, borderRadius: 8, border: "1.5px solid", borderColor: viewMode === "list" ? "#6366F1" : "#E5E7EB", background: viewMode === "list" ? "#EEF2FF" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <List className="h-4 w-4" style={{ color: viewMode === "list" ? "#6366F1" : "#9CA3AF" }} />
            </button>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 10, textAlign: "right" }}>{filtered.length}개 콘텐츠</div>
      </section>

      {/* 갤러리 콘텐츠 */}
      <section style={{ padding: "0 24px 80px", maxWidth: 1152, margin: "0 auto" }}>
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(item => {
              const tp = TYPE_COLORS[item.type] ?? TYPE_COLORS["카드뉴스"];
              return (
                <div key={item.id} className="gallery-card"
                  onMouseEnter={() => setHovered(item.id)}
                  onMouseLeave={() => setHovered(null)}>
                  <div style={{ height: 180, background: item.gradient, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                    {item.image ? (
                      <img src={item.image} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
                    ) : (
                      <>
                        <div style={{ fontSize: 52, marginBottom: 8 }}>{item.emoji}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.9)", textAlign: "center", padding: "0 20px", textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>{item.title}</div>
                      </>
                    )}
                    {hovered === item.id && (
                      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", gap: 20 }}>
                        {[{ icon: <Eye className="h-5 w-5" />, val: item.views.toLocaleString() }, { icon: <Heart className="h-5 w-5" />, val: String(item.likes) }, { icon: <Share2 className="h-5 w-5" />, val: "공유" }].map((s, i) => (
                          <div key={i} style={{ textAlign: "center", color: "#fff" }}>
                            {s.icon}
                            <span style={{ display: "block", fontSize: 11, fontWeight: 700, marginTop: 3 }}>{s.val}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: tp.color, background: tp.bg, padding: "3px 10px", borderRadius: 9999 }}>{item.type}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: item.color, background: `${item.color}14`, padding: "3px 10px", borderRadius: 9999 }}>{item.channel}</span>
                    </div>
                    <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5, marginBottom: 12 }}>{item.desc}</p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>by {item.brand}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "#9CA3AF" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Eye className="h-3 w-3" />{item.views.toLocaleString()}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Heart className="h-3 w-3" />{item.likes}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 10 }}>
                      {item.tags.map(tag => (
                        <span key={tag} style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", background: "#F3F4F6", padding: "2px 8px", borderRadius: 9999 }}>#{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(item => {
              const tp = TYPE_COLORS[item.type] ?? TYPE_COLORS["카드뉴스"];
              return (
                <div key={item.id} style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, transition: "box-shadow 0.2s" }}>
                  <div style={{ width: 52, height: 52, borderRadius: 12, background: item.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>{item.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: tp.color, background: tp.bg, padding: "2px 8px", borderRadius: 9999 }}>{item.type}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: item.color }}>{item.channel}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>by {item.brand}</div>
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#9CA3AF", flexShrink: 0 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Eye className="h-3.5 w-3.5" />{item.views.toLocaleString()}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Heart className="h-3.5 w-3.5" />{item.likes}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* CTA */}
      <section style={{ padding: "48px 24px", background: "#fff", borderTop: "1px solid #E5E7EB", textAlign: "center" }}>
        <h2 style={{ fontSize: "clamp(22px,3.5vw,32px)", fontWeight: 800, color: "#111827", marginBottom: 12 }}>
          이런 콘텐츠, 5분이면 만들 수 있습니다
        </h2>
        <p style={{ fontSize: 15, color: "#6B7280", marginBottom: 28 }}>
          지금 무료로 시작해서 첫 콘텐츠를 직접 만들어보세요.
        </p>
        <Link href="/register" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 28px", background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: "none", boxShadow: "0 4px 14px rgba(99,102,241,0.35)" }}>
          무료로 시작하기 <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </>
  );
}
