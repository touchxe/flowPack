"use client";

import { useState } from "react";
import { Sparkles, Loader2, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

interface ImageGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageGenerated: (imageUrl: string, revisedPrompt?: string) => void;
  contentId?: string;
}

export function ImageGenerationModal({
  isOpen,
  onClose,
  onImageGenerated,
  contentId,
}: ImageGenerationModalProps) {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<string>("natural");
  const [size, setSize] = useState<string>("1024x1024");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [revisedPrompt, setRevisedPrompt] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("프롬프트를 입력해주세요");
      return;
    }

    setIsGenerating(true);
    setError("");
    setGeneratedImage(null);

    try {
      const res = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style, size, contentId }),
      });

      if (res.status === 401) {
        setError("로그인이 필요합니다");
        setIsGenerating(false);
        return;
      }

      if (res.status === 402) {
        setError("크레딧이 부족합니다");
        setIsGenerating(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "이미지 생성에 실패했습니다");
      }

      const data = await res.json();
      setGeneratedImage(data.url);
      setRevisedPrompt(data.revisedPrompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = () => {
    if (generatedImage) {
      onImageGenerated(generatedImage, revisedPrompt || undefined);
      handleClose();
    }
  };

  const handleRegenerate = () => {
    setGeneratedImage(null);
    setRevisedPrompt(null);
    handleGenerate();
  };

  const handleClose = () => {
    setPrompt("");
    setStyle("natural");
    setSize("1024x1024");
    setGeneratedImage(null);
    setRevisedPrompt(null);
    setError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-lg mx-4">
        <CardContent className="p-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">AI 이미지 생성</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* 생성된 이미지 미리보기 */}
          {generatedImage ? (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden bg-muted">
                <img
                  src={generatedImage}
                  alt="Generated"
                  className="w-full h-auto"
                />
              </div>
              {revisedPrompt && (
                <p className="text-xs text-muted-foreground">
                  수정된 프롬프트: {revisedPrompt}
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleRegenerate} disabled={isGenerating}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  다시 생성
                </Button>
                <Button className="flex-1" onClick={handleApply}>
                  적용
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 프롬프트 입력 */}
              <div className="space-y-2">
                <Label htmlFor="prompt">이미지 설명</Label>
                <textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="생성할 이미지를 텍스트로 설명해주세요"
                  className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={isGenerating}
                />
              </div>

              {/* 스타일 선택 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>스타일</Label>
                  <Select value={style} onValueChange={setStyle} disabled={isGenerating}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="natural">자연적</SelectItem>
                      <SelectItem value="vivid">생생한</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 화면 비율 선택 */}
                <div className="space-y-2">
                  <Label>화면 비율</Label>
                  <Select value={size} onValueChange={setSize} disabled={isGenerating}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1024x1024">1:1 (정사각형)</SelectItem>
                      <SelectItem value="1792x1024">16:9 (와이드)</SelectItem>
                      <SelectItem value="1024x1792">9:16 (세로)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 비용 안내 */}
              <p className="text-xs text-muted-foreground">
                이미지 생성 시 1 크레딧이 소모됩니다.
              </p>

              {/* 생성 버튼 */}
              <Button className="w-full" onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    생성 중... (30초内有효)
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    이미지 생성
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
