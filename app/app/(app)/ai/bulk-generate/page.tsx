"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, Trash2, Loader2, Check, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BulkItem {
  id: string;
  topic: string;
  contentType: "CAROUSEL" | "BLOG";
  slideCount: number;
  tone: string;
  status?: "pending" | "processing" | "completed" | "failed";
  contentId?: string;
  error?: string;
}

export default function BulkGeneratePage() {
  const [items, setItems] = useState<BulkItem[]>([
    { id: "1", topic: "", contentType: "CAROUSEL", slideCount: 5, tone: "friendly" },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [completedCount, setCompletedCount] = useState(0);

  const addItem = () => {
    if (items.length >= 10) return;
    const newId = String(Date.now());
    setItems([
      ...items,
      { id: newId, topic: "", contentType: "CAROUSEL", slideCount: 5, tone: "friendly" },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof BulkItem, value: string | number) => {
    setItems(
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleGenerate = async () => {
    const validItems = items.filter((item) => item.topic.trim().length > 0);
    if (validItems.length === 0) {
      setError("최소 1개 이상의 주제를 입력해주세요");
      return;
    }

    setIsGenerating(true);
    setError("");

    setItems(items.map((item) => ({ ...item, status: "processing" as const })));

    try {
      const res = await fetch("/api/generate/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            id: item.id,
            topic: item.topic,
            contentType: item.contentType,
            slideCount: item.slideCount,
            tone: item.tone,
          })),
        }),
      });

      if (res.status === 401) {
        setError("로그인이 필요합니다");
        setItems(items.map((item) => ({ ...item, status: "pending" as const })));
        setIsGenerating(false);
        return;
      }

      if (res.status === 402) {
        const data = await res.json();
        setError(data.error || "크레딧이 부족합니다");
        setItems(items.map((item) => ({ ...item, status: "pending" as const })));
        setIsGenerating(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "일괄 생성 중 오류가 발생했습니다");
        setItems(items.map((item) => ({ ...item, status: "pending" as const })));
        setIsGenerating(false);
        return;
      }

      const data = await res.json();

      setItems(
        items.map((item) => {
          const result = data.results.find((r: { id: string }) => r.id === item.id);
          if (result) {
            return {
              ...item,
              status: result.status,
              contentId: result.contentId,
              error: result.error,
            };
          }
          return item;
        })
      );

      setCompletedCount(data.totalCreditsUsed || 0);
    } catch (err) {
      setError("요청 중 오류가 발생했습니다");
      setItems(items.map((item) => ({ ...item, status: "pending" as const })));
    } finally {
      setIsGenerating(false);
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
        <h1 className="text-3xl font-bold">Bulk Generate</h1>
        <p className="text-muted-foreground mt-2">
          여러 주제의 콘텐츠를 한 번에 생성합니다
        </p>
      </div>

      <div className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>생성 목록</CardTitle>
                <CardDescription>최대 10개까지 한 번에 생성 가능</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={addItem} disabled={items.length >= 10 || isGenerating}>
                <Plus className="h-4 w-4 mr-1" />
                행 추가
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-12 gap-4 text-sm font-medium text-muted-foreground px-1">
                <div className="col-span-1">상태</div>
                <div className="col-span-5">주제</div>
                <div className="col-span-2">유형</div>
                <div className="col-span-2">슬라이드</div>
                <div className="col-span-1"></div>
              </div>

              {items.map((item, index) => (
                <div key={item.id} className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-1">
                    {item.status === "pending" && (
                      <div className="h-6 w-6 rounded-full border-2 border-muted" />
                    )}
                    {item.status === "processing" && (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    )}
                    {item.status === "completed" && (
                      <Check className="h-5 w-5 text-green-600" />
                    )}
                    {item.status === "failed" && (
                      <X className="h-5 w-5 text-destructive" />
                    )}
                  </div>

                  <div className="col-span-5">
                    <Input
                      placeholder={`주제 ${index + 1}`}
                      value={item.topic}
                      onChange={(e) => updateItem(item.id, "topic", e.target.value)}
                      disabled={isGenerating}
                    />
                  </div>

                  <div className="col-span-2">
                    <Select
                      value={item.contentType}
                      onValueChange={(value) => updateItem(item.id, "contentType", value)}
                      disabled={isGenerating}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CAROUSEL">카드뉴스</SelectItem>
                        <SelectItem value="BLOG">블로그</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2">
                    <Input
                      type="number"
                      min={3}
                      max={10}
                      value={item.slideCount}
                      onChange={(e) => updateItem(item.id, "slideCount", parseInt(e.target.value) || 5)}
                      disabled={isGenerating || item.contentType === "BLOG"}
                    />
                  </div>

                  <div className="col-span-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                      disabled={items.length <= 1 || isGenerating}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {item.error && (
                    <div className="col-span-12 text-sm text-destructive">
                      {item.error}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-6 pt-6 border-t">
              <div className="text-sm text-muted-foreground">
                {items.length}개 항목 | {items.filter((i) => i.topic.trim()).length}개 유효
              </div>
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || items.filter((i) => i.topic.trim()).length === 0}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  "일괄 생성"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {completedCount > 0 && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-green-800">
                    {completedCount}개 콘텐츠가 생성되었습니다
                  </p>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/home">홈으로</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
