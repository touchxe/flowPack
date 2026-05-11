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
        .review-feed-table-wrap { background:#fff; border:1.5px solid #E5E7EB; border-radius:14px; overflow:hidden; }
        .review-feed-table { width:100%; border-collapse:collapse; table-layout:fixed; }
        .review-feed-table th { background:#F9FAFB; border-bottom:2px solid #E5E7EB; color:#9CA3AF; font-size:11px; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; text-align:left; padding:10px 12px; }
        .review-feed-table td { border-bottom:1px solid #F3F4F6; padding:12px; vertical-align:top; color:#1F2937; font-size:13px; }
        .review-feed-table tr:last-child td { border-bottom:0; }
        .review-feed-table tbody tr:hover { background:#F9FAFB; }
        .review-feed-number { min-width:30px; height:30px; padding:0 8px; border-radius:999px; background:#4F46E5; color:#fff; display:inline-flex; align-items:center; justify-content:center; font-size:12px; font-weight:900; }
        .review-feed-type { height:22px; padding:0 8px; border-radius:999px; background:#EEF2FF; color:#4F46E5; display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:800; flex-shrink:0; }
        .review-feed-title { display:block; color:#111827; font-size:13px; font-weight:850; line-height:1.4; text-decoration:none; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .review-feed-title:hover { color:#4F46E5; }
        .review-feed-target { color:#6B7280; font-size:12px; font-weight:700; white-space:nowrap; }
        .review-feed-quote { color:#713F12; background:#FFFBEB; border-left:3px solid #FACC15; border-radius:8px; padding:8px 9px; font-size:12px; line-height:1.5; max-height:72px; overflow:auto; }
        .review-feed-body { color:#1F2937; font-size:13px; line-height:1.55; margin:0; white-space:pre-wrap; max-height:82px; overflow:auto; }
        .review-feed-meta { color:#9CA3AF; font-size:12px; white-space:nowrap; }
        .review-feed-action { width:34px; height:34px; border-radius:9px; border:1px solid #E5E7EB; color:#6B7280; background:#fff; display:inline-flex; align-items:center; justify-content:center; text-decoration:none; }
        .review-feed-action:hover { border-color:#C7D2FE; color:#4F46E5; background:#F8F7FF; }
        .review-feed-empty { background:#fff; border:1.5px dashed #E5E7EB; border-radius:16px; padding:72px 20px; text-align:center; color:#9CA3AF; }
        @media (max-width: 980px) {
          .review-feed-head { align-items:flex-start; flex-direction:column; }
          .review-feed-table-wrap { overflow-x:auto; }
          .review-feed-table { min-width:920px; }
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
        <div className="review-feed-table-wrap">
          <table className="review-feed-table">
            <colgroup>
              <col style={{ width: 64 }} />
              <col style={{ width: 220 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 96 }} />
              <col style={{ width: 210 }} />
              <col />
              <col style={{ width: 90 }} />
              <col style={{ width: 132 }} />
              <col style={{ width: 58 }} />
            </colgroup>
            <thead>
              <tr>
                <th>번호</th>
                <th>콘텐츠</th>
                <th>유형</th>
                <th>대상</th>
                <th>선택 문장</th>
                <th>수정요청</th>
                <th>작성자</th>
                <th>일시</th>
                <th>이동</th>
              </tr>
            </thead>
            <tbody>
              {annotations.map((annotation) => {
                const TypeIcon = annotation.content.type === "BLOG" ? FileText : Layers;
                return (
                  <tr key={annotation.id}>
                    <td><span className="review-feed-number">{annotation.number}</span></td>
                    <td>
                      <Link className="review-feed-title" href={`/content/${annotation.content.id}/view`}>
                        {annotation.content.title}
                      </Link>
                    </td>
                    <td>
                      <span className="review-feed-type">
                        <TypeIcon size={11} />
                        {TYPE_LABEL[annotation.content.type] || annotation.content.type}
                      </span>
                    </td>
                    <td>
                      <span className="review-feed-target">
                        {annotation.content.type === "BLOG" ? "문서 전체" : `${annotation.slideIndex + 1}번 영역`}
                      </span>
                    </td>
                    <td>
                      {annotation.selectedText ? (
                        <div className="review-feed-quote">&ldquo;{annotation.selectedText}&rdquo;</div>
                      ) : (
                        <span style={{ color: "#D1D5DB" }}>—</span>
                      )}
                    </td>
                    <td><p className="review-feed-body">{annotation.body}</p></td>
                    <td><span className="review-feed-meta">{annotation.authorName || "익명"}</span></td>
                    <td><span className="review-feed-meta">{format(annotation.createdAt, "yyyy.MM.dd HH:mm", { locale: ko })}</span></td>
                    <td>
                      <Link className="review-feed-action" href={`/content/${annotation.content.id}/view`} aria-label="글 읽기 화면으로 이동">
                        <MoveRight size={16} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
