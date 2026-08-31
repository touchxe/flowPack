import { z } from "zod";

const USERNAME_PATTERN = /^[a-z][a-z0-9_]{3,19}$/;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    USERNAME_PATTERN,
    "아이디는 영문자로 시작하는 영문, 숫자, 밑줄 4~20자로 입력해주세요."
  );

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}
