"use client";

import { useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export function SessionCheck() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const lastSessionId = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !session?.sessionId) {
      return;
    }

    // sessionId가 변경되었는지 확인 (다른 기기에서 로그인됨)
    if (lastSessionId.current && lastSessionId.current !== session.sessionId) {
      // 이전 세션과 다르면 다른 기기에서 로그인된 것
      signOut({ callbackUrl: "/login?reason=duplicate" });
      return;
    }

    lastSessionId.current = session.sessionId;
  }, [session, status, router]);

  return null;
}
