import { createServer } from "node:http";

const port = Number(process.env.FLOWPACK_AI_TEST_PORT ?? "3108");
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("FLOWPACK_AI_TEST_PORT must be an unprivileged TCP port");
}

function responsePayload(requestBody) {
  const isTitleRequest = Number(requestBody.max_tokens ?? 0) <= 100;
  const content = isTitleRequest
    ? "사진과 함께 만드는 안전한 WordPress 초안"
    : [
        "# 사진과 함께 만드는 안전한 WordPress 초안",
        "",
        "FlowPack과 WordPress를 연결하면 생성 결과를 검토 가능한 초안으로 가져올 수 있습니다.",
        "",
        "## 실행 체크리스트",
        "",
        "- 공개 HTTPS API 주소와 최소 권한 키를 설정합니다.",
        "- 생성 결과와 사진을 확인합니다.",
        "- 검토가 끝난 뒤 WordPress에서 직접 공개합니다.",
        "",
        "## 마무리",
        "",
        "자동 공개 없이 초안을 검토하면 안전하게 콘텐츠를 운영할 수 있습니다.",
      ].join("\n");
  return {
    id: "chatcmpl-flowpack-local-test",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "flowpack-local-test",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  };
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/v1/chat/completions") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { message: "Not found" } }));
    return;
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      response.writeHead(413, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "Request too large" } }));
      return;
    }
    chunks.push(chunk);
  }

  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    response.writeHead(400, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { message: "Invalid JSON" } }));
    return;
  }
  const payload = JSON.stringify(responsePayload(body));
  response.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  response.end(payload);
});

server.listen(port, "127.0.0.1", () => {
  console.log(JSON.stringify({ ready: true, address: `http://127.0.0.1:${port}/v1` }));
});
