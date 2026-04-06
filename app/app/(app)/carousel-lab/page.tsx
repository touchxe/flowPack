"use client";

import { useState, useEffect } from "react";
import { Zap, Loader2, Image as ImageIcon, RotateCw, Save, AlertCircle, ChevronLeft, Download, Check, Sparkles, Send } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "next-auth/react";
import { ImageGenerationModal } from "@/components/features/content/image-generation-modal";
import { PublishModal } from "@/components/features/publish/publish-modal";

interface Slide {
  index: number;
  title: string;
  body: string;
  imagePrompt?: string;
  imageUrl?: string;
}

interface UserCredits {
  creditsTotal: number;
  creditsUsed: number;
  availableCredits: number;
}

export default function CarouselLabPage() {
  const { data: session } = useSession();
  const [topic, setTopic] = useState("");
  const [industry, setIndustry] = useState("");
  const [tone, setTone] = useState<string>("friendly");
  const [style, setStyle] = useState<string>("promotional");
  const [slideCount, setSlideCount] = useState<number>(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [generatedSlides, setGeneratedSlides] = useState<Slide[]>([]);
  const [contentId, setContentId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [userCredits, setUserCredits] = useState<UserCredits>({ creditsTotal: 10, creditsUsed: 0, availableCredits: 10 });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState<number | null>(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);

  useEffect(() => {
    fetchUserCredits();
  }, []);

  const fetchUserCredits = async () => {
    try {
      const res = await fetch("/api/user/me");
      if (res.ok) {
        const data = await res.json();
        setUserCredits({
          creditsTotal: data.user.creditsTotal,
          creditsUsed: data.user.creditsUsed,
          availableCredits: data.user.availableCredits,
        });
      }
    } catch (err) {
      console.error("Failed to fetch user credits:", err);
    }
  };

  const availableCredits = userCredits.availableCredits;

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError("주제를 입력해주세요.");
      return;
    }

    setIsGenerating(true);
    setError("");
    setGeneratedSlides([]);
    setContentId(null);
    setStatusMessage("AI가 콘텐츠를 생성 중입니다...");

    try {
      const response = await fetch("/api/generate/carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          industry: industry || undefined,
          tone: tone as "formal" | "casual" | "friendly",
          style,
          slideCount,
        }),
      });

      if (response.status === 401) {
        setError("로그인이 필요합니다.");
        setIsGenerating(false);
        return;
      }

      if (response.status === 402) {
        setShowCreditModal(true);
        setIsGenerating(false);
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "생성 중 오류가 발생했습니다.");
        setIsGenerating(false);
        return;
      }

      // SSE 스트리밍 처리
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (!reader) {
        throw new Error("Response body is null");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "status") {
                setStatusMessage(data.message);
              } else if (data.type === "chunk") {
                fullContent += data.content;
                setStatusMessage(`생성 중... ${fullContent.slice(-50)}`);
              } else if (data.type === "done") {
                const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  const parsed = JSON.parse(jsonMatch[0]);
                  setGeneratedSlides(parsed.slides || []);
                  setContentId(data.contentId);
                }
                setStatusMessage("생성이 완료되었습니다!");
              } else if (data.type === "error") {
                setError(data.message);
              }
            } catch {
              // JSON 파싱 오류는 무시
            }
          }
        }
      }
    } catch (err) {
      setError("요청 중 오류가 발생했습니다.");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = () => {
    setGeneratedSlides([]);
    setContentId(null);
    handleGenerate();
  };

  const handleExportPdf = async () => {
    if (generatedSlides.length === 0) return;

    try {
      const { exportCarouselAsPdf, downloadBlob } = await import("@/lib/carousel-export");
      const blob = await exportCarouselAsPdf(generatedSlides);
      downloadBlob(blob, `carousel-${Date.now()}.pdf`);
    } catch (error) {
      console.error("PDF export error:", error);
      setError("PDF 내보내기에 실패했습니다");
    }
  };

  const handleSave = () => {
    if (contentId) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const openImageModal = (slideIndex: number) => {
    setSelectedSlideIndex(slideIndex);
    setImageModalOpen(true);
  };

  const handleImageGenerated = (imageUrl: string, revisedPrompt?: string) => {
    if (selectedSlideIndex !== null) {
      setGeneratedSlides((prev) =>
        prev.map((slide, idx) =>
          idx === selectedSlideIndex
            ? { ...slide, imageUrl, imagePrompt: revisedPrompt || slide.imagePrompt }
            : slide
        )
      );
      setSelectedSlideIndex(null);
    }
  };

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <Link
          href="/home"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          홈으로
        </Link>
        <h1 className="text-3xl font-bold">Carousel Lab</h1>
        <p className="text-muted-foreground mt-2">
          AI를 사용하여 전문 카드뉴스를 빠르게 생성
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* 입력 폼 */}
        <Card>
          <CardHeader>
            <CardTitle>콘텐츠 생성 파라미터</CardTitle>
            <CardDescription>
              생성할 콘텐츠의 옵션을 선택하세요
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 주제 입력 */}
            <div className="space-y-2">
              <Label htmlFor="topic">
                주제 <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="topic"
                placeholder="예시: 당사의 새 상품을 소개합니다"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isGenerating}
                rows={3}
              />
            </div>

            {/* 업종 선택 */}
            <div className="space-y-2">
              <Label htmlFor="industry">업종</Label>
              <Select value={industry} onValueChange={setIndustry} disabled={isGenerating}>
                <SelectTrigger id="industry">
                  <SelectValue placeholder="업종 선택 (선택)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="food">음식점</SelectItem>
                  <SelectItem value="fashion">패션/의류</SelectItem>
                  <SelectItem value="beauty">뷰티/미용</SelectItem>
                  <SelectItem value="tech">IT/기술</SelectItem>
                  <SelectItem value="education">교육</SelectItem>
                  <SelectItem value="healthcare">의료/건강</SelectItem>
                  <SelectItem value="finance">금융/보험</SelectItem>
                  <SelectItem value="realestate">부동산</SelectItem>
                  <SelectItem value="travel">여행/호텔</SelectItem>
                  <SelectItem value="entertainment">엔터테인먼트</SelectItem>
                  <SelectItem value="other">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 톤 선택 */}
            <div className="space-y-2">
              <Label htmlFor="tone">톤</Label>
              <Select value={tone} onValueChange={setTone} disabled={isGenerating}>
                <SelectTrigger id="tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="formal">격식체</SelectItem>
                  <SelectItem value="casual">캐주얼</SelectItem>
                  <SelectItem value="friendly">친근한</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 스타일 선택 */}
            <div className="space-y-2">
              <Label htmlFor="style">스타일</Label>
              <Select value={style} onValueChange={setStyle} disabled={isGenerating}>
                <SelectTrigger id="style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="informative">정보 전달형</SelectItem>
                  <SelectItem value="promotional">홍보성</SelectItem>
                  <SelectItem value="educational">교육적</SelectItem>
                  <SelectItem value="entertaining">재미있는</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 슬라이드 수 */}
            <div className="space-y-2">
              <Label htmlFor="slideCount">슬라이드 수: {slideCount}</Label>
              <Input
                id="slideCount"
                type="range"
                min={3}
                max={10}
                value={slideCount}
                onChange={(e) => setSlideCount(parseInt(e.target.value))}
                disabled={isGenerating}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>3</span>
                <span>10</span>
              </div>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {/* 크레딧 잔액 */}
            <div className="rounded-md bg-muted p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">사용 가능 크레딧</span>
                <span className="text-sm font-bold text-primary">
                  {availableCredits} / {userCredits.creditsTotal}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-secondary">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${(availableCredits / userCredits.creditsTotal) * 100}%` }}
                />
              </div>
            </div>

            {/* 생성 버튼 */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleGenerate}
              disabled={isGenerating || availableCredits < 1}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  카드뉴스 생성
                </>
              )}
            </Button>

            {/* 로딩 상태 메시지 */}
            {isGenerating && statusMessage && (
              <div className="text-center text-sm text-muted-foreground animate-pulse">
                {statusMessage}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 미리보기 */}
        <Card>
          <CardHeader>
            <CardTitle>미리보기</CardTitle>
            <CardDescription>
              생성된 카드뉴스를 확인하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            {generatedSlides.length > 0 ? (
              <div className="space-y-4">
                {generatedSlides.map((slide, index) => (
                  <div
                    key={index}
                    className="rounded-lg border bg-card p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Slide {index + 1}
                      </span>
                      {slide.imageUrl ? (
                        <img
                          src={slide.imageUrl}
                          alt={`Slide ${index + 1} image`}
                          className="h-12 w-12 rounded object-cover"
                        />
                      ) : slide.imagePrompt ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openImageModal(index)}
                          className="h-8 px-2"
                        >
                          <Sparkles className="h-4 w-4 mr-1" />
                          이미지 생성
                        </Button>
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <h3 className="font-semibold">{slide.title}</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {slide.body}
                    </p>
                    {slide.imageUrl && (
                      <p className="text-xs text-muted-foreground italic">
                        이미지 적용됨
                      </p>
                    )}
                  </div>
                ))}

                {/* 액션 버튼 */}
                <div className="flex flex-wrap gap-2 pt-4">
                  <Button variant="outline" onClick={handleRegenerate}>
                    <RotateCw className="mr-2 h-4 w-4" />
                    다시 생성
                  </Button>
                  <Button variant="outline" onClick={handleExportPdf}>
                    <Download className="mr-2 h-4 w-4" />
                    PDF 내보내기
                  </Button>
                  <Button onClick={handleSave} disabled={!contentId}>
                    {saveSuccess ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        저장됨
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        저장
                      </>
                    )}
                  </Button>
                  <Button onClick={() => setPublishModalOpen(true)} disabled={!contentId}>
                    <Send className="mr-2 h-4 w-4" />
                    배포
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <Zap className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">
                  왼쪽 양식에 입력 후<br />
                  생성 버튼을 클릭하세요
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 크레딧 부족 모달 */}
      {showCreditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Card className="w-full max-w-md mx-4">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>크레딧 부족</CardTitle>
              <CardDescription>
                생성에 필요한 크레딧이 부족합니다.
                <br />
                크레딧을 충전해주세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full">크레딧 구매</Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowCreditModal(false)}
              >
                닫기
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 이미지 생성 모달 */}
      <ImageGenerationModal
        isOpen={imageModalOpen}
        onClose={() => {
          setImageModalOpen(false);
          setSelectedSlideIndex(null);
        }}
        onImageGenerated={handleImageGenerated}
        contentId={contentId || undefined}
      />

      {/* 배포 모달 */}
      <PublishModal
        open={publishModalOpen}
        onOpenChange={setPublishModalOpen}
        contentId={contentId || ""}
        contentTitle={topic || "카드뉴스"}
      />
    </div>
  );
}
