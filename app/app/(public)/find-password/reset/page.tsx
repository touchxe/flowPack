"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

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

    if (!token) {
      setError("토큰이 없습니다.");
      return;
    }

    if (!isPasswordValid) {
      setError("비밀번호 조건을 충족해주세요.");
      return;
    }

    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "오류가 발생했습니다.");
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
    } catch {
      setError("요청 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 토큰이 없는 경우
  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl">토큰 오류</CardTitle>
          <CardDescription>
            유효하지 않은 링크입니다.
            <br />
            이메일로 받은 링크를 다시 확인해주세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/find-password">비밀번호 재설정 다시 요청</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 성공 화면
  if (isSuccess) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <Check className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle className="text-2xl">비밀번호 변경 완료</CardTitle>
          <CardDescription>
            비밀번호가 성공적으로 변경되었습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" asChild>
            <Link href="/login">로그인 페이지로 이동</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">새 비밀번호 설정</CardTitle>
        <CardDescription>
          새로운 비밀번호를 입력해주세요.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">새 비밀번호</Label>
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
            {isLoading ? "변경 중..." : "비밀번호 변경"}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-primary"
          >
            로그인 페이지로 돌아가기
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingFallback() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="h-8 w-32 mx-auto bg-muted rounded animate-pulse" />
        <div className="h-4 w-48 mx-auto mt-2 bg-muted rounded animate-pulse" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-10 w-full bg-muted rounded animate-pulse" />
        <div className="h-10 w-full bg-muted rounded animate-pulse" />
        <div className="h-10 w-full bg-muted rounded animate-pulse" />
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 본문 */}
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <Suspense fallback={<LoadingFallback />}>
          <ResetPasswordForm />
        </Suspense>
      </main>
    </div>
  );
}
