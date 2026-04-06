import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-bold">개인정보처리방침</h1>
        <p className="text-muted-foreground mt-2">최종 업데이트: 2026년 3월 31일</p>
      </div>

      <div className="prose prose-sm max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold mb-3">제1조 (수집하는 개인정보)</h2>
          <p className="text-muted-foreground mb-2">회사는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.</p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li><strong>필수 정보</strong>: 이메일 주소, 이름, 비밀번호</li>
            <li><strong>선택 정보</strong>: 프로필 사진, SNS 연동 정보</li>
            <li><strong>자동 수집 정보</strong>: IP 주소, 쿠키, 방문 기록, 서비스 이용 기록</li>
            <li><strong>결제 정보</strong>: 결제 승인번호, 결제 금액 (외부 결제 대행사를 통해 처리)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">제2조 (개인정보의 수집 목적)</h2>
          <p className="text-muted-foreground mb-2">회사는 수집한 개인정보를 다음과 같은 목적으로 이용합니다.</p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>서비스 제공 및 계약의 이행</li>
            <li>이용자 본인 확인 및authentication</li>
            <li>고객 지원 및 문의 대응</li>
            <li>서비스 개선 및 신규 기능 개발</li>
            <li>법령 및 약관 위반 행위의 감시 및 제재</li>
            <li>마케팅 및 광고에 활용 (동의 시)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">제3조 (개인정보의 보유 기간)</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li><strong>계약 또는 청약철회 등에 관한 기록</strong>: 5년</li>
            <li><strong>대금결제 및 재화 등의 공급에 관한 기록</strong>: 5년</li>
            <li><strong>소비자의 불만 또는 분쟁처리에 관한 기록</strong>: 3년</li>
            <li><strong>웹사이트 방문 기록</strong>: 3개월</li>
            <li><strong>세법이 규정하는 거래 기록</strong>: 5년</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">제4조 (개인정보의 파기)</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>수집 목적의 달성, 보유 기간의 경과, 서비스 종료 등의 사유가 발생하면 개인정보를 파기합니다.</li>
            <li>파기 사유가 발생한 개인정보는 내부 규정에 따라 분리 저장·관리됩니다.</li>
            <li>파기 대상에는 개인정보 외에 서비스 이용 기록, 접속 로그 등이 포함됩니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">제5조 (이용자의 권리)</h2>
          <p className="text-muted-foreground mb-2">이용자는 다음과 같은 권리를 보유합니다.</p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>개인정보 열람 요구</li>
            <li>오류 시 정정 요구</li>
            <li>삭제 요구</li>
            <li>처리 정지 요구</li>
          </ul>
          <p className="text-muted-foreground mt-2">
            위 권리 행사를 위해서는 마이페이지 또는 고객 지원을 통해 회사에 신청할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">제6조 (개인정보의 안전성 확보)</h2>
          <p className="text-muted-foreground">회사는 개인정보 보호를 위해 다음과 같은 안전성 확보에 필요한 조치를 취합니다.</p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>해킹 등에 대비한 기술적 보호 조치 (암호화, 방화벽)</li>
            <li>개인정보 접근 권한의 최소화</li>
            <li>정기적인 보안 감사 및 취약점 점검</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">제7조 (제3자 제공)</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>회사는 이용자의 개인정보를 제3자에게 제공하지 않습니다.</li>
            <li>법령의 규정에 의해 수사기관 등이 요구하는 경우, 최소한의 정보만 제공될 수 있습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">제8조 (쿠키의 사용)</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>회사는 이용자의 편의성 증대를 위해 쿠키를 사용할 수 있습니다.</li>
            <li>쿠키는 이용자의 컴퓨터에 저장되며, 브라우저 설정으로 차단할 수 있습니다.</li>
            <li>쿠키 차단을 선택할 경우 일부 서비스 이용에 제한이 있을 수 있습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">제9조 (고객 지원)</h2>
          <p className="text-muted-foreground">
            개인정보 보호와 관련한 문의, 불편 또는 개인정보 열람 등의 요청은 고객 서비스 센터를 통해 할 수 있습니다.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>고객 지원 이메일</strong>: support@flowpack.com
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">제10조 (정책의 변경)</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>이 정책은 법령의 변경 또는 서비스 개선을 위해 변경될 수 있습니다.</li>
            <li>변경 시 서비스 화면에 공지하거나 이메일로 통지합니다.</li>
            <li>중대한 변경 시에는 사전에 충분한 고지를 합니다.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
