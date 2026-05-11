"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { MessageSquare, Send, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatRelativeTime } from "@/lib/utils";

interface Slide {
  index?: number;
  title?: string;
  body?: string;
  imagePrompt?: string;
  imageUrl?: string;
}

interface ContentImage {
  id: string;
  url: string;
  altText: string | null;
  order: number;
}

interface Annotation {
  id: string;
  slideIndex: number;
  number: number;
  authorName: string | null;
  body: string;
  createdAt: string;
}

interface PublicContent {
  id: string;
  title: string;
  type: string;
  body: string | null;
  slides: Slide[] | null;
  thumbnailUrl: string | null;
  images: ContentImage[];
  annotations: Annotation[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface PublicContentReviewProps {
  shareToken: string;
}

function getSlideImage(slide: Slide, images: ContentImage[], index: number): string | null {
  if (slide.imageUrl) return slide.imageUrl;
  const matchedImage = images.find((image) => image.order === index);
  if (matchedImage) return matchedImage.url;
  if (slide.imagePrompt?.startsWith("http")) return slide.imagePrompt;
  return null;
}

function groupAnnotationsBySlide(annotations: Annotation[]): Map<number, Annotation[]> {
  const grouped = new Map<number, Annotation[]>();
  annotations.forEach((annotation) => {
    const current = grouped.get(annotation.slideIndex) ?? [];
    grouped.set(annotation.slideIndex, [...current, annotation]);
  });
  return grouped;
}

export function PublicContentReview({
  shareToken,
}: PublicContentReviewProps): React.ReactElement {
  const [content, setContent] = useState<PublicContent | null>(null);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [authorName, setAuthorName] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchContent(): Promise<void> {
      if (!shareToken) {
        setError("공유 토큰이 없는 링크입니다.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/public/content/${shareToken}`);
        const result = (await response.json()) as ApiResponse<PublicContent>;

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error ?? "공유 콘텐츠를 불러오지 못했습니다.");
        }

        setContent(result.data);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchContent();
  }, [shareToken]);

  const slides = useMemo<Slide[]>(() => {
    if (content?.slides && Array.isArray(content.slides) && content.slides.length > 0) {
      return content.slides;
    }

    if (content?.body) {
      return [{ index: 0, title: content.title, body: content.body }];
    }

    return [];
  }, [content]);

  const annotationsBySlide = useMemo(
    () => groupAnnotationsBySlide(content?.annotations ?? []),
    [content?.annotations]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!commentBody.trim() || !content) return;

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/public/content/${shareToken}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slideIndex: selectedSlideIndex,
          authorName: authorName.trim() || undefined,
          body: commentBody.trim(),
        }),
      });
      const result = (await response.json()) as ApiResponse<Annotation>;

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error ?? "수정의견을 저장하지 못했습니다.");
      }

      setContent({
        ...content,
        annotations: [...content.annotations, result.data],
      });
      setCommentBody("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          콘텐츠를 불러오는 중...
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-base font-medium">공유 콘텐츠를 볼 수 없습니다</p>
              <p className="mt-1 text-sm text-muted-foreground">
                링크가 만료되었거나 공유가 중지되었습니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:px-6">
        <section className="min-w-0 space-y-5">
          <div className="rounded-lg border bg-background px-5 py-4">
            <p className="text-xs font-medium text-primary">FlowPack 공유 검토</p>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">{content.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              수정이 필요한 슬라이드를 선택한 뒤 오른쪽에서 의견을 남겨주세요.
            </p>
          </div>

          <div className="space-y-4">
            {slides.map((slide, index) => {
              const slideAnnotations = annotationsBySlide.get(index) ?? [];
              const imageUrl = getSlideImage(slide, content.images, index);

              return (
                <article
                  key={`${slide.title ?? "slide"}-${index}`}
                  className={cn(
                    "rounded-lg border bg-background p-4 transition-colors",
                    selectedSlideIndex === index && "border-primary ring-1 ring-primary"
                  )}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedSlideIndex(index)}
                      className="text-left"
                    >
                      <span className="text-xs font-medium text-muted-foreground">
                        슬라이드 {index + 1}
                      </span>
                      <h2 className="mt-1 text-lg font-semibold text-foreground">
                        {slide.title || `슬라이드 ${index + 1}`}
                      </h2>
                    </button>
                    <Button
                      type="button"
                      variant={selectedSlideIndex === index ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedSlideIndex(index)}
                    >
                      <MessageSquare className="h-4 w-4" />
                      수정의견
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[minmax(220px,360px)_1fr]">
                    <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={slide.title || `슬라이드 ${index + 1} 이미지`}
                          fill
                          sizes="(min-width: 768px) 360px, 100vw"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                          이미지 미리보기가 없습니다
                        </div>
                      )}

                      {slideAnnotations.length > 0 && (
                        <div className="absolute right-3 top-3 flex flex-wrap justify-end gap-1">
                          {slideAnnotations.map((annotation) => (
                            <span
                              key={annotation.id}
                              className="flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground shadow"
                            >
                              {annotation.number}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border bg-card p-4">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {slide.body || "본문이 없습니다."}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>수정의견 추가</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  선택된 슬라이드: {selectedSlideIndex + 1}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="authorName">이름</Label>
                  <Input
                    id="authorName"
                    value={authorName}
                    onChange={(event) => setAuthorName(event.target.value)}
                    placeholder="이름 또는 닉네임"
                    maxLength={40}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commentBody">수정의견</Label>
                  <Textarea
                    id="commentBody"
                    value={commentBody}
                    onChange={(event) => setCommentBody(event.target.value)}
                    placeholder="수정이 필요한 내용을 입력하세요"
                    maxLength={1000}
                    className="min-h-32"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button className="w-full" type="submit" disabled={isSubmitting || !commentBody.trim()}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {isSubmitting ? "저장 중..." : "의견 저장"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>수정의견 목록</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {content.annotations.length === 0 ? (
                <p className="rounded-md bg-muted px-3 py-6 text-center text-sm text-muted-foreground">
                  아직 등록된 수정의견이 없습니다.
                </p>
              ) : (
                content.annotations.map((annotation) => (
                  <button
                    key={annotation.id}
                    type="button"
                    onClick={() => setSelectedSlideIndex(annotation.slideIndex)}
                    className="w-full rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary/40"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground">
                        {annotation.number}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        슬라이드 {annotation.slideIndex + 1}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground">{annotation.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {annotation.authorName || "익명"} · {formatRelativeTime(annotation.createdAt)}
                    </p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}
