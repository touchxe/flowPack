import { isMigratedNasObjectKey } from "./nas-storage.mjs";

/**
 * Check every supported reference type so a shared content-addressed object is
 * readable by each owner that legitimately references it. The injected data
 * client makes the authorization contract independently testable; only
 * findFirst/select-id reads are issued.
 */
export async function userOwnsNasObjectReference({ db, userId, key }) {
  if (!userId || !isMigratedNasObjectKey(key)) return false;
  const objectUrl = `/api/nas-owned-media/${key}`;

  const [mediaFile, contentImage, content] = await Promise.all([
    db.mediaFile.findFirst({
      where: {
        userId,
        OR: [{ blobKey: key }, { url: objectUrl }],
      },
      select: { id: true },
    }),
    db.contentImage.findFirst({
      where: {
        url: objectUrl,
        content: { userId },
      },
      select: { id: true },
    }),
    db.content.findFirst({
      where: {
        userId,
        OR: [
          { thumbnailUrl: objectUrl },
          { body: { contains: objectUrl } },
          { slides: { contains: objectUrl } },
        ],
      },
      select: { id: true },
    }),
  ]);

  return Boolean(mediaFile || contentImage || content);
}
