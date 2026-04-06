import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function CookiePage() {
  return (
    <div className="container mx-auto px-6 py-8 max-w-3xl">
      <div className="mb-8">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          홈으로
        </Link>
        <h1 className="text-3xl font-bold">쿠키 정책</h1>
        <p className="text-muted-foreground mt-2">최종 업데이트: 2026년 3월 31일</p>
      </div>

      <div className="prose prose-sm max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold mb-3">쿠키란?</h2>
          <p className="text-muted-foreground">
            쿠키는 이용자가 웹사이트를 방문할 때 이용자의 컴퓨터나 모바일 기기에 저장되는 작은 텍스트 파일입니다.
            쿠키는 웹사이트가 이용자를 인식하고, 이용자의 선호 설정을 저장하며, 이용자에게 더 나은 서비스를 제공하는 데 사용됩니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">사용하는 쿠키의 종류</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">필수 쿠키</h3>
              <p className="text-muted-foreground">
                서비스 제공에 필수적인 쿠키로, 이용자의 요청에 따른 응답을 제공하고,
                보안 기능을 지원합니다. 이러한 쿠키는 차단할 수 없습니다.
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">기능 쿠키</h3>
              <p className="text-muted-foreground">
                이용자의 선호 설정(언어, 테마 등)을 기억하고, 보다 편리한 기능을 제공합니다.
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">분석 쿠키</h3>
              <p className="text-muted-foreground">
                이용자가 웹사이트를 어떻게 이용하고 있는지를 파악하여, 서비스를 개선하는 데 사용됩니다.
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">마케팅 쿠키</h3>
              <p className="text-muted-foreground">
                이용자의 관심사에 따라 맞춤형 광고를 제공하거나, 광고 효과를 측정하는 데 사용됩니다.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">쿠키 사용 목적</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>이용자 인증 및反恐 조치</li>
            <li>서비스 이용 기록 및 분석</li>
            <li>개인화된 콘텐츠 및 광고 제공</li>
            <li>서비스 품질 개선</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">쿠키 관리 방법</h2>
          <p className="text-muted-foreground mb-2">
            이용자는 브라우저 설정을 통해 쿠키를 관리하거나 삭제할 수 있습니다.
          </p>
          <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
            <p><strong>Chrome</strong>: 설정 - 개인정보 및 보안 - 쿠키 및 기타 사이트 데이터</p>
            <p><strong>Safari</strong>: 환경설정 - 개인정보 - 쿠키 및 웹사이트 데이터</p>
            <p><strong>Firefox</strong>: 옵션 - 개인정보 및 보안 - 쿠키 및 사이트 데이터</p>
            <p><strong>Edge</strong>: 설정 - 쿠키 및 사이트 권한 - 쿠키 관리</p>
          </div>
          <p className="text-muted-foreground mt-3">
            단, 쿠키 차단을 선택할 경우 서비스의 일부 기능이 정상 작동하지 않을 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">쿠키 보유 기간</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li><strong>세션 쿠키</strong>: 브라우저를 닫으면 자동으로 삭제됩니다.</li>
            <li><strong>영속성 쿠키</strong>: 설정된 기간(보통 1년)까지 이용자의 기기에 저장됩니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">고객 지원</h2>
          <p className="text-muted-foreground">
            쿠키 정책에 관하여 문의가 있으시면 고객 지원팀에 연락해 주세요.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>이메일</strong>: support@flowpack.com
          </p>
        </section>
      </div>
    </div>
  );
}
