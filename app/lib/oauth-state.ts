import crypto from "crypto";

const STATE_TTL_MS = 10 * 60 * 1000;

export type SocialOAuthPlatform =
  | "INSTAGRAM"
  | "FACEBOOK"
  | "TWITTER"
  | "LINKEDIN"
  | "THREADS";

export interface SocialOAuthState {
  userId: string;
  platform: SocialOAuthPlatform;
  nonce: string;
  issuedAt: number;
}

function getStateSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET 환경변수가 필요합니다.");
  }
  return secret;
}

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", getStateSecret())
    .update(payload)
    .digest("base64url");
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

export function createSocialOAuthState(
  userId: string,
  platform: SocialOAuthPlatform
): string {
  const state: SocialOAuthState = {
    userId,
    platform,
    nonce: crypto.randomBytes(16).toString("base64url"),
    issuedAt: Date.now(),
  };
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySocialOAuthState(
  stateValue: string | null,
  expectedUserId: string,
  expectedPlatform: SocialOAuthPlatform
): SocialOAuthState | null {
  if (!stateValue) return null;

  const [payload, signature] = stateValue.split(".");
  if (!payload || !signature || !timingSafeEqual(sign(payload), signature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<SocialOAuthState>;
    if (
      parsed.userId !== expectedUserId ||
      parsed.platform !== expectedPlatform ||
      typeof parsed.issuedAt !== "number" ||
      Date.now() - parsed.issuedAt > STATE_TTL_MS
    ) {
      return null;
    }

    return parsed as SocialOAuthState;
  } catch {
    return null;
  }
}
