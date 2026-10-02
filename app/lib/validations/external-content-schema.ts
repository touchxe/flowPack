import { z } from "zod";

export const externalImageSchema = z.object({
  mediaId: z.string().min(1).max(191),
  altText: z.string().max(500).default(""),
});

const markdownBodySchema = z.string().trim().min(1).max(100_000).superRefine((body, context) => {
  if (/<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^>]*)?>/.test(body)) {
    context.addIssue({ code: "custom", message: "본문에는 HTML 태그를 사용할 수 없습니다." });
  }
  for (const match of body.matchAll(/!\[[^\]]*\]\(\s*([^\s)]+)/g)) {
    if (!match[1].startsWith("flowpack-media:")) {
      context.addIssue({ code: "custom", message: "본문 사진은 먼저 업로드한 mediaId를 사용해야 합니다." });
      break;
    }
  }
  for (const match of body.matchAll(/\]\(\s*([A-Za-z][A-Za-z0-9+.-]*):/g)) {
    const scheme = match[1].toLowerCase();
    if (!new Set(["http", "https", "flowpack-media"]).has(scheme)) {
      context.addIssue({ code: "custom", message: "지원하지 않는 링크 형식입니다." });
      break;
    }
  }
});

export const createExternalContentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  bodyFormat: z.literal("markdown"),
  body: markdownBodySchema,
  images: z.array(externalImageSchema).max(10).default([]),
  coverMediaId: z.string().min(1).max(191).nullable().optional(),
});

export const updateExternalContentSchema = z.object({
  expectedRevision: z.number().int().positive(),
  title: z.string().trim().min(1).max(200).optional(),
  bodyFormat: z.literal("markdown").optional(),
  body: markdownBodySchema.optional(),
  images: z.array(externalImageSchema).max(10).optional(),
  coverMediaId: z.string().min(1).max(191).nullable().optional(),
}).superRefine((value, context) => {
  if (value.body !== undefined && value.bodyFormat !== "markdown") {
    context.addIssue({ code: "custom", path: ["bodyFormat"], message: "body를 수정할 때 bodyFormat이 필요합니다." });
  }
});

export const generateExternalLongformSchema = z.object({
  topic: z.string().trim().min(1).max(2_000),
  keywords: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  length: z.enum(["short", "medium", "long"]).default("medium"),
  tone: z.enum(["formal", "casual", "friendly"]).default("friendly"),
  industry: z.string().trim().max(100).optional(),
  instructions: z.string().trim().max(10_000).optional(),
});

export type GenerateExternalLongformInput = z.infer<typeof generateExternalLongformSchema>;

export const generateExternalLongformJobSchema = generateExternalLongformSchema.extend({
  images: z.array(externalImageSchema).max(10).default([]),
  coverMediaId: z.string().min(1).max(191).nullable().optional(),
}).superRefine((value, context) => {
  const ids = value.images.map((image) => image.mediaId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", path: ["images"], message: "같은 사진을 두 번 연결할 수 없습니다." });
  }
  if (value.coverMediaId && !ids.includes(value.coverMediaId)) {
    context.addIssue({ code: "custom", path: ["coverMediaId"], message: "대표 사진은 images 목록에 포함되어야 합니다." });
  }
});

export type GenerateExternalLongformJobInput = z.infer<typeof generateExternalLongformJobSchema>;

export function firstZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "입력값을 확인해주세요.";
}
