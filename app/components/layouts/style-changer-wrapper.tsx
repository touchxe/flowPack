"use client";

/**
 * StyleChangerWrapper — 클라이언트 전용 렌더 래퍼
 * - next-themes의 ThemeProvider 내부에서 SSR 불일치 방지
 * - mounted 후에만 StyleChanger를 렌더링
 */

import * as React from "react";
import { StyleChanger } from "./style-changer";

export function StyleChangerWrapper() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <StyleChanger />;
}
