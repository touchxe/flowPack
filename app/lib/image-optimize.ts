/**
 * 이미지 최적화 유틸리티
 * - 최대 너비 1200px 리사이즈
 * - WebP 포맷 변환 (미지원 시 JPEG)
 * - 품질 80% 압축
 */

interface OptimizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: "webp" | "jpeg";
}

const DEFAULT_OPTIONS: Required<OptimizeOptions> = {
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 0.8,
  format: "webp",
};

/**
 * File 또는 base64 URL을 최적화된 base64 문자열로 변환
 */
export async function optimizeImage(
  source: File | string,
  opts?: OptimizeOptions
): Promise<{ dataUrl: string; width: number; height: number; sizeKB: number }> {
  const options = { ...DEFAULT_OPTIONS, ...opts };

  // 이미지 로드
  const img = await loadImage(source);

  // 리사이즈 비율 계산
  let { width, height } = img;
  const ratioW = options.maxWidth / width;
  const ratioH = options.maxHeight / height;
  const ratio = Math.min(ratioW, ratioH, 1); // 1보다 작을 때만 축소

  width = Math.round(width * ratio);
  height = Math.round(height * ratio);

  // Canvas에 그리기
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);

  // WebP 지원 여부 확인 후 포맷 결정
  let mimeType = `image/${options.format}`;
  let dataUrl = canvas.toDataURL(mimeType, options.quality);

  // WebP 미지원 브라우저의 경우 JPEG 폴백
  if (options.format === "webp" && !dataUrl.startsWith("data:image/webp")) {
    mimeType = "image/jpeg";
    dataUrl = canvas.toDataURL(mimeType, options.quality);
  }

  // 사이즈 계산 (base64 부분만)
  const base64Part = dataUrl.split(",")[1] || "";
  const sizeKB = Math.round((base64Part.length * 3) / 4 / 1024);

  return { dataUrl, width, height, sizeKB };
}

function loadImage(source: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;

    if (typeof source === "string") {
      img.src = source;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(source);
    }
  });
}

/**
 * File을 최적화하여 { dataUrl, name, width, height, sizeKB } 반환
 */
export async function optimizeFileImage(
  file: File,
  opts?: OptimizeOptions
): Promise<{ dataUrl: string; name: string; width: number; height: number; sizeKB: number }> {
  const result = await optimizeImage(file, opts);
  // 파일 이름에서 확장자를 webp로 변경
  const nameBase = file.name.replace(/\.[^.]+$/, "");
  return {
    ...result,
    name: `${nameBase}.webp`,
  };
}
