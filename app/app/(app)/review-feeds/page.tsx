import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { FileText, Layers, MessageSquare, MoveRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { ensureContentShareSchema } from "@/lib/content-share-schema";
import { prisma } from "@/lib/prisma";

const TYPE_LABEL: Record<string, string> = {
  BLOG: "블로그",
  CAROUSEL: "카드뉴스",
  VIDEO: "영상",
  BULK: "대량",
  URL_TO_POST: "URL 변환",
};

export default async function ReviewFeedsPage(): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await ensureContentShareSchema();

  const annotations = await prisma.contentAnnotation.findMany({
    where: {
      content: {
        userId: session.user.id,
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slideIndex: true,
      number: true,
      authorName: true,
      selectedText: true,
      body: true,
      createdAt: true,
      content: {
        select: {
          id: true,
          title: true,
          type: true,
        },
      },
    },
  });

  return (
    <div style={{ padding: "24px 28px 80px", maxWidth: 1120, margin: "0 auto" }}>
      <style>{`
        .review-feed-head { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; margin-bottom:22px; }
        .review-feed-kpi { min-width:96px; border:1.5px solid #E5E7EB; background:#fff; border-radius:14px; padding:13px 16px; text-align:right; }
        .review-feed-list { display:flex; flex-direction:column; gap:12px; }
        .review-feed-card { display:grid; grid-template-columns:44px minmax(0,1fr) auto; gap:14px; align-items:start; background:#fff; border:1.5px solid #E5E7EB; border-radius:14px; padding:16px; text-decoration:none; transition:all 0.15s; }
        .review-feed-card:hover { border-color:#C7D2FE; box-shadow:0 12px 34px rgba(79,70,229,0.10); transform:translateY(-1px); }
        .review-feed-number { width:44px; height:44px; border-radius:999px; background:#4F46E5; color:#fff; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:900; }
        .review-feed-title-row { display:flex; align-items:center; gap:8px; min-width:0; margin-bottom:8px; }
        .review-feed-type { height:22px; padding:0 8px; border-radius:999px; background:#EEF2FF; color:#4F46E5; display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:800; flex-shrink:0; }
        .review-feed-title { font-size:14px; font-weight:850; color:#111827; margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .review-feed-quote { border-left:3px solid #FACC15; background:#FFFBEB; border-radius:8px; padding:9px 11px; color:#713F12; font-size:12px; line-height:1.55; margin:0 0 9px; max-height:92px; overflow:auto; }
        .review-feed-body { color:#1F2937; font-size:13px; line-height:1.65; margin:0; white-space:pre-wrap; }
        .review-feed-meta { color:#9CA3AF; font-size:11px; margin-top:9px; }
        .review-feed-empty { background:#fff; border:1.5px dashed #E5E7EB; border-radius:16px; padding:72px 20px; text-align:center; color:#9CA3AF; }
        .review-feed-arrow { color:#9CA3AF; margin-top:10px; }
        @media (max-width: 720px) {
          .review-feed-head { align-items:flex-start; flex-direction:column; }
          .review-feed-card { grid-template-columns:38px minmax(0,1fr); }
          .review-feed-arrow { display:none; }
          .review-feed-number { width:38px; height:38px; font-size:13px; }
        }
      `}</style>

      <div className="review-feed-head">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#111827", margin: "0 0 5px" }}>
            수정피드
          </h1>
          <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>
            공유문서에서 들어온 수정요청을 최신순으로 확인하세요.
          </p>
        </div>
        <div className="review-feed-kpi">
          <p style={{ fontSize: 11, fontWeight: 800, color: "#9CA3AF", margin: "0 0 4px" }}>총 수정요청</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: "#4F46E5", margin: 0 }}>{annotations.length}</p>
        </div>
      </div>

      {annotations.length === 0 ? (
        <div className="review-feed-empty">
          <MessageSquare size={34} style={{ margin: "0 auto 12px", color: "#C7D2FE" }} />
          <p style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: "0 0 6px" }}>아직 수정요청이 없습니다</p>
          <p style={{ fontSize: 13, margin: 0 }}>공유문서 보기 화면에서 받은 의견이 여기에 표시됩니다.</p>
        </div>
      ) : (
        <div className="review-feed-list">
          {annotations.map((annotation) => {
            const TypeIcon = annotation.content.type === "BLOG" ? FileText : Layers;
            return (
              <Link className="review-feed-card" href={`/content/${annotation.content.id}/view`} key={annotation.id}>
                <span className="review-feed-number">{annotation.number}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="review-feed-title-row">
                    <span className="review-feed-type">
                      <TypeIcon size={11} />
                      {TYPE_LABEL[annotation.content.type] || annotation.content.type}
                    </span>
                    <h2 className="review-feed-title">{annotation.content.title}</h2>
                  </div>
                  {annotation.selectedText && (
                    <p className="review-feed-quote">&ldquo;{annotation.selectedText}&rdquo;</p>
                  )}
                  <p className="review-feed-body">{annotation.body}</p>
                  <p className="review-feed-meta">
                    {annotation.authorName || "익명"} · {annotation.content.type === "BLOG" ? "문서 전체" : `${annotation.slideIndex + 1}번 영역`} · {format(annotation.createdAt, "yyyy.MM.dd HH:mm", { locale: ko })}
                  </p>
                </div>
                <MoveRight className="review-feed-arrow" size={18} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
