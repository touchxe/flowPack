"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Save, Plus, Trash2, GripVertical, Image as ImageIcon, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useSession } from "next-auth/react";
import { ImageGenerationModal } from "@/components/features/content/image-generation-modal";
import { PublishModal } from "@/components/features/publish/publish-modal";

interface Slide {
  index: number;
  title: string;
  body: string;
  imagePrompt?: string;
}

interface ContentData {
  id: string;
  title: string;
  type: string;
  slides: Slide[];
  status: string;
}

export default function ContentEditPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const contentId = params.id as string;

  const [content, setContent] = useState<ContentData | null>(null);
  const [title, setTitle] = useState("");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState<number | null>(null);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  useEffect(() => {
    async function fetchContent() {
      try {
        const res = await fetch(`/api/content/${contentId}`);
        if (!res.ok) {
          throw new Error("콘텐츠를 찾을 수 없습니다");
        }
        const data = await res.json();
        setContent(data.content);
        setTitle(data.content.title);
        setSlides(data.content.slides || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "오류가 발생했습니다");
      } finally {
        setIsLoading(false);
      }
    }

    fetchContent();
  }, [contentId]);

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;

    const newSlides = Array.from(slides);
    const [removed] = newSlides.splice(result.source.index, 1);
    newSlides.splice(result.destination.index, 0, removed);

    // 인덱스 재할당
    const reorderedSlides = newSlides.map((slide, idx) => ({
      ...slide,
      index: idx,
    }));

    setSlides(reorderedSlides);
  }, [slides]);

  const updateSlide = (index: number, field: keyof Slide, value: string) => {
    const newSlides = [...slides];
    newSlides[index] = { ...newSlides[index], [field]: value };
    setSlides(newSlides);
  };

  const addSlide = () => {
    const newSlide: Slide = {
      index: slides.length,
      title: "",
      body: "",
      imagePrompt: "",
    };
    setSlides([...slides, newSlide]);
  };

  const deleteSlide = (index: number) => {
    const newSlides = slides.filter((_, i) => i !== index);
    const reorderedSlides = newSlides.map((slide, idx) => ({
      ...slide,
      index: idx,
    }));
    setSlides(reorderedSlides);
  };

  const openImageModal = (slideIndex: number) => {
    setSelectedSlideIndex(slideIndex);
    setIsImageModalOpen(true);
  };

  const handleImageGenerated = (imageUrl: string, revisedPrompt?: string) => {
    if (selectedSlideIndex !== null) {
      updateSlide(selectedSlideIndex, "imagePrompt", revisedPrompt || imageUrl);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/content/${contentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slides,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "저장 중 오류가 발생했습니다");
      }

      setSuccess("저장되었습니다!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">로딩 중...</div>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">콘텐츠를 찾을 수 없습니다</p>
          <Button asChild>
            <Link href="/home">홈으로 돌아가기</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      {/* 헤더 */}
      <div className="mb-8">
        <Link
          href="/home"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          홈으로
        </Link>
        <h1 className="text-3xl font-bold">콘텐츠 편집</h1>
        <p className="text-muted-foreground mt-2">카드뉴스 슬라이드를 편집하세요</p>
      </div>

      {/* 알림 */}
      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-md bg-green-100 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        {/* 슬라이드 목록 (드래그 앤 드롭) */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>슬라이드 목록</CardTitle>
                <Button size="sm" onClick={addSlide}>
                  <Plus className="h-4 w-4 mr-1" />
                  슬라이드 추가
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="slides">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-3"
                    >
                      {slides.map((slide, index) => (
                        <Draggable key={index} draggableId={`slide-${index}`} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`rounded-lg border bg-card p-4 ${
                                snapshot.isDragging ? "shadow-lg" : ""
                              }`}
                            >
                              <div className="flex gap-4">
                                <div
                                  {...provided.dragHandleProps}
                                  className="flex items-center text-muted-foreground cursor-grab"
                                >
                                  <GripVertical className="h-5 w-5" />
                                </div>

                                <div className="flex-1 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-muted-foreground">
                                      Slide {index + 1}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => deleteSlide(index)}
                                      className="text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor={`title-${index}`}>제목</Label>
                                    <Input
                                      id={`title-${index}`}
                                      value={slide.title}
                                      onChange={(e) => updateSlide(index, "title", e.target.value)}
                                      placeholder="슬라이드 제목을 입력하세요"
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor={`body-${index}`}>본문</Label>
                                    <textarea
                                      id={`body-${index}`}
                                      value={slide.body}
                                      onChange={(e) => updateSlide(index, "body", e.target.value)}
                                      placeholder="슬라이드 내용을 입력하세요"
                                      className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <Label htmlFor={`imagePrompt-${index}`}>
                                        이미지 프롬프트
                                      </Label>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openImageModal(index)}
                                      >
                                        <ImageIcon className="h-4 w-4 mr-1" />
                                        AI 이미지
                                      </Button>
                                    </div>
                                    <Input
                                      id={`imagePrompt-${index}`}
                                      value={slide.imagePrompt || ""}
                                      onChange={(e) => updateSlide(index, "imagePrompt", e.target.value)}
                                      placeholder="DALL-E용 이미지 프롬프트"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              {slides.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  슬라이드가 없습니다. "슬라이드 추가" 버튼을 클릭하세요.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 사이드바 - 제목 및 저장 */}
        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>기본 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">제목</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="콘텐츠 제목을 입력하세요"
                />
              </div>

              <div className="space-y-2">
                <Label>슬라이드 수</Label>
                <p className="text-2xl font-bold">{slides.length}</p>
              </div>

              <div className="space-y-2">
                <Label>현재 상태</Label>
                <p className="text-sm font-medium">{content.status}</p>
              </div>

              <Button className="w-full" onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "저장 중..." : "변경 사항 저장"}
              </Button>

              <Button
                className="w-full mt-2"
                variant="outline"
                onClick={() => setIsPublishModalOpen(true)}
              >
                <Share2 className="h-4 w-4 mr-2" />
                배포하기
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AI 이미지 생성 모달 */}
      <ImageGenerationModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        onImageGenerated={handleImageGenerated}
        contentId={contentId}
      />

      {/* 배포 모달 */}
      <PublishModal
        open={isPublishModalOpen}
        onOpenChange={setIsPublishModalOpen}
        contentId={contentId}
        contentTitle={title}
      />
    </div>
  );
}
