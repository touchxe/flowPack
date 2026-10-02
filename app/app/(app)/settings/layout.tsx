"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Bell, CreditCard, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/settings/profile", label: "프로필", icon: User, desc: "계정 정보 및 테마" },
  { href: "/settings/instructions", label: "작성 지침", icon: BookOpen, desc: "AI 글쓰기 규칙" },
  { href: "/settings/notifications", label: "알림", icon: Bell, desc: "이메일 · 푸시" },
  { href: "/settings/billing", label: "결제", icon: CreditCard, desc: "구독 · 플랜" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-w-0 flex-col items-stretch gap-6 py-2 xl:flex-row xl:items-start xl:gap-8">
      <aside className="w-full shrink-0 rounded-[18px] border border-fp-border bg-fp-card-bg p-2.5 shadow-card xl:sticky xl:top-20 xl:w-[236px]">
        <p className="m-0 px-3 pb-3 pt-2 text-xs font-extrabold tracking-widest text-fp-muted">설정</p>
        <nav aria-label="설정" className="grid grid-cols-2 gap-1 sm:grid-cols-4 xl:grid-cols-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon, desc }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={isActive ? "page" : undefined}
                className={cn("flex min-h-14 min-w-0 items-center gap-2 rounded-xl px-2 py-3 no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:gap-3 xl:px-3.5", isActive ? "bg-fp-primary-subtle" : "hover:bg-fp-section-bg")}>
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] xl:h-[38px] xl:w-[38px]", isActive ? "bg-fp-primary-subtle text-brand-500" : "bg-fp-section-bg text-fp-muted")}>
                  <Icon size={17} />
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-sm leading-tight xl:text-[15px]", isActive ? "font-extrabold text-fp-heading" : "font-semibold text-fp-secondary")}>{label}</span>
                  <span className="hidden text-xs text-fp-muted xl:block">{desc}</span>
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
