// 시스템 지침 API — 관리자 전용 (GET / POST / PUT)
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/* 지침 타입별 기본 제목 */
const DEFAULT_TITLES: Record<string, string> = {
  ALL:           "공통 시스템 지침 (모든 콘텐츠 적용)",
  CAROUSEL:      "카드뉴스 생성 지침",
  BLOG:          "블로그 글 생성 지침",
  URL_TO_POST:   "URL → 콘텐츠 변환 지침",
  BULK_GENERATE: "대량 기획 생성 지침",
};

/* GET: 모든 시스템 지침 조회 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const instructions = await prisma.systemInstruction.findMany({
    orderBy: { contentType: "asc" },
  });

  // 없는 타입은 빈 레코드로 채움
  const types = ["ALL", "CAROUSEL", "BLOG", "URL_TO_POST", "BULK_GENERATE"];
  const result = types.map((type) => {
    const found = instructions.find((i) => i.contentType === type);
    return found ?? {
      id: null,
      contentType: type,
      title: DEFAULT_TITLES[type],
      content: "",
      isActive: true,
      updatedBy: null,
      createdAt: null,
      updatedAt: null,
    };
  });

  return NextResponse.json(result);
}

/* PUT: 특정 타입의 시스템 지침 저장 (관리자만) */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { contentType, title, content, isActive } = await req.json();

  if (!contentType || content === undefined) {
    return NextResponse.json({ error: "contentType, content 필수" }, { status: 400 });
  }

  const record = await prisma.systemInstruction.upsert({
    where: { contentType },
    create: {
      contentType,
      title: title || DEFAULT_TITLES[contentType] || contentType,
      content,
      isActive: isActive ?? true,
      updatedBy: session.user.email,
    },
    update: {
      title: title || DEFAULT_TITLES[contentType] || contentType,
      content,
      isActive: isActive ?? true,
      updatedBy: session.user.email,
    },
  });

  return NextResponse.json(record);
}
