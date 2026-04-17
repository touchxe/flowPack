import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// POST /api/contact — 문의하기 폼 전송
const contactSchema = z.object({
  inquiryType: z.string().min(1, "문의 유형을 선택해주세요"),
  email:       z.string().email("유효한 이메일 주소를 입력해주세요"),
  message:     z.string().min(10, "문의 내용을 10자 이상 입력해주세요"),
});

const TYPE_LABELS: Record<string, string> = {
  general:   "일반 문의",
  billing:   "결제 및 크레딧",
  technical: "기술 지원",
  feature:   "기능 요청",
  report:    "신고",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { inquiryType, email, message } = contactSchema.parse(body);

    const typeLabel = TYPE_LABELS[inquiryType] ?? inquiryType;

    // Resend로 실제 이메일 전송
    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from: "FlowPack 문의 <noreply@flowpack.dev>",
        to: "support@flowpack.dev",
        replyTo: email,
        subject: `[FlowPack 문의] ${typeLabel} — ${email}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px">
            <h2 style="color:#6366F1">FlowPack 신규 문의</h2>
            <table style="border-collapse:collapse;width:100%">
              <tr>
                <td style="padding:8px 12px;background:#F9FAFB;font-weight:700;width:30%">문의 유형</td>
                <td style="padding:8px 12px;border-left:1px solid #E5E7EB">${typeLabel}</td>
              </tr>
              <tr>
                <td style="padding:8px 12px;background:#F9FAFB;font-weight:700">이메일</td>
                <td style="padding:8px 12px;border-left:1px solid #E5E7EB">${email}</td>
              </tr>
              <tr>
                <td style="padding:8px 12px;background:#F9FAFB;font-weight:700;vertical-align:top">내용</td>
                <td style="padding:8px 12px;border-left:1px solid #E5E7EB;white-space:pre-wrap">${message}</td>
              </tr>
            </table>
          </div>
        `,
      });

      // 발송자에게 접수 확인 이메일
      await resend.emails.send({
        from: "FlowPack 고객지원 <noreply@flowpack.dev>",
        to: email,
        subject: "[FlowPack] 문의가 접수되었습니다",
        html: `
          <div style="font-family:sans-serif;max-width:600px">
            <h2 style="color:#6366F1">문의가 접수되었습니다 ✅</h2>
            <p>안녕하세요, FlowPack 고객지원팀입니다.</p>
            <p>아래 문의가 정상적으로 접수되었습니다. <strong>평일 24시간 내</strong>에 답변 드리겠습니다.</p>
            <div style="background:#F9FAFB;border-radius:8px;padding:16px;margin:16px 0">
              <p style="margin:0;color:#6B7280;font-size:14px"><strong>문의 유형:</strong> ${typeLabel}</p>
              <p style="margin:8px 0 0;color:#6B7280;font-size:14px;white-space:pre-wrap"><strong>내용:</strong> ${message.slice(0, 200)}${message.length > 200 ? "..." : ""}</p>
            </div>
            <p style="color:#9CA3AF;font-size:12px">FlowPack | support@flowpack.dev</p>
          </div>
        `,
      });
    } else {
      // 개발 환경 — 콘솔 로그
      console.log(`📨 [Contact Form] ${typeLabel} from ${email}:\n${message}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Contact form error:", error);
    return NextResponse.json({ error: "전송 중 오류가 발생했습니다." }, { status: 500 });
  }
}
