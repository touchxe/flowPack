import crypto from "crypto";

const TOKEN_PREFIX = "enc:v1:";
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const secret = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY ?? process.env.AUTH_SECRET;

  if (!secret || secret.length < 16) {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY 또는 AUTH_SECRET 환경변수가 필요합니다.");
  }

  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSocialToken(value: string): string {
  if (value.startsWith(TOKEN_PREFIX)) return value;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${TOKEN_PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSocialToken(value: string): string {
  if (!value.startsWith(TOKEN_PREFIX)) return value;

  const parts = value.slice(TOKEN_PREFIX.length).split(".");
  if (parts.length !== 3) {
    throw new Error("암호화된 SNS 토큰 형식이 올바르지 않습니다.");
  }

  const [ivPart, tagPart, encryptedPart] = parts;
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivPart, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
