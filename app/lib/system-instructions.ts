/**
 * 시스템 지침 헬퍼 — AI 생성 시 자동 적용되는 관리자 지침 로드
 *
 * 사용법:
 *   import { getSystemInstructions } from "@/lib/system-instructions";
 *   const prefix = await getSystemInstructions("CAROUSEL");
 *   // → "[시스템 지침]\n공통지침내용\n\n[카드뉴스 지침]\n타입별지침내용"
 */
import { prisma } from "@/lib/prisma";

export type InstructionContentType =
  | "ALL"
  | "CAROUSEL"
  | "BLOG"
  | "URL_TO_POST"
  | "BULK_GENERATE";

/**
 * 해당 콘텐츠 타입에 적용되는 시스템 지침을 조합하여 반환
 * ALL(공통) + 타입별 지침을 합쳐서 반환. 없으면 빈 문자열.
 */
export async function getSystemInstructions(
  contentType: InstructionContentType
): Promise<string> {
  try {
    const types: InstructionContentType[] =
      contentType === "ALL" ? ["ALL"] : ["ALL", contentType];

    const instructions = await prisma.systemInstruction.findMany({
      where: {
        contentType: { in: types },
        isActive: true,
      },
      orderBy: { contentType: "asc" }, // ALL이 먼저
    });

    if (instructions.length === 0) return "";

    const parts: string[] = [];

    for (const inst of instructions) {
      if (!inst.content?.trim()) continue;
      const label = inst.contentType === "ALL" ? "공통 시스템 지침" : `${inst.title}`;
      parts.push(`[${label}]\n${inst.content.trim()}`);
    }

    if (parts.length === 0) return "";

    return `\n\n=== 관리자 시스템 지침 (반드시 준수) ===\n${parts.join("\n\n")}`;
  } catch (error) {
    console.error("시스템 지침 로드 실패:", error);
    return "";
  }
}
