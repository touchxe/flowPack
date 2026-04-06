import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold">이용약관</h1>
        <p className="text-muted-foreground mt-2">최종 업데이트: 2026년 3월 31일</p>
      </div>

      <div className="prose prose-sm max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold mb-3">제1조 (목적)</h2>
          <p className="text-muted-foreground">
            이 이용약관(이하 &quot;약관&quot;)은 FlowPack(이하 &quot;회사&quot;)이 제공하는 AI 기반 홍보 콘텐츠 플랫폼 서비스(이하 &quot;서비스&quot;)를 이용하는 고객(이하 &quot;이용자&quot;)과 회사 사이의 권리, 의무 및 책임 등을 규정함을 목적으로 합니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">제2조 (정의)</h2>
          <p className="text-muted-foreground mb-2">이 약관에서 사용하는 용어의 정의는 다음과 같습니다.</p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>&quot;서비스&quot;라 함은 회사가 제공하는 AI 기반 홍보 콘텐츠 생성, 관리 및 배포 관련 모든 서비스를 말합니다.</li>
            <li>&quot;이용자&quot;라 함은 이 약관에 따라 회사가 제공하는 서비스를 이용하는 자를 말합니다.</li            >
            <li>&quot;크레딧&quot;이라 함은 서비스 내에서 AI 콘텐츠 생성 시 사용되는 가상 포인트로, 유료 또는 무료로 취득할 수 있습니다.</li>
            <li>&quot;계정&quot;이라 함은 利用자가 서비스에 접근하기 위해 생성한 계정을 말합니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">제3조 (약관의 효력 및 변경)</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>회사는 이 약관을 이용자에게 공지하거나 통지하지 않을 수 있습니다.</li>
            <li>회사는 약관을 변경할 수 있으며, 변경된 약관은 서비스 화면에 공지하거나 이용자에게 통지함으로써 효력이 발생합니다.</li>
            <li>이용자는 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 계약을 해지할 수 있습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">제4조 (서비스의 제공)</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>회사는 이용자에게 AI 기반 카드뉴스 생성, 블로그 작성, SNS 연동 등의 서비스를 제공합니다.</li>
            <li>회사는 서비스의 내용을 기술적 사양 등의 변경에 따라 변경할 수 있습니다.</li>
            <li>서비스의 내용은 사전 고지 없이 변경될 수 있습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">제5조 (크레딧)</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>크레딧은 서비스 내 AI 콘텐츠 생성 시 1개씩 차감됩니다.</li>
            <li>무료 크레딧은 월 10개로 제한되며, 차감된 크레딧은 다음 달로 이월되지 않습니다.</li>
            <li>유료로 구매한 크레딧은 구매일로부터 1년간 유효합니다.</li>
            <li>크레딧은 현금으로 환불되지 않습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">제6조 (이용자의 의무)</h2>
          <p className="text-muted-foreground mb-2">이용자는 다음 행위를 하여서는 안 됩니다.</p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>타인의 계정 정보를 도용하는 행위</li>
            <li>서비스를 이용하여违法犯罪한 콘텐츠를 생성하는 행위</li>
            <li>회사 또는 제3자의 지적재산권을 침해하는 행위</li>
            <li>서비스의 정상적인 운영을 방해하는 행위</li>
            <li>기타 법령 또는 약관에 위반되는 행위</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">제7조 (서비스의 중단)</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>회사는 시스템 점검, 서버 유지보수 등의 이유로 서비스 제공을 일시적으로 중단할 수 있습니다.</li>
            <li>서비스 중단 시 사전에 이용자에게 공지합니다.</li>
            <li>긴급한 경우 사전 공지 없이 서비스가 중단될 수 있습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">제8조 (책임의 제한)</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>회사는 이용자가 서비스를 이용하여 생성한 콘텐츠의 내용에 대해 책임지지 않습니다.</li>
            <li>회사는 이용자와 제3자 사이에 발생한 분쟁에 개입하지 않습니다.</li>
            <li>회사의 고의 또는 중대한 과실이 없는 한 서비스 이용으로 인한 손해에 대해 책임지지 않습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">제9조 (분쟁의 해결)</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>이 약관과 관련하여 분쟁이 발생한 경우, 성실히 협의하여 해결합니다.</li>
            <li>협상이 이루어지지 않을 경우, 개인정보보호책임자에게申诉할 수 있습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">제10조 (관할 법원)</h2>
          <p className="text-muted-foreground">
            이 약관에 따른 분쟁은 대한민국법을 적용하며, 분쟁 해결 시 회사 소재지의 법원을 관할 법원으로 합니다.
          </p>
        </section>
      </div>
    </div>
  );
}
