/**
 * Cloudinary 공통 설정
 * 환경변수: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 */
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;

/** Cloudinary 설정 여부 확인 */
export function isCloudinaryConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Buffer를 Cloudinary에 업로드
 * @returns { url, publicId }
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  options: {
    folder?: string;
    publicId?: string;
    resourceType?: "image" | "video" | "raw" | "auto";
    transformation?: Record<string, unknown>[];
  } = {}
): Promise<{ url: string; publicId: string; width?: number; height?: number }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder:        options.folder ?? "flowpack",
        public_id:     options.publicId,
        resource_type: options.resourceType ?? "auto",
        // 이미지는 자동 WebP 변환 + 품질 최적화
        transformation: options.transformation ?? [
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url:      result!.secure_url,
          publicId: result!.public_id,
          width:    result!.width,
          height:   result!.height,
        });
      }
    );
    uploadStream.end(buffer);
  });
}

/** Cloudinary 파일 삭제 */
export async function deleteFromCloudinary(publicId: string, resourceType: "image" | "video" | "raw" = "image"): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}
