"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowRight, Chrome, MessageCircle, Apple, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // 비밀번호 유효성 검사
  const passwordRequirements = [
    { id: "length", label: "8자 이상", valid: password.length >= 8 },
    { id: "number", label: "숫자 포함", valid: /\d/.test(password) },
    { id: "special", label: "특수문자 포함", valid: /[^a-zA-Z0-9]/.test(password) },
  ];

  const isPasswordValid = passwordRequirements.every((req) => req.valid);
  const isConfirmValid = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (!isPasswordValid) {
      setError("비밀번호 조건을 충족해주세요.");
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "회원가입 중 오류가 발생했습니다.");
        setIsLoading(false);
        return;
      }

      // 회원가입 성공 후 자동 로그인
      await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      router.push("/home");
    } catch {
      setError("회원가입 중 오류가 발생했습니다.");
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: "google" | "kakao" | "apple") => {
    await signIn(provider, { callbackUrl: "/home" });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 회원가입 폼 */}
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">회원가입</CardTitle>
            <CardDescription>FlowPack을 무료로 시작하세요</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 소셜 로그인 */}
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => handleSocialLogin("google")}
                disabled={isLoading}
              >
                <Chrome className="mr-2 h-4 w-4" />
                Google로 계속하기
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => handleSocialLogin("kakao")}
                disabled={isLoading}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Kakao로 계속하기
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => handleSocialLogin("apple")}
                disabled={isLoading}
              >
                <Apple className="mr-2 h-4 w-4" />
                Apple로 계속하기
              </Button>
            </div>

            {/* 구분선 */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">또는</span>
              </div>
            </div>

            {/* 이메일 회원가입 */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
                {/* 비밀번호 조건 */}
                {password.length > 0 && (
                  <div className="space-y-1 rounded-md bg-muted p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">비밀번호 조건</p>
                    <ul className="space-y-1">
                      {passwordRequirements.map((req) => (
                        <li
                          key={req.id}
                          className={`flex items-center gap-2 text-xs ${
                            password.length > 0
                              ? req.valid
                                ? "text-green-600"
                                : "text-muted-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          <Check className="h-3 w-3" />
                          {req.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">비밀번호 확인</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className={
                    confirmPassword.length > 0
                      ? isConfirmValid
                        ? "border-green-500"
                        : "border-destructive"
                      : ""
                  }
                />
                {confirmPassword.length > 0 && !isConfirmValid && (
                  <p className="text-xs text-destructive">비밀번호가 일치하지 않습니다</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || !isPasswordValid}>
                {isLoading ? "회원가입 중..." : "회원가입"}
                {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </form>

            {/* 로그인 링크 */}
            <p className="text-center text-sm text-muted-foreground">
              이미 계정이 있으신가요?{" "}
              <Link href="/login" className="text-primary hover:underline">
                로그인
              </Link>
            </p>

            {/* 이용약관 */}
            <p className="text-center text-xs text-muted-foreground">
              회원가입 시{" "}
              <Link href="/terms" className="text-primary hover:underline">
                이용약관
              </Link>{" "}
              및{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                개인정보처리방침
              </Link>
              에 동의합니다.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
