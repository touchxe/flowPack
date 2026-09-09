import { deleteFromCloudinary, isCloudinaryConfigured, uploadToCloudinary } from "@/lib/cloudinary";
import {
  deleteNasObject,
  isSupportedNasMime,
  readNasObject,
  storeNasObject,
} from "@/lib/nas-storage.mjs";

export type StorageDriver = "cloudinary" | "nas";

export type StoredObject = {
  url: string;
  blobKey: string;
  width?: number;
  height?: number;
};

function storageRoot(): string {
  const root = process.env.FLOWPACK_STORAGE_ROOT;
  if (!root) throw new Error("NAS storage root is not configured");
  return root;
}

export function getStorageDriver(): StorageDriver {
  const value = process.env.FLOWPACK_STORAGE_DRIVER ?? "cloudinary";
  if (value !== "cloudinary" && value !== "nas") throw new Error("Unsupported storage driver");
  return value;
}

export function isStorageConfigured(): boolean {
  try {
    return getStorageDriver() === "nas" ? Boolean(process.env.FLOWPACK_STORAGE_ROOT) : isCloudinaryConfigured();
  } catch {
    return false;
  }
}

export function isSupportedStorageMime(mimeType: string): boolean {
  return isSupportedNasMime(mimeType);
}

export async function uploadStoredObject(input: {
  id: string;
  ownerId: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<StoredObject> {
  if (getStorageDriver() === "nas") {
    const stored = await storeNasObject({
      root: storageRoot(),
      ownerId: input.ownerId,
      buffer: input.buffer,
      mimeType: input.mimeType,
    });
    return {
      url: `/api/media/${encodeURIComponent(input.id)}/content`,
      blobKey: stored.key,
    };
  }

  const resourceType: "image" | "video" | "raw" =
    input.mimeType.startsWith("image/") ? "image" :
    input.mimeType.startsWith("audio/") ? "video" :
    "raw";
  const uploaded = await uploadToCloudinary(input.buffer, {
    folder: "flowpack",
    publicId: input.id,
    resourceType,
    transformation: input.mimeType.startsWith("image/")
      ? [{ quality: "auto", fetch_format: "auto" }]
      : undefined,
  });
  return {
    url: uploaded.url,
    blobKey: uploaded.publicId,
    width: uploaded.width,
    height: uploaded.height,
  };
}

export async function readStoredObject(input: { url: string; blobKey: string }) {
  if (!input.url.startsWith("/api/media/")) throw new Error("Object is not stored on NAS");
  return readNasObject({ root: storageRoot(), key: input.blobKey });
}

export async function deleteStoredObject(input: {
  url: string;
  blobKey: string;
  mimeType: string;
}): Promise<void> {
  if (input.url.startsWith("/api/media/")) {
    await deleteNasObject({ root: storageRoot(), key: input.blobKey });
    return;
  }
  await deleteFromCloudinary(input.blobKey, input.mimeType);
}
