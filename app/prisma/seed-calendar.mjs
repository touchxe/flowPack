// 캘린더 테스트용 더미 데이터 삽입 스크립트
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 가장 최근에 생성된 유저 조회
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "desc" } });
  if (!user) {
    console.error("유저가 없습니다. 먼저 회원가입을 해주세요.");
    process.exit(1);
  }
  console.log(`대상 유저: ${user.email} (${user.id})`);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  const seeds = [
    {
      title: "[테스트] 봄 신제품 카드뉴스",
      type: "CAROUSEL",
      status: "SCHEDULED",
      scheduledAt: new Date(year, month, 8, 10, 0),
      slides: JSON.stringify([
        { index: 0, title: "봄 신제품 출시!", body: "이번 시즌 가장 핫한 아이템을 만나보세요." },
        { index: 1, title: "특별 할인 혜택", body: "출시 기념 20% 특별 할인 이벤트 진행 중!" },
      ]),
    },
    {
      title: "[테스트] 브랜드 스토리 블로그",
      type: "BLOG",
      status: "DRAFT",
      scheduledAt: new Date(year, month, 12, 14, 0),
      slides: JSON.stringify([
        { index: 0, title: "우리 브랜드의 시작", body: "2020년, 작은 창고에서 시작된 이야기입니다." },
      ]),
    },
    {
      title: "[테스트] 주간 SNS 콘텐츠 대량 기획",
      type: "BULK",
      status: "SCHEDULED",
      scheduledAt: new Date(year, month, 15, 9, 0),
      slides: JSON.stringify([]),
    },
    {
      title: "[테스트] 4월 이벤트 카드뉴스",
      type: "CAROUSEL",
      status: "PUBLISHED",
      scheduledAt: new Date(year, month, 20, 11, 0),
      slides: JSON.stringify([
        { index: 0, title: "4월 이벤트", body: "봄맞이 특별 이벤트에 참여하세요!" },
      ]),
    },
    {
      title: "[테스트] URL 기반 콘텐츠 변환",
      type: "URL_TO_POST",
      status: "DRAFT",
      scheduledAt: new Date(year, month, 25, 16, 0),
      slides: JSON.stringify([]),
    },
  ];

  let count = 0;
  for (const seed of seeds) {
    await prisma.content.create({
      data: {
        userId: user.id,
        title: seed.title,
        type: seed.type,
        status: seed.status,
        scheduledAt: seed.scheduledAt,
        slides: seed.slides,
      },
    });
    console.log(`  ✓ "${seed.title}" (${seed.scheduledAt.toLocaleDateString("ko-KR")})`);
    count++;
  }

  console.log(`\n✅ 더미 콘텐츠 ${count}개 삽입 완료!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
