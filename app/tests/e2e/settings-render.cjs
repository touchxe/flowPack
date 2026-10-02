// 격리된 SSR 프로세스에서 실제 UI를 렌더링한다. 운영 인증·DB는 변경하지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const mode = process.argv[2];
const section = mode === 'instructions-edit' ? 'instructions' : mode;
const root = process.cwd();
const originalLoad = Module._load;
const user = { name: '모바일 테스트 사용자', email: 'long-mobile-profile-address@example.com', username: null };
const stateIndices = new Map();
Module._load = function (id, parent, isMain) {
  if (id === 'next/navigation') return { usePathname: () => `/settings/${section}`, useRouter: () => ({ push() {} }) };
  if (id === 'next-auth/react') return { useSession: () => ({ data: { user }, update: async () => {} }), signOut() {} };
  if (id === '@/lib/use-notifications') return { useNotifications: () => ({ notifications: [], unreadCount: 0, isLoading: false }) };
  if (id === 'react') return { ...React, useState: initial => {
    const index = stateIndices.get(parent.filename) || 0;
    stateIndices.set(parent.filename, index + 1);
    // 로딩 완료, 긴 계정 정보로 좁은 화면을 재현한다.
    if (parent.filename.endsWith('/profile/page.tsx') && index < 3) initial = [user.name, user.email, ''][index];
    if (parent.filename.endsWith('/notifications/page.tsx') && index === 2) initial = false;
    if (parent.filename.endsWith('/instructions/page.tsx')) {
      if (index === 2 || index === 5) initial = false;
      if (mode === 'instructions-edit' && index === 0) initial = 'user';
      if (mode === 'instructions-edit' && index === 9) initial = true;
    }
    return React.useState(initial);
  } };
  if (id.startsWith('@/')) id = path.join(root, id.slice(2));
  return originalLoad.call(this, id, parent, isMain);
};
for (const extension of ['.ts', '.tsx']) {
  Module._extensions[extension] = (mod, filename) => {
    const source = fs.readFileSync(filename, 'utf8');
    mod._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
  };
}
const { AppLayout } = require(path.join(root, 'components/layouts/app-layout.tsx'));
const SettingsLayout = require(path.join(root, 'app/(app)/settings/layout.tsx')).default;
const Page = require(path.join(root, section === 'billing' ? 'app/(app)/settings/billing/billing-client.tsx' : `app/(app)/settings/${section}/page.tsx`)).default;
process.stdout.write(renderToStaticMarkup(React.createElement(AppLayout, null, React.createElement(SettingsLayout, null, React.createElement(Page, section === 'billing' ? { currentPlan: 'PRO', subscription: { plan: 'PRO', status: 'active', billingCycle: 'MONTHLY', currentPeriodEnd: '2026-11-02T00:00:00Z', canceledAt: null } } : null)))));
