import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";

const source = await readFile(new URL("../app/api/generate/longform/route.ts", import.meta.url), "utf8");

async function generate({ saveFails = false, legacyUser = false } = {}) {
  let creditsCharged = 0;
  const errors = [];
  const prisma = {
    user: {
      findUnique: async () => ({ role: "USER", plan: "FREE", creditsUsed: 0, creditsTotal: 10 }),
      update: async ({ select }) => {
        if (legacyUser && !select?.id) throw new Error("P2022: users.username");
        creditsCharged += 1;
        return { id: "user-1" };
      },
    },
    content: {
      create: async ({ select }) => {
        if (saveFails) throw new Error("database unavailable");
        // 저장 후 불필요한 신규 컬럼을 반환하면 이전 DB에서 실패한다.
        if (!select?.id) throw new Error("P2022: contents.coverMediaId");
        return { id: "draft-1" };
      },
    },
  };
  const modules = {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/auth": { auth: async () => ({ user: { id: "user-1" } }) },
    "@/lib/prisma": { prisma },
    "@/lib/ai-client": {
      isAIConfigured: async () => true,
      callAIStream: async () => ({
        provider: "test", model: "test",
        stream: (async function* () { yield "## 테스트\n\n생성된 초안"; })(),
      }),
      callAI: async () => ({ content: "테스트 제목" }),
    },
    "@/lib/notifications": { createNotification: async () => {}, notifyCreditWarning: async () => {} },
    "@/lib/blog-markdown": { BLOG_SEMANTIC_MARKDOWN_GUIDELINES: "", normalizeGeneratedBlogMarkdown: (text) => text },
    zod: { z },
  };
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const routeModule = { exports: {} };
  vm.runInNewContext(compiled, {
    exports: routeModule.exports, module: routeModule,
    require: (name) => {
      if (!(name in modules)) throw new Error(`Unexpected import: ${name}`);
      return modules[name];
    },
    Response, ReadableStream, TextEncoder,
    console: { error: (...args) => errors.push(args) },
  });
  const response = await routeModule.exports.POST(new Request("http://localhost/api/generate/longform", {
    method: "POST", body: JSON.stringify({ topic: "테스트 주제" }),
  }));
  const events = (await response.text()).split("\n\n").filter(Boolean)
    .map((line) => JSON.parse(line.slice(6)));
  return { events, creditsCharged, errors };
}

test("장문 저장은 사용하지 않는 신규 컬럼을 반환하지 않아도 완료된다", async () => {
  const { events, creditsCharged } = await generate();
  assert.equal(events.at(-1).type, "done");
  assert.equal(events.at(-1).contentId, "draft-1");
  assert.equal(creditsCharged, 1);
});

test("크레딧 갱신은 사용하지 않는 사용자 컬럼을 반환하지 않는다", async () => {
  const { events, creditsCharged } = await generate({ legacyUser: true });
  assert.equal(events.at(-1).type, "done");
  assert.equal(creditsCharged, 1);
});

test("실제 저장 실패는 오류를 전달하고 크레딧을 차감하지 않는다", async () => {
  const { events, creditsCharged, errors } = await generate({ saveFails: true });
  assert.equal(events.at(-1).code, "LONGFORM_SAVE_ERROR");
  assert.equal(events.some((event) => event.type === "done"), false);
  assert.equal(creditsCharged, 0);
  assert.equal(errors.length, 1);
});
