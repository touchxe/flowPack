"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, Instagram, Facebook, Twitter, Linkedin, Globe, AlertCircle, Check, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SocialAccount {
  id: string;
  platform: string;
  accountName: string;
  isActive: boolean;
  connectedAt: string;
}

const platformConfig: Record<string, { name: string; icon: typeof Instagram; color: string }> = {
  INSTAGRAM: { name: "Instagram", icon: Instagram, color: "text-pink-600" },
  FACEBOOK: { name: "Facebook", icon: Facebook, color: "text-blue-600" },
  TWITTER: { name: "X (Twitter)", icon: Twitter, color: "text-black" },
  LINKEDIN: { name: "LinkedIn", icon: Linkedin, color: "text-blue-700" },
  NAVER_BLOG: { name: "Naver Blog", icon: Globe, color: "text-green-600" },
  WORDPRESS: { name: "WordPress", icon: Globe, color: "text-slate-600" },
};

export default function SocialAccountsPage() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const success = searchParams.get("success");
  const error = searchParams.get("error");

  useEffect(() => {
    if (success === "connected") {
      setMessage({ type: "success", text: "계정이 성공적으로 연동되었습니다" });
    } else if (error === "already_connected") {
      setMessage({ type: "error", text: "이미 연동된 계정입니다" });
    }
  }, [success, error]);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await fetch("/api/social-accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts);
      }
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (platform: string) => {
    setConnecting(platform);
    try {
      // In production, this would redirect to OAuth flow
      // For mock, we'll call the mock callback directly
      const res = await fetch(`/api/social-accounts/connect/${platform}`);
      if (res.redirected) {
        window.location.href = res.url;
      }
    } catch (err) {
      setMessage({ type: "error", text: "연동 중 오류가 발생했습니다" });
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!confirm("정말 연동을 해제하시겠습니까?")) return;

    setDeleting(accountId);
    try {
      const res = await fetch(`/api/social-accounts?id=${accountId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setAccounts(accounts.filter((a) => a.id !== accountId));
        setMessage({ type: "success", text: "연동이 해제되었습니다" });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "연동 해제 중 오류가 발생했습니다" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "연동 해제 중 오류가 발생했습니다" });
    } finally {
      setDeleting(null);
    }
  };

  const connectedPlatforms = new Set(accounts.map((a) => a.platform));
  const allPlatforms = Object.keys(platformConfig);

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <Link
          href="/home"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          홈으로
        </Link>
        <h1 className="text-3xl font-bold">SNS 연동</h1>
        <p className="text-muted-foreground mt-2">
          SNS와 블로그 계정을 연동하여 콘텐츠를 배포하세요
        </p>
      </div>

      {message && (
        <Alert className={`mb-6 ${message.type === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
          {message.type === "success" ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription className={message.type === "success" ? "text-green-800" : "text-red-800"}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Connected Accounts */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>연동된 계정</CardTitle>
          <CardDescription>현재 연동된 SNS 및 블로그 계정 목록</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              연동된 계정이 없습니다. 아래에서 계정을 추가하세요.
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => {
                const config = platformConfig[account.platform];
                if (!config) return null;
                const Icon = config.icon;

                return (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full bg-muted ${config.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{config.name}</p>
                        <p className="text-sm text-muted-foreground">{account.accountName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-600">연동됨</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDisconnect(account.id)}
                        disabled={deleting === account.id}
                        className="text-destructive hover:text-destructive"
                      >
                        {deleting === account.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Platforms */}
      <Card>
        <CardHeader>
          <CardTitle>계정 추가</CardTitle>
          <CardDescription>연동할 SNS 또는 블로그 계정을 선택하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allPlatforms.map((platform) => {
              const config = platformConfig[platform];
              if (!config) return null;
              const Icon = config.icon;
              const isConnected = connectedPlatforms.has(platform);
              const isConnecting = connecting === platform;

              return (
                <div
                  key={platform}
                  className={`p-4 border rounded-lg ${isConnected ? "bg-muted/50" : ""}`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-full bg-muted ${config.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{config.name}</p>
                      {isConnected && (
                        <p className="text-xs text-green-600">이미 연동됨</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant={isConnected ? "outline" : "default"}
                    size="sm"
                    className="w-full"
                    onClick={() => handleConnect(platform)}
                    disabled={isConnected || isConnecting}
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        연동 중...
                      </>
                    ) : isConnected ? (
                      "연동됨"
                    ) : (
                      "연결하기"
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
