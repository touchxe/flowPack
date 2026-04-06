"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Mail, MessageCircle, HelpCircle, ChevronDown, ChevronUp, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
  {
    question: "비밀번호를 잊어버렸어요",
    answer: "로그인 페이지에서 '비밀번호 찾기'를 클릭하여 회원가입 시 사용한 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.",
  },
  {
    question: "고객 지원 응답 시간은 얼마나 걸리나요?",
    answer: "평일 기준 24시간 이내에 답변을 드립니다. 주말이나 공휴일에는 조금 더 걸릴 수 있습니다.",
  },
];

export default function ContactPage() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [inquiryType, setInquiryType] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [submitted, setSubmitted] = useState<boolean>(false);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would send the inquiry to the server
    setSubmitted(true);
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl">
      <div className="mb-8">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          홈으로
        </Link>
        <h1 className="text-3xl font-bold">문의하기</h1>
        <p className="text-muted-foreground mt-2">
          자주 묻는 질문을 확인하시거나, 문의를 남겨주세요.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* FAQ Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">자주 묻는 질문</h2>
          </div>
          <div className="space-y-2">
            {faqs.map((faq, index) => (
              <Card key={index}>
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full text-left p-4 flex items-center justify-between"
                >
                  <span className="font-medium text-sm">{faq.question}</span>
                  {openFaqIndex === index ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
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

        {/* Contact Form */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Mail className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">1:1 문의하기</h2>
          </div>
          <Card>
            <CardContent className="p-6">
              {submitted ? (
                <div className="text-center py-8">
                  <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
                    <Send className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">문의가 전송되었습니다</h3>
                  <p className="text-muted-foreground text-sm">
                    빠른 시일 내에 답변 드리겠습니다.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">문의 유형</label>
                    <select
                      value={inquiryType}
                      onChange={(e) => setInquiryType(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                      required
                    >
                      <option value="">선택해주세요</option>
                      <option value="general">일반 문의</option>
                      <option value="billing">결제 및 크레딧</option>
                      <option value="technical">기술 지원</option>
                      <option value="feature">기능 요청</option>
                      <option value="report">신고</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">이메일</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">문의 내용</label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full min-h-[150px] px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none"
                      placeholder="문의 내용을 입력해주세요..."
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    <Send className="h-4 w-4 mr-2" />
                    전송하기
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Alternative Contact */}
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">다른 방법으로 문의하기</span>
            </div>
            <p className="text-xs text-muted-foreground">
              이메일: support@flowpack.com
              <br />
              평일 9:00 - 18:00 (점심시간 12:00-13:00 제외)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
