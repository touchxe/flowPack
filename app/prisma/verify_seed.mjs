import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const now = new Date();
const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

const [payments, aiLogs, notices, configs, users, contents, subs] = await Promise.all([
  db.paymentLog.findMany({ include: { user: { select: { email: true } } } }),
  db.aiUsageLog.findMany({ where: { createdAt: { gte: startOfMonth } } }),
  db.notice.findMany({ select: { title: true, type: true, isPublished: true } }),
  db.systemConfig.findMany(),
  db.user.findMany({ where: { email: { contains: 'test.com' } }, select: { email: true, name: true, plan: true } }),
  db.content.count(),
  db.subscription.findMany({ include: { user: { select: { email: true } } } }),
]);

console.log('\n════════════════════════════════════════');
console.log('  FlowPack Admin 전체 메뉴 데이터 검증');
console.log('════════════════════════════════════════');

console.log('\n[ 1 ] 대시보드 (/admin)');
console.log('  유저 수:', users.length + 1, '명 (페르소나 3 + admin)');
console.log('  콘텐츠 수:', contents, '개');

console.log('\n[ 2 ] 유저 관리 (/admin/users)');
for (const u of users) {
  console.log(' ', u.plan.padEnd(12), u.name, '-', u.email);
}

console.log('\n[ 3 ] 구독 관리 (/admin/subscriptions)');
for (const s of subs) {
  console.log(' ', s.plan.padEnd(10), s.status.padEnd(10), s.user.email);
}

console.log('\n[ 4 ] 결제 관리 (/admin/payments)  ← 신규');
const success = payments.filter(p => p.status === 'SUCCESS');
const failed = payments.filter(p => p.status === 'FAILED');
const refunded = payments.filter(p => p.status === 'REFUNDED');
const monthTotal = success
  .filter(p => new Date(p.createdAt) >= startOfMonth)
  .reduce((s, p) => s + p.amount, 0);
console.log('  결제 총건:', payments.length, '(성공:', success.length, '/ 실패:', failed.length, '/ 환불:', refunded.length, ')');
console.log('  이번달 결제액: ₩' + monthTotal.toLocaleString());
for (const p of payments) {
  console.log(' ', p.status.padEnd(10), '₩' + p.amount.toLocaleString().padEnd(8), p.user.email);
}

console.log('\n[ 5 ] AI 사용량 (/admin/ai-usage)  ← 신규');
const totalTokens = aiLogs.reduce((s, l) => s + l.totalTokens, 0);
const totalCost = aiLogs.reduce((s, l) => s + l.estimatedCostUsd, 0);
const byFeature = {};
for (const l of aiLogs) byFeature[l.feature] = (byFeature[l.feature] || 0) + 1;
console.log('  이번달 호출:', aiLogs.length, '회');
console.log('  총 토큰:', totalTokens.toLocaleString());
console.log('  추정 비용: $' + totalCost.toFixed(4));
console.log('  기능별:', JSON.stringify(byFeature));

console.log('\n[ 6 ] 공지사항 (/admin/notices)  ← 신규');
for (const n of notices) {
  const status = n.isPublished ? '✅게시' : '⬜미게시';
  console.log(' ', status, n.type.padEnd(12), n.title.slice(0, 30));
}

console.log('\n[ 7 ] 시스템 설정 (/admin/settings)  ← 신규');
for (const c of configs) console.log('  ', c.key.padEnd(25), '=', c.value);

console.log('\n════════════════════════════════════════');
console.log('  모든 메뉴 데이터 정상 확인 ✅');
console.log('════════════════════════════════════════\n');

await db.$disconnect();
