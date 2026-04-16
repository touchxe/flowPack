/**
 * FlowPack 페르소나 테스트 시드 스크립트
 * - 3개 페르소나 생성 (FREE / STARTER / PRO)
 * - 각 페르소나별: 콘텐츠, 구독, 결제 로그, AI 사용 로그 생성
 * - 관리자 대시보드의 모든 메뉴에 데이터가 표시되도록 구성
 *
 * 실행: node prisma/seed_personas.mjs
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

// ─── 유틸 ───────────────────────────────────────────
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── 3개 페르소나 정의 ───────────────────────────────
const PERSONAS = [
  {
    email: "kim.freelancer@test.com",
    name: "김소연 (프리랜서)",
    plan: "FREE",
    creditsUsed: 7,
    creditsTotal: 10,
    persona: {
      businessName: "소연 스튜디오",
      industry: "디자인/프리랜서",
      targetAudience: "20-30대 디자인 관심 고객",
      tone: "친근하고 감성적",
      style: "미니멀 힐링",
      keywords: JSON.stringify(["디자인", "일러스트", "감성", "핸드메이드"]),
    },
    subscription: null, // FREE = 구독 없음
    payment: null,
  },
  {
    email: "park.startup@test.com",
    name: "박준혁 (스타트업)",
    plan: "STARTER",
    creditsUsed: 65,
    creditsTotal: 100,
    persona: {
      businessName: "파크테크 솔루션",
      industry: "IT/SaaS",
      targetAudience: "중소기업 HR 담당자",
      tone: "전문적이고 신뢰감 있는",
      style: "클린 B2B",
      keywords: JSON.stringify(["SaaS", "HR", "자동화", "생산성", "기업솔루션"]),
    },
    subscription: {
      plan: "STARTER",
      billingCycle: "MONTHLY",
      status: "ACTIVE",
      startOffset: -20,
      endOffset: 10,
    },
    payment: {
      orderId: "order_starter_001",
      amount: 19900,
      status: "SUCCESS",
      method: "카드",
      cardInfo: JSON.stringify({ company: "신한카드", last4: "1234" }),
    },
  },
  {
    email: "lee.brand@test.com",
    name: "이하은 (브랜드 마케터)",
    plan: "PRO",
    creditsUsed: 312,
    creditsTotal: 500,
    persona: {
      businessName: "하은 브랜드랩",
      industry: "뷰티/라이프스타일",
      targetAudience: "20-40대 여성, 뷰티/패션 관심층",
      tone: "트렌디하고 세련되게",
      style: "럭셔리 미니멀",
      keywords: JSON.stringify(["뷰티", "스킨케어", "K-beauty", "라이프스타일", "MZ세대"]),
    },
    subscription: {
      plan: "PRO",
      billingCycle: "YEARLY",
      status: "ACTIVE",
      startOffset: -60,
      endOffset: 305,
    },
    payment: {
      orderId: "order_pro_001",
      amount: 49900,
      status: "SUCCESS",
      method: "카드",
      cardInfo: JSON.stringify({ company: "현대카드", last4: "5678" }),
    },
  },
];

// ─── 콘텐츠 시나리오 ────────────────────────────────
const CONTENT_SCENARIOS = {
  FREE: [
    { type: "CAROUSEL", title: "감성 일러스트 작업 과정 공유", status: "PUBLISHED", tone: "친근한", aiPrompt: "일러스트 작업 과정을 감성적으로 소개하는 카드뉴스" },
    { type: "BLOG", title: "프리랜서 디자이너의 하루 루틴", status: "DRAFT", tone: "일상적인", aiPrompt: "프리랜서의 일상 루틴 블로그 포스팅" },
    { type: "CAROUSEL", title: "핸드메이드 굿즈 신상 소개", status: "SCHEDULED", tone: "발랄한", aiPrompt: "핸드메이드 굿즈 신상품 카드뉴스" },
  ],
  STARTER: [
    { type: "CAROUSEL", title: "HR 자동화 솔루션 5가지 기능", status: "PUBLISHED", tone: "전문적인", aiPrompt: "HR SaaS 주요 기능 소개 카드뉴스" },
    { type: "BLOG", title: "중소기업 HR 디지털 전환 가이드", status: "PUBLISHED", tone: "신뢰감 있는", aiPrompt: "HR 디지털 전환 블로그 아티클" },
    { type: "URL_TO_POST", title: "테크 트렌드 2024 포스트 변환", status: "DRAFT", tone: "분석적인", aiPrompt: "URL 기반 테크 트렌드 포스팅" },
    { type: "BULK", title: "월간 기업 뉴스레터 일괄 생성", status: "PUBLISHED", tone: "공식적인", aiPrompt: "기업 뉴스레터 대량 생성" },
    { type: "CAROUSEL", title: "SaaS ROI 계산기 소개", status: "ARCHIVED", tone: "설득력 있는", aiPrompt: "SaaS 투자 대비 효과 카드뉴스" },
  ],
  PRO: [
    { type: "CAROUSEL", title: "2024 봄 스킨케어 루틴 총정리", status: "PUBLISHED", tone: "트렌디한", aiPrompt: "봄 시즌 스킨케어 루틴 카드뉴스" },
    { type: "CAROUSEL", title: "MZ세대 뷰티 소비 트렌드 분석", status: "PUBLISHED", tone: "세련된", aiPrompt: "MZ세대 뷰티 트렌드 인사이트" },
    { type: "BLOG", title: "K-뷰티 글로벌 시장 현황 리포트", status: "PUBLISHED", tone: "분석적인", aiPrompt: "K-뷰티 시장 분석 롱폼 아티클" },
    { type: "BLOG", title: "인스타그램 뷰티 콘텐츠 전략", status: "PUBLISHED", tone: "실용적인", aiPrompt: "SNS 뷰티 마케팅 전략 블로그" },
    { type: "URL_TO_POST", title: "해외 뷰티 트렌드 리포트 변환", status: "SCHEDULED", tone: "정보적인", aiPrompt: "글로벌 뷰티 트렌드 URL 변환" },
    { type: "BULK", title: "뷰티 브랜드 SNS 일괄 포스팅 (10개)", status: "PUBLISHED", tone: "감각적인", aiPrompt: "뷰티 브랜드 소셜 콘텐츠 대량 생성" },
    { type: "CAROUSEL", title: "선크림 성분 비교 가이드", status: "ARCHIVED", tone: "교육적인", aiPrompt: "선크림 성분 비교 분석 카드뉴스" },
  ],
};

// ─── AI 사용 시나리오 ────────────────────────────────
const AI_FEATURES = ["CAROUSEL", "BLOG", "BULK", "URL_TO_POST", "LONGFORM"];
const AI_MODELS = ["gpt-4o", "gpt-4o-mini"];
const MODEL_PRICING = {
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
};

function makeAiLog(userId, feature, daysOffset) {
  const model = feature === "BLOG" || feature === "LONGFORM" ? "gpt-4o" : "gpt-4o-mini";
  const promptTokens = randomInt(200, 800);
  const completionTokens = randomInt(300, 1500);
  const totalTokens = promptTokens + completionTokens;
  const pricing = MODEL_PRICING[model];
  const estimatedCostUsd = (promptTokens / 1000) * pricing.input + (completionTokens / 1000) * pricing.output;
  return {
    userId,
    feature,
    model,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd: Math.round(estimatedCostUsd * 1_000_000) / 1_000_000,
    durationMs: randomInt(800, 5000),
    isError: false,
    createdAt: daysAgo(daysOffset),
  };
}

// ─── 메인 ────────────────────────────────────────────
async function main() {
  console.log("🌱 FlowPack 페르소나 시드 시작...\n");

  const adminPassword = await bcrypt.hash("Test1234!", 10);
  const createdUsers = [];

  for (const persona of PERSONAS) {
    console.log(`\n👤 페르소나: ${persona.name} [${persona.plan}]`);

    // 기존 유저 확인
    let user = await prisma.user.findUnique({ where: { email: persona.email } });

    if (user) {
      console.log(`  ↺ 기존 유저 업데이트`);
      user = await prisma.user.update({
        where: { email: persona.email },
        data: {
          name: persona.name,
          plan: persona.plan,
          creditsUsed: persona.creditsUsed,
          creditsTotal: persona.creditsTotal,
          passwordHash: adminPassword,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email: persona.email,
          name: persona.name,
          plan: persona.plan,
          creditsUsed: persona.creditsUsed,
          creditsTotal: persona.creditsTotal,
          passwordHash: adminPassword,
          role: "USER",
          createdAt: daysAgo(randomInt(30, 90)),
        },
      });
      console.log(`  ✅ 유저 생성: ${user.email}`);
    }
    createdUsers.push(user);

    // 페르소나 정보
    await prisma.persona.upsert({
      where: { userId: user.id },
      update: persona.persona,
      create: { userId: user.id, ...persona.persona },
    });
    console.log(`  ✅ 페르소나 설정 저장`);

    // 콘텐츠 생성
    const scenarios = CONTENT_SCENARIOS[persona.plan] ?? [];
    for (let i = 0; i < scenarios.length; i++) {
      const s = scenarios[i];
      const scheduledAt = s.status === "SCHEDULED" ? new Date(Date.now() + 86400000 * randomInt(1, 7)) : null;
      const publishedAt = s.status === "PUBLISHED" ? daysAgo(randomInt(1, 20)) : null;
      await prisma.content.create({
        data: {
          userId: user.id,
          title: s.title,
          type: s.type,
          status: s.status,
          aiPrompt: s.aiPrompt,
          tone: s.tone,
          scheduledAt,
          publishedAt,
          viewCount: s.status === "PUBLISHED" ? randomInt(10, 500) : 0,
          createdAt: daysAgo(randomInt(1, 25)),
        },
      });
    }
    console.log(`  ✅ 콘텐츠 ${scenarios.length}개 생성`);

    // 구독 생성 (STARTER / PRO만)
    if (persona.subscription) {
      const sub = persona.subscription;
      const existing = await prisma.subscription.findFirst({ where: { userId: user.id } });
      if (!existing) {
        await prisma.subscription.create({
          data: {
            userId: user.id,
            plan: sub.plan,
            billingCycle: sub.billingCycle,
            status: sub.status,
            currentPeriodStart: daysAgo(-sub.startOffset),
            currentPeriodEnd: daysAgo(-sub.endOffset),
            tossBillingKey: `billing_${user.id.slice(0, 8)}`,
          },
        });
        console.log(`  ✅ 구독 생성: ${sub.plan} ${sub.billingCycle}`);
      } else {
        console.log(`  ↺ 기존 구독 유지`);
      }
    }

    // 결제 로그 생성
    if (persona.payment) {
      const p = persona.payment;
      const existingPayment = await prisma.paymentLog.findUnique({ where: { orderId: p.orderId } });
      if (!existingPayment) {
        await prisma.paymentLog.create({
          data: {
            userId: user.id,
            orderId: p.orderId,
            amount: p.amount,
            status: p.status,
            method: p.method,
            cardInfo: p.cardInfo,
            tossPaymentKey: `pay_${user.id.slice(0, 12)}`,
            paidAt: daysAgo(20),
          },
        });
        // 추가 결제 이력 (실패, 환불 케이스)
        if (persona.plan === "PRO") {
          const existingFailed = await prisma.paymentLog.findUnique({ where: { orderId: "order_pro_002_failed" } });
          if (!existingFailed) {
            await prisma.paymentLog.create({
              data: {
                userId: user.id,
                orderId: "order_pro_002_failed",
                amount: 49900,
                status: "FAILED",
                method: "카드",
                failureCode: "CARD_DECLINED",
                failureMsg: "카드 한도 초과",
                createdAt: daysAgo(50),
              },
            });
          }
          const existingRefund = await prisma.paymentLog.findUnique({ where: { orderId: "order_pro_003_refund" } });
          if (!existingRefund) {
            await prisma.paymentLog.create({
              data: {
                userId: user.id,
                orderId: "order_pro_003_refund",
                amount: 49900,
                status: "REFUNDED",
                method: "카드",
                cardInfo: JSON.stringify({ company: "현대카드", last4: "9999" }),
                tossPaymentKey: "pay_refunded_001",
                paidAt: daysAgo(65),
                refundedAt: daysAgo(63),
                failureMsg: "고객 요청 환불",
              },
            });
          }
        }
        console.log(`  ✅ 결제 로그 생성: ₩${p.amount.toLocaleString()}`);
      } else {
        console.log(`  ↺ 기존 결제 로그 유지`);
      }
    }

    // AI 사용 로그 생성 (각 콘텐츠 타입별, 최근 30일 분산)
    const aiLogCount = persona.plan === "PRO" ? 25 : persona.plan === "STARTER" ? 12 : 4;
    const existingAiLogs = await prisma.aiUsageLog.count({ where: { userId: user.id } });
    if (existingAiLogs === 0) {
      const logsToCreate = [];
      for (let i = 0; i < aiLogCount; i++) {
        const feature = randomFrom(
          persona.plan === "FREE" ? ["CAROUSEL", "BLOG"] : AI_FEATURES
        );
        logsToCreate.push(makeAiLog(user.id, feature, randomInt(0, 29)));
      }
      await prisma.aiUsageLog.createMany({ data: logsToCreate });
      console.log(`  ✅ AI 사용 로그 ${aiLogCount}개 생성`);
    } else {
      console.log(`  ↺ 기존 AI 로그 ${existingAiLogs}개 유지`);
    }
  }

  // ─── 공지사항 샘플 ──────────────────────────────
  console.log("\n📢 샘플 공지사항 생성...");
  const noticeCount = await prisma.notice.count();
  if (noticeCount === 0) {
    await prisma.notice.createMany({
      data: [
        {
          title: "FlowPack 1.5 업데이트: AI 롱폼 기능 출시",
          body: "안녕하세요! FlowPack이 새로운 기능을 출시했습니다.\n\n✨ AI 기반 롱폼 블로그 자동 작성 기능이 추가되었습니다.\nPRO 플랜 이상 사용자분들은 지금 바로 이용하실 수 있습니다.\n\n더 많은 업데이트는 공식 블로그를 확인해 주세요.",
          type: "FEATURE",
          isPublished: true,
          publishedAt: daysAgo(5),
          createdAt: daysAgo(5),
          updatedAt: daysAgo(5),
        },
        {
          title: "[점검 안내] 4월 15일 새벽 2시 ~ 4시 서비스 점검",
          body: "안녕하세요, FlowPack 운영팀입니다.\n\n서버 안정화를 위한 정기 점검을 다음과 같이 진행합니다.\n\n📅 점검 일시: 2024년 4월 15일 새벽 2:00 ~ 4:00\n⏱ 점검 시간: 약 2시간\n\n점검 중에는 서비스 이용이 일시적으로 중단됩니다.\n이용에 불편을 드려 죄송합니다.",
          type: "MAINTENANCE",
          isPublished: true,
          publishedAt: daysAgo(3),
          expiresAt: new Date(Date.now() + 86400000 * 7),
          createdAt: daysAgo(3),
          updatedAt: daysAgo(3),
        },
        {
          title: "PRO 플랜 가입 시 첫 달 50% 할인 이벤트",
          body: "지금 PRO 플랜에 가입하시면 첫 달 요금이 50% 할인됩니다!\n\n🎁 혜택:\n- 월 500 크레딧\n- 모든 AI 기능 무제한\n- 발행 채널 10개\n\n이벤트 기간: 4월 30일까지",
          type: "MARKETING",
          targetPlan: null,
          isPublished: false,
          createdAt: daysAgo(1),
          updatedAt: daysAgo(1),
        },
      ],
    });
    console.log("  ✅ 공지사항 3개 생성");
  } else {
    console.log(`  ↺ 기존 공지사항 ${noticeCount}개 유지`);
  }

  // ─── 시스템 설정 초기화 ─────────────────────────
  console.log("\n⚙️ 시스템 설정 초기화...");
  const defaultConfigs = [
    { key: "FREE_CREDITS", value: "10" },
    { key: "STARTER_CREDITS", value: "100" },
    { key: "PRO_CREDITS", value: "500" },
    { key: "ENTERPRISE_CREDITS", value: "9999" },
    { key: "FEATURE_BULK", value: "true" },
    { key: "FEATURE_LONGFORM", value: "true" },
    { key: "FEATURE_URL_TO_POST", value: "true" },
    { key: "MAINTENANCE_MODE", value: "false" },
    // AI 제공사 설정
    { key: "AI_PROVIDER", value: "openai" },
    { key: "AI_MODEL_OPENAI", value: "gpt-4.1-mini" },
    { key: "AI_MODEL_ANTHROPIC", value: "claude-3-7-sonnet-20250219" },
    { key: "AI_MODEL_GOOGLE", value: "gemini-2.5-flash" },
    { key: "AI_MODEL_XAI", value: "grok-4-mini" },
    { key: "AI_KEY_OPENAI", value: "" },
    { key: "AI_KEY_ANTHROPIC", value: "" },
    { key: "AI_KEY_GOOGLE", value: "" },
    { key: "AI_KEY_XAI", value: "" },
  ];
  for (const cfg of defaultConfigs) {
    await prisma.systemConfig.upsert({
      where: { key: cfg.key },
      update: {},
      create: cfg,
    });
  }
  console.log("  ✅ 시스템 설정 초기화 완료 (AI 제공사 설정 포함)");

  // ─── 최종 요약 ──────────────────────────────────
  console.log("\n" + "═".repeat(52));
  console.log("🎉 페르소나 시드 완료!\n");
  console.log("📋 생성 요약:");

  for (const u of createdUsers) {
    const p = PERSONAS.find(p => p.email === u.email);
    const contentCount = await prisma.content.count({ where: { userId: u.id } });
    const aiCount = await prisma.aiUsageLog.count({ where: { userId: u.id } });
    console.log(`\n  👤 ${u.name} [${u.plan}]`);
    console.log(`     이메일: ${u.email}`);
    console.log(`     비밀번호: Test1234!`);
    console.log(`     콘텐츠: ${contentCount}개 | AI 로그: ${aiCount}개`);
    console.log(`     크레딧: ${u.creditsUsed}/${u.creditsTotal}`);
  }

  console.log("\n  🔑 공통 비밀번호: Test1234!");
  console.log("═".repeat(52) + "\n");

  await prisma.$disconnect();
}

main().catch(err => {
  console.error("❌ 시드 오류:", err);
  prisma.$disconnect();
  process.exit(1);
});
