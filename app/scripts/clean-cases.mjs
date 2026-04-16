/**
 * 크롤링 데이터 정제 스크립트
 * - 블로거명+URL 패턴 제목 정리
 * - 노이즈 데이터 필터링
 * - /cases 페이지용 최종 데이터 생성
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const raw = JSON.parse(
  await fs.readFile(path.join(__dirname, "output/cases-data.json"), "utf8")
);

// 노이즈 제거 필터
const NOISE_PATTERNS = [
  /blog\.naver\.com›/, // "블로거blog.naver.com›id" 패턴
  /^[가-힣a-zA-Z0-9]{2,10}blog\.naver/,
  /^뉴스몰아보기/,
  /예비후보/,
  /^배민\.\./,
  /^전화통화/,
  /여수시장/,
  /샬롯피아노/, // 피아노 학원 (피트니스 오분류)
  /더블유발레/, // 발레 (피트니스 오분류)
];

// 제목 정제
function cleanTitle(title) {
  // "블로거명blog.naver.com›id" → 제거 or 빈 문자열
  if (/blog\.naver\.com›/.test(title)) return null;
  // 네이버 블로그 접미사 제거
  return title
    .replace(/네이버 블로그$/, "")
    .replace(/네이버블로그$/, "")
    .replace(/›[a-zA-Z0-9_]+\s*$/, "")
    .trim();
}

// 필터 + 정제
const cleaned = raw
  .filter(item => {
    // 노이즈 패턴 제거
    const isNoise = NOISE_PATTERNS.some(p => p.test(item.title));
    if (isNoise) return false;
    // 제목이 너무 짧거나 없으면 제거
    if (!item.title || item.title.length < 8) return false;
    // 설명이 없고 제목도 부실한 것 제거
    if (item.desc === `${item.industry} 업체의 SNS/블로그 마케팅 성공 사례` && 
        !/마케팅|블로그|SNS|인스타|홍보|매출|후기/.test(item.title)) return false;
    return true;
  })
  .map((item, i) => {
    const cleanedTitle = cleanTitle(item.title);
    if (!cleanedTitle) return null;
    return {
      ...item,
      id: `case-${String(i + 1).padStart(3, "0")}`,
      title: cleanedTitle,
    };
  })
  .filter(Boolean);

// /cases 페이지 형식으로 최종 변환
const finalCases = cleaned.map((c, i) => ({
  id: String(i + 1),
  company: c.company.replace(" 블로그", "").replace("서울 ", ""),
  industry: c.industry,
  emoji: c.emoji,
  challenge: getChallengeByIndustry(c.industry),
  solution: getSolutionByChannel(c.channel),
  result: `조회수 ${c.metrics.views} · ROI ${c.metrics.roi} · 문의 ${c.metrics.leads}`,
  metrics: c.metrics,
  tags: c.tags,
  channel: c.channel,
  channelColor: c.channelColor,
  title: c.title,
  desc: c.desc,
  sourceUrl: c.sourceUrl,
}));

function getChallengeByIndustry(industry) {
  const map = {
    "카페/F&B": "오프라인 홍보만으로는 신규 고객 유입에 한계",
    "외식업": "배달앱 의존도 높아 자체 마케팅 채널 부재",
    "인테리어": "견적 문의 단가 높지만 리드 확보가 어려움",
    "뷰티/미용": "단골 외 신규 고객 유입 채널 부족",
    "피트니스": "회원 이탈 방지 및 신규 등록 유도 어려움",
    "교육": "학부모 대상 신뢰 구축 및 바이럴 확산",
    "소상공인": "광고 예산 없이 온라인 노출 확보",
  };
  return map[industry] ?? "온라인 마케팅 채널 부재로 인한 성장 한계";
}

function getSolutionByChannel(channel) {
  const map = {
    "네이버블로그": "FlowPack AI로 키워드 최적화 블로그 콘텐츠 주 3회 발행",
    "Instagram": "AI 카드뉴스 + 릴스 스크립트 자동 생성 후 인스타 발행",
    "YouTube": "AI 스크립트 기반 쇼츠 + 블로그 동시 발행",
  };
  return map[channel] ?? "FlowPack AI 멀티채널 콘텐츠 자동화";
}

await fs.writeFile(
  path.join(__dirname, "output/cases-final.json"),
  JSON.stringify(finalCases, null, 2),
  "utf8"
);

console.log(`✅ 정제 완료: ${raw.length}건 → ${finalCases.length}건`);
console.log("\n📋 최종 목록:");
finalCases.forEach((c, i) => {
  console.log(`  [${i+1}] ${c.emoji} [${c.industry}] ${c.title.slice(0, 50)}`);
});
