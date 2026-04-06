"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Link2, Loader2, Zap, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function UrlToPostPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [contentType, setContentType] = useState<string>("CAROUSEL");
  const [tone, setTone] = useState<string>("friendly");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      // URL 유효성 검사
      try {
        new URL(url);
      } catch {
        setError("유효한 URL을 입력해주세요");
        setIsLoading(false);
        return;
      }

      const res = await fetch("/api/generate/url-to-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          contentType,
          tone: tone as "formal" | "casual" | "friendly",
        }),
      });

      if (res.status === 401) {
        setError("로그인이 필요합니다");
        setIsLoading(false);
        return;
      }

      if (res.status === 402) {
        setError("크레딧이 부족합니다");
        setIsLoading(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "변환 중 오류가 발생했습니다");
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      setSuccess("변환이 완료되었습니다!");
      setTimeout(() => {
        router.push(`/content/${data.contentId}/edit`);
      }, 1500);
    } catch (err) {
      setError("요청 중 오류가 발생했습니다");
    } finally {
      setIsLoading(false);
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
        <h1 className="text-3xl font-bold">URL-to-Post</h1>
        <p className="text-muted-foreground mt-2">
          웹페이지 URL을 입력하면 AI가 카드뉴스나 블로그로 변환합니다
        </p>
      </div>

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>URL 변환</CardTitle>
            <CardDescription>
              변환할 웹페이지의 URL을 입력해주세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* URL 입력 */}
              <div className="space-y-2">
                <Label htmlFor="url">웹페이지 URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://example.com/article"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isLoading}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* 콘텐츠 타입 선택 */}
              <div className="space-y-2">
                <Label>변환 타입</Label>
                <Select value={contentType} onValueChange={setContentType} disabled={isLoading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CAROUSEL">카드뉴스</SelectItem>
                    <SelectItem value="BLOG">블로그 포스트</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 톤 선택 */}
              <div className="space-y-2">
                <Label>톤</Label>
                <Select value={tone} onValueChange={setTone} disabled={isLoading}>
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

              {/* 에러 메시지 */}
              {error && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              {/* 성공 메시지 */}
              {success && (
                <div className="flex items-center gap-2 rounded-md bg-green-100 p-3 text-sm text-green-700">
                  <Zap className="h-4 w-4" />
                  {success}
                </div>
              )}

              {/* 제출 버튼 */}
              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    변환 중...
                  </>
                ) : (
                  <>
                    <Link2 className="mr-2 h-4 w-4" />
                    변환하기
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                변환 시 1 크레딧이 소모됩니다
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
