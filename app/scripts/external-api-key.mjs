import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const allowedScopes = new Set([
  "content:read", "content:write", "content:generate", "media:read", "media:write",
]);

function usage() {
  console.error("사용법: node scripts/external-api-key.mjs create <email-or-user-id> <name> [days] [comma-scopes]");
  console.error("       node scripts/external-api-key.mjs list <email-or-user-id>");
  console.error("       node scripts/external-api-key.mjs revoke <key-id>");
}

async function findUser(identifier) {
  return prisma.user.findFirst({ where: { OR: [{ id: identifier }, { email: identifier }] } });
}

async function main() {
  const [command, identifier, name, daysArg = "90", scopesArg = [...allowedScopes].join(",")] = process.argv.slice(2);
  if (!command || !identifier) { usage(); process.exitCode = 1; return; }

  if (command === "revoke") {
    const updated = await prisma.apiKey.update({ where: { id: identifier }, data: { revokedAt: new Date() } });
    console.log(JSON.stringify({ id: updated.id, revokedAt: updated.revokedAt }));
    return;
  }

  const user = await findUser(identifier);
  if (!user) throw new Error("사용자를 찾을 수 없습니다.");

  if (command === "list") {
    const keys = await prisma.apiKey.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, prefix: true, scopes: true, expiresAt: true, revokedAt: true, lastUsedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    console.log(JSON.stringify(keys, null, 2));
    return;
  }

  if (command !== "create" || !name) { usage(); process.exitCode = 1; return; }
  const days = Number(daysArg);
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error("유효기간은 1~365일이어야 합니다.");
  const scopes = [...new Set(scopesArg.split(",").map((scope) => scope.trim()).filter(Boolean))];
  if (scopes.length === 0 || scopes.some((scope) => !allowedScopes.has(scope))) throw new Error("지원하지 않는 scope가 있습니다.");

  const token = `fp_${randomBytes(32).toString("base64url")}`;
  const created = await prisma.apiKey.create({
    data: {
      userId: user.id,
      name: name.slice(0, 100),
      prefix: token.slice(0, 12),
      keyHash: createHash("sha256").update(token).digest("hex"),
      scopes: JSON.stringify(scopes),
      expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    },
  });
  console.log(JSON.stringify({ id: created.id, token, expiresAt: created.expiresAt, scopes }));
  console.error("이 키는 다시 표시되지 않습니다. 안전한 비밀 저장소에 보관하세요.");
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
