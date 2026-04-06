"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, FileText, Loader2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function LongformPage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [length, setLength] = useState<string>("medium");
  const [tone, setTone] = useState<string>("friendly");
  const [industry, setIndustry] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [error, setError] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [contentId, setContentId] = useState<string | null>(null);
  const readerRef = { current: null as ReadableStreamDefaultReader | null };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError("주제를 입력해주세요");
      return;
    }

    setIsGenerating(true);
    setError("");
    setGeneratedContent("");
    setWordCount(0);
    setContentId(null);

    try {
      const keywordList = keywords
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

      const res = await fetch("/api/generate/longform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          keywords: keywordList.length > 0 ? keywordList : undefined,
          length,
          tone,
          industry: industry || undefined,
        }),
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
        setError(data.error || "생성 중 오류가 발생했습니다");
        setIsGenerating(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("Response body is null");
      }
      readerRef.current = reader;

      const decoder = new TextDecoder();
      let fullContent = "";

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
                // Status message
              } else if (data.type === "chunk") {
                fullContent += data.content;
                setGeneratedContent(fullContent);
              } else if (data.type === "done") {
                setContentId(data.contentId);
                setWordCount(data.wordCount);
              } else if (data.type === "error") {
                setError(data.message);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      setError("요청 중 오류가 발생했습니다");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCancel = () => {
    if (readerRef.current) {
      readerRef.current.cancel();
      readerRef.current = null;
    }
    setIsGenerating(false);
    if (generatedContent && !contentId) {
      // Save partial content
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
        <h1 className="text-3xl font-bold">Longform Blog</h1>
        <p className="text-muted-foreground mt-2">
          SEO에 최적화된 장문 블로그 포스트를 생성합니다
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* 입력 폼 */}
        <Card>
          <CardHeader>
            <CardTitle>블로그 생성 파라미터</CardTitle>
            <CardDescription>
              블로그 포스트의 옵션을 선택하세요
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
                placeholder="예시: 스타트업의 성장 전략"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isGenerating}
                rows={3}
              />
            </div>

            {/* 키워드 입력 */}
            <div className="space-y-2">
              <Label htmlFor="keywords">키워드 (쉼표로 구분)</Label>
              <Input
                id="keywords"
                placeholder="예시: 스타트업, 성장, 마케팅"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                disabled={isGenerating}
              />
            </div>

            {/* 길이 선택 */}
            <div className="space-y-2">
              <Label>길이</Label>
              <Select value={length} onValueChange={setLength} disabled={isGenerating}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">짧은 (약 500단어)</SelectItem>
                  <SelectItem value="medium">중간 (약 1000단어)</SelectItem>
                  <SelectItem value="long">긴 (약 1500단어)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 톤 선택 */}
            <div className="space-y-2">
              <Label>톤</Label>
              <Select value={tone} onValueChange={setTone} disabled={isGenerating}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="formal">격식체</SelectItem>
                  <SelectItem value="casual">캐주얼</SelectItem>
                  <SelectItem value="friendly">친근한</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 업종 선택 */}
            <div className="space-y-2">
              <Label htmlFor="industry">업종</Label>
              <Select value={industry} onValueChange={setIndustry} disabled={isGenerating}>
                <SelectTrigger id="industry">
                  <SelectValue placeholder="업종 선택 (선택)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tech">IT/기술</SelectItem>
                  <SelectItem value="finance">금융</SelectItem>
                  <SelectItem value="education">교육</SelectItem>
                  <SelectItem value="healthcare">의료</SelectItem>
                  <SelectItem value="retail">도소매</SelectItem>
                  <SelectItem value="other">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {/* 버튼 */}
            {isGenerating ? (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleCancel}>
                  <X className="mr-2 h-4 w-4" />
                  취소
                </Button>
                <Button className="flex-1" disabled>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  생성 중...
                </Button>
              </div>
            ) : (
              <Button className="w-full" size="lg" onClick={handleGenerate}>
                <FileText className="mr-2 h-4 w-4" />
                블로그 생성
              </Button>
            )}
          </CardContent>
        </Card>

        {/* 미리보기 */}
        <Card>
          <CardHeader>
            <CardTitle>미리보기</CardTitle>
            {wordCount > 0 && (
              <CardDescription>약 {wordCount.toLocaleString()} 단어</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {generatedContent ? (
              <div className="space-y-4">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <pre className="whitespace-pre-wrap text-sm">{generatedContent}</pre>
                </div>
                {contentId && (
                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" className="flex-1" onClick={() => router.push(`/content/${contentId}/edit`)}>
                      편집하기
                    </Button>
                    <Button className="flex-1" onClick={() => router.push("/home")}>
                      홈으로
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
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
    </div>
  );
}
