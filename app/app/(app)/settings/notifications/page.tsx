"use client";

import { useState } from "react";
import { Bell, Mail, MessageSquare, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function NotificationsSettingsPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Notification preferences state
  const [preferences, setPreferences] = useState({
    emailMarketing: false,
    emailNewsletter: true,
    emailComments: true,
    emailPublish: true,
    emailBilling: true,
    pushEnabled: false,
    pushComments: true,
    pushPublish: true,
  });

  const handleToggle = (key: keyof typeof preferences) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setMessage({ type: "success", text: "알림 설정이 저장되었습니다." });
    setIsSaving(false);
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">알림 설정</h1>
        <p className="text-muted-foreground mt-1">
          이메일과 푸시 알림을 관리하세요.
        </p>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.type === "success" ? (
            <Check className="h-4 w-4" />
          ) : (
            <span className="h-4 w-4">!</span>
          )}
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Email Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              이메일 알림
            </CardTitle>
            <CardDescription>
              FlowPack에서 보내는 이메일 알림을 설정하세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-marketing">마케팅 이메일</Label>
                <p className="text-sm text-muted-foreground">
                  새 기능, 프로모션, 할인 코드 등의 내용을 받아보세요.
                </p>
              </div>
              <Switch
                id="email-marketing"
                checked={preferences.emailMarketing}
                onCheckedChange={() => handleToggle("emailMarketing")}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-newsletter">뉴스레터</Label>
                <p className="text-sm text-muted-foreground">
                  주간 뉴스레터를 받아보세요.
                </p>
              </div>
              <Switch
                id="email-newsletter"
                checked={preferences.emailNewsletter}
                onCheckedChange={() => handleToggle("emailNewsletter")}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-comments">댓글 알림</Label>
                <p className="text-sm text-muted-foreground">
                  내 콘텐츠에 댓글이 달릴 때 알림을 받아보세요.
                </p>
              </div>
              <Switch
                id="email-comments"
                checked={preferences.emailComments}
                onCheckedChange={() => handleToggle("emailComments")}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-publish">발행 알림</Label>
                <p className="text-sm text-muted-foreground">
                  예약된 콘텐츠가 발행될 때 알림을 받아보세요.
                </p>
              </div>
              <Switch
                id="email-publish"
                checked={preferences.emailPublish}
                onCheckedChange={() => handleToggle("emailPublish")}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-billing">결제 알림</Label>
                <p className="text-sm text-muted-foreground">
                  결제 완료, 구독 갱신 등 결제 관련 알림을 받아보세요.
                </p>
              </div>
              <Switch
                id="email-billing"
                checked={preferences.emailBilling}
                onCheckedChange={() => handleToggle("emailBilling")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Push Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              푸시 알림
            </CardTitle>
            <CardDescription>
              브라우저 푸시 알림을 설정하세요. 브라우저에서 권한을 허용해야 합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>푸시 알림 활성화</Label>
                <p className="text-sm text-muted-foreground">
                  푸시 알림을 받으려면 브라우저 권한이 필요합니다.
                </p>
              </div>
              <Switch
                checked={preferences.pushEnabled}
                onCheckedChange={() => handleToggle("pushEnabled")}
              />
            </div>

            {preferences.pushEnabled && (
              <>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="push-comments">댓글 알림</Label>
                    <p className="text-sm text-muted-foreground">
                      새 댓글이 달릴 때 즉시 알림을 받아보세요.
                    </p>
                  </div>
                  <Switch
                    id="push-comments"
                    checked={preferences.pushComments}
                    onCheckedChange={() => handleToggle("pushComments")}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="push-publish">발행 알림</Label>
                    <p className="text-sm text-muted-foreground">
                      예약된 콘텐츠가 발행될 때 알림을 받아보세요.
                    </p>
                  </div>
                  <Switch
                    id="push-publish"
                    checked={preferences.pushPublish}
                    onCheckedChange={() => handleToggle("pushPublish")}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* SMS Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              SMS 알림
            </CardTitle>
            <CardDescription>
              SMS로 중요한 알림을 받아보세요. 일부 국가에서만 사용 가능합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              SMS 알림은 현재 준비 중입니다. 이메일 알림을 통해 중요한 정보를 받아보세요.
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "저장 중..." : "알림 설정 저장"}
          </Button>
        </div>
      </form>
    </div>
  );
}
