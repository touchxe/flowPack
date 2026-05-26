import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aiNotConfiguredResponse, callAI, isAIConfigured } from "@/lib/ai-client";
import { z } from "zod";
import * as cheerio from "cheerio";

const MAX_SOURCE_LENGTH = 5000;
const MAX_IMAGES_TO_IMPORT = 12;

const urlToContentSchema = z.object({
  url: z.string().url("유효한 URL을 입력해주세요"),
  contentType: z.enum(["CAROUSEL", "BLOG"]).default("CAROUSEL"),
  tone: z.enum(["formal", "casual", "friendly"]).default("friendly"),
  slideCount: z.number().min(3).max(10).default(5).optional(),
  sourceMode: z.enum(["AI", "ORIGINAL"]).default("AI"),
  includeSourceUrl: z.boolean().default(true),
  importImages: z.boolean().default(false),
  scheduledAt: z.string().optional(),
});

type UrlContent = {
  title: string;
  description: string;
  content: string;
  images: string[];
};

function getAbsoluteUrl(value: string | undefined, baseUrl: string): string | null {
  if (!value) return null;

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function getUniqueImages(images: string[]): string[] {
  const seen = new Set<string>();

  return images
    .filter((image) => image.startsWith("http://") || image.startsWith("https://"))
    .filter((image) => {
      if (seen.has(image)) return false;
      seen.add(image);
      return true;
    })
    .slice(0, MAX_IMAGES_TO_IMPORT);
}

async function fetchUrlContent(url: string): Promise<UrlContent> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "FlowPack Content Analyzer/1.0",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title =
      $("meta[property='og:title']").attr("content") ||
      $("title").text() ||
      $("h1").first().text() ||
      "";

    const description =
      $("meta[property='og:description']").attr("content") ||
      $("meta[name='description']").attr("content") ||
      "";

    const metaImages = [
      $("meta[property='og:image']").attr("content"),
      $("meta[name='twitter:image']").attr("content"),
      $("link[rel='image_src']").attr("href"),
    ];

    const pageImages = $("img")
      .map((_, element) => {
        const src =
          $(element).attr("src") ||
          $(element).attr("data-src") ||
          $(element).attr("data-original") ||
          $(element).attr("data-lazy-src");
        return getAbsoluteUrl(src, url);
      })
      .get()
      .filter((image): image is string => Boolean(image));

    const images = getUniqueImages([
      ...metaImages
        .map((image) => getAbsoluteUrl(image, url))
        .filter((image): image is string => Boolean(image)),
      ...pageImages,
    ]);

    $("script, style, nav, header, footer, aside, noscript, .ad, .advertisement").remove();

    let content = "";
    $("p, h1, h2, h3, h4, h5, h6, li").each((_, element) => {
      const text = $(element).text().replace(/\s+/g, " ").trim();
      if (text.length > 20) {
        content += `${text}\n`;
      }
    });

    return {
      title: title.trim(),
      description: description.trim(),
      content: content.trim().slice(0, MAX_SOURCE_LENGTH),
      images,
    };
  } catch {
    throw new Error("URL에 접근할 수 없습니다");
  }
}

function getToneLabel(tone: "formal" | "casual" | "friendly"): string {
  if (tone === "formal") return "격식체";
  if (tone === "casual") return "캐주얼";
  return "친근한 톤";
}

function getSourceUrlBlock(url: string, contentType: "CAROUSEL" | "BLOG"): string {
  if (contentType === "BLOG") {
    return `<p><strong>원본 주소</strong>: <a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></p>`;
  }

  return `\n\n원본 주소: ${url}`;
}

function buildOriginalBlogBody(source: UrlContent, url: string, includeSourceUrl: boolean): string {
  const paragraphs = source.content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${line}</p>`)
    .join("\n");

  const heading = source.description ? `<p>${source.description}</p>\n` : "";
  const sourceBlock = includeSourceUrl ? `\n${getSourceUrlBlock(url, "BLOG")}` : "";

  return `${heading}${paragraphs}${sourceBlock}`;
}

function buildOriginalSlides(source: UrlContent, url: string, includeSourceUrl: boolean, slideCount = 5) {
  const sentences = source.content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, slideCount);

  const slides = sentences.map((line, index) => ({
    index,
    title: index === 0 ? source.title || "원문 요약" : `핵심 내용 ${index + 1}`,
    body: line,
    imagePrompt: "",
  }));

  if (slides.length === 0) {
    slides.push({
      index: 0,
      title: source.title || "원문 내용",
      body: source.description || source.content,
      imagePrompt: "",
    });
  }

  if (includeSourceUrl) {
    slides.push({
      index: slides.length,
      title: "원본 주소",
      body: url,
      imagePrompt: "",
    });
  }

  return slides.map((slide, index) => ({ ...slide, index }));
}

function attachImagesToSlides<T extends { index: number }>(slides: T[], images: string[]): Array<T & { imageUrl?: string }> {
  if (images.length === 0) return slides;

  return slides.map((slide, index) => ({
    ...slide,
    ...(images[index % images.length] ? { imageUrl: images[index % images.length] } : {}),
  }));
}

async function saveImportedImages(contentId: string, images: string[], title: string) {
  if (images.length === 0) return;

  await prisma.$transaction(
    images.map((image, order) =>
      prisma.contentImage.create({
        data: {
          contentId,
          url: image,
          altText: title || "가져온 이미지",
          order,
        },
      })
    )
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      url,
      contentType,
      tone,
      slideCount,
      sourceMode,
      includeSourceUrl,
      importImages,
      scheduledAt,
    } = urlToContentSchema.parse(body);
    const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;

    if (sourceMode === "AI" && !(await isAIConfigured())) {
      return aiNotConfiguredResponse();
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isUnlimited = user.role === "ADMIN" || user.plan === "ENTERPRISE";
    const availableCredits = user.creditsTotal - user.creditsUsed;
    if (!isUnlimited && availableCredits < 1) {
      return NextResponse.json({ error: "CREDIT_EXHAUSTED" }, { status: 402 });
    }

    const source = await fetchUrlContent(url);

    if (!source.content) {
      return NextResponse.json(
        { error: "URL에서 콘텐츠를 추출할 수 없습니다" },
        { status: 400 }
      );
    }

    const importedImages = importImages ? source.images : [];
    const toneText = getToneLabel(tone);

    if (contentType === "CAROUSEL") {
      let slidesData: Array<{
        index: number;
        title: string;
        body: string;
        imagePrompt?: string;
        imageUrl?: string;
      }>;
      let aiProvider: string | undefined;
      let aiModel: string | undefined;
      let aiLogResponse = "";

      if (sourceMode === "ORIGINAL") {
        slidesData = attachImagesToSlides(
          buildOriginalSlides(source, url, includeSourceUrl, slideCount || 5),
          importedImages
        );
      } else {
        const aiResult = await callAI({
          messages: [
            {
              role: "system",
              content: `당신은 콘텐츠 변환 전문가입니다. 입력된 웹페이지 내용을 분석하여 캐러셀 형식으로 새롭게 작성해주세요.

톤: ${toneText}
슬라이드 수: ${slideCount || 5}`,
            },
            {
              role: "user",
              content: `다음 웹페이지 내용을 캐러셀로 작성해주세요.

원본 URL: ${url}
제목: ${source.title}
설명: ${source.description}
내용: ${source.content}

응답 형식:
{
  "slides": [
    { "index": 0, "title": "제목", "body": "내용", "imagePrompt": "DALL-E image prompt in English" }
  ]
}

${slideCount || 5}개의 슬라이드를 생성하고, JSON 외의 다른 텍스트 없이 순수 JSON만 반환해주세요.`,
            },
          ],
          maxTokens: 2000,
        });

        aiProvider = aiResult.provider;
        aiModel = aiResult.model;
        aiLogResponse = aiResult.content;

        const jsonMatch = aiResult.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return NextResponse.json({ error: "변환에 실패했습니다" }, { status: 500 });
        }

        const parsed = JSON.parse(jsonMatch[0]) as {
          slides?: Array<{ index: number; title: string; body: string; imagePrompt?: string }>;
        };

        slidesData = attachImagesToSlides(parsed.slides ?? [], importedImages);

        if (includeSourceUrl) {
          slidesData.push({
            index: slidesData.length,
            title: "원본 주소",
            body: url,
            imagePrompt: "",
          });
        }
      }

      const aiLog = JSON.stringify({
        sourceMode,
        importImages,
        sourceUrl: url,
        response: aiLogResponse.slice(0, 3000),
        timestamp: new Date().toISOString(),
      });

      const contentRecord = await prisma.content.create({
        data: {
          userId: session.user.id,
          title: source.title || "URL 콘텐츠",
          type: "CAROUSEL",
          slides: JSON.stringify(slidesData.map((slide, index) => ({ ...slide, index }))),
          thumbnailUrl: importedImages[0],
          status: scheduledDate ? "SCHEDULED" : "DRAFT",
          scheduledAt: scheduledDate ?? undefined,
          aiProvider,
          aiModel,
          aiLog,
        },
      });

      await saveImportedImages(contentRecord.id, importedImages, source.title);

      if (!isUnlimited) {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { creditsUsed: { increment: 1 } },
        });
      }

      return NextResponse.json({
        success: true,
        contentId: contentRecord.id,
        originalUrl: url,
        importedImages: importedImages.length,
      });
    }

    let blogContent = "";
    let aiProvider: string | undefined;
    let aiModel: string | undefined;
    let aiLogResponse = "";

    if (sourceMode === "ORIGINAL") {
      blogContent = buildOriginalBlogBody(source, url, includeSourceUrl);
    } else {
      const aiResult = await callAI({
        messages: [
          {
            role: "system",
            content: "당신은 콘텐츠 작성 전문가입니다. 입력된 웹페이지 내용을 바탕으로 SEO에 맞는 블로그 포스트를 새롭게 작성해주세요.",
          },
          {
            role: "user",
            content: `다음 웹페이지 내용을 블로그 포스트로 작성해주세요.

원본 URL: ${url}
제목: ${source.title}
설명: ${source.description}
내용: ${source.content}

톤: ${toneText}
마크다운 형식으로 반환해주세요.`,
          },
        ],
        maxTokens: 3000,
      });

      blogContent = aiResult.content;
      aiProvider = aiResult.provider;
      aiModel = aiResult.model;
      aiLogResponse = aiResult.content;

      if (includeSourceUrl) {
        blogContent = `${blogContent}\n\n${getSourceUrlBlock(url, "BLOG")}`;
      }
    }

    if (importedImages.length > 0) {
      const imageBlocks = importedImages
        .slice(0, 3)
        .map((image, index) => `<p><img src="${image}" alt="${source.title || `가져온 이미지 ${index + 1}`}" /></p>`)
        .join("\n");
      blogContent = `${imageBlocks}\n${blogContent}`;
    }

    const blogAiLog = JSON.stringify({
      sourceMode,
      importImages,
      sourceUrl: url,
      response: aiLogResponse.slice(0, 3000),
      timestamp: new Date().toISOString(),
    });

    const contentRecord = await prisma.content.create({
      data: {
        userId: session.user.id,
        title: source.title || "URL 콘텐츠",
        type: "BLOG",
        body: blogContent,
        thumbnailUrl: importedImages[0],
        status: scheduledDate ? "SCHEDULED" : "DRAFT",
        scheduledAt: scheduledDate ?? undefined,
        aiProvider,
        aiModel,
        aiLog: blogAiLog,
      },
    });

    await saveImportedImages(contentRecord.id, importedImages, source.title);

    if (!isUnlimited) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { creditsUsed: { increment: 1 } },
      });
    }

    return NextResponse.json({
      success: true,
      contentId: contentRecord.id,
      originalUrl: url,
      importedImages: importedImages.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "입력값을 확인해주세요" },
        { status: 400 }
      );
    }

    console.error("URL to content error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
