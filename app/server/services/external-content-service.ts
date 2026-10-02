import type { Prisma } from "@prisma/client";
import { getExternalMediaReferences, toExternalBody, toStoredExternalMarkdown } from "@/lib/external-content-markdown";
import { prisma } from "@/lib/prisma";
import { ExternalApiError } from "@/server/services/external-api";

export interface ExternalImageInput {
  mediaId: string;
  altText: string;
}

function uniqueMediaIds(images: ExternalImageInput[]): string[] {
  const ids = images.map((image) => image.mediaId);
  if (new Set(ids).size !== ids.length) {
    throw new ExternalApiError(422, "INVALID_MEDIA_REFERENCE", "같은 사진을 두 번 연결할 수 없습니다.");
  }
  return ids;
}

async function verifyMedia(
  tx: Prisma.TransactionClient,
  userId: string,
  images: ExternalImageInput[],
  body: string,
  coverMediaId: string | null,
) {
  const ids = uniqueMediaIds(images);
  const allowed = new Set(ids);
  for (const referenced of getExternalMediaReferences(body)) {
    if (!allowed.has(referenced)) {
      throw new ExternalApiError(422, "INVALID_MEDIA_REFERENCE", "본문 사진은 images 목록에 포함되어야 합니다.");
    }
  }
  if (coverMediaId && !allowed.has(coverMediaId)) {
    throw new ExternalApiError(422, "INVALID_MEDIA_REFERENCE", "대표 사진은 images 목록에 포함되어야 합니다.");
  }

  const media = ids.length === 0 ? [] : await tx.mediaFile.findMany({
    where: { id: { in: ids }, userId, mediaType: "IMAGE" },
  });
  if (media.length !== ids.length) {
    throw new ExternalApiError(422, "INVALID_MEDIA_REFERENCE", "사진이 없거나 사용할 권한이 없습니다.");
  }
  const byId = new Map(media.map((file) => [file.id, file]));
  return { ids, byId };
}

const externalContentInclude = {
  images: {
    orderBy: { order: "asc" as const },
    include: { media: { select: { id: true, name: true, mimeType: true, size: true } } },
  },
} satisfies Prisma.ContentInclude;

type ExternalContentRecord = Prisma.ContentGetPayload<{ include: typeof externalContentInclude }>;

export function serializeExternalContent(content: ExternalContentRecord) {
  const formatted = toExternalBody(content.body);
  return {
    id: content.id,
    title: content.title,
    type: content.type,
    status: content.status,
    body: formatted.body,
    bodyFormat: formatted.bodyFormat,
    images: content.images.map((image) => ({
      id: image.id,
      mediaId: image.mediaId,
      altText: image.altText ?? "",
      order: image.order,
      contentPath: image.mediaId ? `/api/v1/media/${image.mediaId}/content` : image.url,
      name: image.media?.name ?? null,
      mimeType: image.media?.mimeType ?? null,
      size: image.media?.size ?? null,
    })),
    coverMediaId: content.coverMediaId,
    revision: content.revision,
    createdAt: content.createdAt,
    updatedAt: content.updatedAt,
  };
}

export async function createExternalContent(input: {
  userId: string;
  title: string;
  body: string;
  images: ExternalImageInput[];
  coverMediaId?: string | null;
  externalRequestId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const coverMediaId = input.coverMediaId ?? null;
    const { byId } = await verifyMedia(tx, input.userId, input.images, input.body, coverMediaId);
    const content = await tx.content.create({
      data: {
        userId: input.userId,
        title: input.title,
        type: "BLOG",
        status: "DRAFT",
        body: toStoredExternalMarkdown(input.body),
        coverMediaId,
        thumbnailUrl: coverMediaId ? byId.get(coverMediaId)?.url : null,
        images: {
          create: input.images.map((image, order) => ({
            mediaId: image.mediaId,
            url: byId.get(image.mediaId)?.url ?? "",
            altText: image.altText,
            order,
          })),
        },
      },
      include: externalContentInclude,
    });
    const serialized = serializeExternalContent(content);
    await tx.externalRequest.update({
      where: { id: input.externalRequestId },
      data: {
        state: "COMPLETED", responseStatus: 201,
        responseData: JSON.stringify({ success: true, data: serialized }),
        resourceId: content.id, leaseExpiresAt: null,
      },
    });
    return serialized;
  });
}

export async function getExternalContent(userId: string, contentId: string) {
  const content = await prisma.content.findFirst({
    where: { id: contentId, userId },
    include: externalContentInclude,
  });
  if (!content) throw new ExternalApiError(404, "NOT_FOUND", "콘텐츠를 찾을 수 없습니다.");
  return serializeExternalContent(content);
}

export async function updateExternalContent(input: {
  userId: string;
  contentId: string;
  expectedRevision: number;
  title?: string;
  body?: string;
  images?: ExternalImageInput[];
  coverMediaId?: string | null;
  externalRequestId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.content.findFirst({
      where: { id: input.contentId, userId: input.userId },
      include: externalContentInclude,
    });
    if (!current) throw new ExternalApiError(404, "NOT_FOUND", "콘텐츠를 찾을 수 없습니다.");
    if (current.type !== "BLOG" || current.status !== "DRAFT") {
      throw new ExternalApiError(409, "CONTENT_NOT_EDITABLE", "초안 블로그만 수정할 수 있습니다.");
    }
    if (current.revision !== input.expectedRevision) {
      throw new ExternalApiError(409, "REVISION_CONFLICT", "콘텐츠가 이미 변경되었습니다. 최신 내용을 다시 조회해주세요.");
    }

    const changesMedia = input.body !== undefined || input.images !== undefined || input.coverMediaId !== undefined;
    const nextImages = input.images ?? current.images.map((image) => ({
      mediaId: image.mediaId ?? "",
      altText: image.altText ?? "",
    }));
    let byId: ReadonlyMap<string, { url: string }> = new Map();
    if (changesMedia) {
      if (nextImages.some((image) => !image.mediaId)) {
        throw new ExternalApiError(422, "LEGACY_MEDIA_NOT_EDITABLE", "기존 이미지가 포함된 글은 images 전체 교체가 필요합니다.");
      }
      const exposedCurrent = toExternalBody(current.body);
      const nextBody = input.body ?? exposedCurrent.body;
      const nextCover = input.coverMediaId !== undefined ? input.coverMediaId : current.coverMediaId;
      const verified = await verifyMedia(tx, input.userId, nextImages, nextBody, nextCover);
      byId = verified.byId;
    }

    const changed = await tx.content.updateMany({
      where: { id: current.id, userId: input.userId, revision: input.expectedRevision },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.body !== undefined ? { body: toStoredExternalMarkdown(input.body) } : {}),
        ...(input.coverMediaId !== undefined ? {
          coverMediaId: input.coverMediaId,
          thumbnailUrl: input.coverMediaId ? byId.get(input.coverMediaId)?.url : null,
        } : {}),
        revision: { increment: 1 },
      },
    });
    if (changed.count !== 1) {
      throw new ExternalApiError(409, "REVISION_CONFLICT", "콘텐츠가 이미 변경되었습니다. 최신 내용을 다시 조회해주세요.");
    }

    if (input.images !== undefined) {
      await tx.contentImage.deleteMany({ where: { contentId: current.id } });
      await tx.contentImage.createMany({
        data: nextImages.map((image, order) => ({
          contentId: current.id,
          mediaId: image.mediaId,
          url: byId.get(image.mediaId)?.url ?? "",
          altText: image.altText,
          order,
        })),
      });
    }

    const updated = await tx.content.findUniqueOrThrow({
      where: { id: current.id },
      include: externalContentInclude,
    });
    const serialized = serializeExternalContent(updated);
    await tx.externalRequest.update({
      where: { id: input.externalRequestId },
      data: {
        state: "COMPLETED", responseStatus: 200,
        responseData: JSON.stringify({ success: true, data: serialized }),
        resourceId: updated.id, leaseExpiresAt: null,
      },
    });
    return serialized;
  });
}
