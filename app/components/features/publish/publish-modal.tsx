"use client";

import { useState, useEffect } from "react";
import { Instagram, Facebook, Twitter, Linkedin, Globe, Loader2, Check, X, Calendar, Tag, ChevronDown, ChevronUp } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface SocialAccount {
  id: string;
  platform: string;
  accountName: string;
  isActive: boolean;
}

interface WordPressCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
}

interface PublishResult {
  socialAccountId: string;
  platform: string;
  accountName: string;
  status: string;
  platformPostUrl?: string;
  errorMessage?: string;
}

interface PublishModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: string;
  contentTitle: string;
  /** 외부에서 미리 지정한 예약 시간 (SchedulePicker와 연동) */
  defaultScheduledAt?: string;
}

const platformConfig: Record<string, { name: string; icon: typeof Instagram; color: string }> = {
  INSTAGRAM: { name: "Instagram", icon: Instagram, color: "text-pink-600" },
  FACEBOOK: { name: "Facebook", icon: Facebook, color: "text-blue-600" },
  TWITTER: { name: "X (Twitter)", icon: Twitter, color: "text-black" },
  LINKEDIN: { name: "LinkedIn", icon: Linkedin, color: "text-blue-700" },
  NAVER_BLOG: { name: "Naver Blog", icon: Globe, color: "text-green-600" },
  WORDPRESS: { name: "WordPress", icon: Globe, color: "text-slate-600" },
};

export function PublishModal({ open, onOpenChange, contentId, contentTitle, defaultScheduledAt }: PublishModalProps) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState<PublishResult[] | null>(null);
  const [isScheduled, setIsScheduled] = useState(!!defaultScheduledAt);
  const [scheduledDate, setScheduledDate] = useState(defaultScheduledAt ?? "");

  // WordPress 카테고리 관련 상태
  const [wpCategories, setWpCategories] = useState<WordPressCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [wpAccountId, setWpAccountId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchAccounts();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSelectedIds([]);
      setResults(null);
      setIsScheduled(false);
      setScheduledDate("");
      setWpCategories([]);
      setSelectedCategories([]);
      setShowCategories(false);
      setWpAccountId(null);
    }
  }, [open]);

  // WordPress 계정이 선택/해제될 때 카테고리 로드
  useEffect(() => {
    const wpAccount = accounts.find(a => a.platform === "WORDPRESS" && selectedIds.includes(a.id));
    if (wpAccount && wpAccount.id !== wpAccountId) {
      setWpAccountId(wpAccount.id);
      fetchWpCategories();
    } else if (!wpAccount) {
      setWpAccountId(null);
      setWpCategories([]);
      setSelectedCategories([]);
      setShowCategories(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, accounts]);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/social-accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts.filter((a: SocialAccount) => a.isActive));
      }
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWpCategories = async () => {
    setLoadingCategories(true);
    setShowCategories(true);
    try {
      const res = await fetch("/api/publish/wordpress?action=categories");
      if (res.ok) {
        const data = await res.json();
        if (data.categories) {
          setWpCategories(data.categories);
        }
      }
    } catch (err) {
      console.error("카테고리 로드 실패:", err);
    } finally {
      setLoadingCategories(false);
    }
  };

  const toggleAccount = (accountId: string) => {
    setSelectedIds((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    );
  };

  const toggleCategory = (categoryId: number) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handlePublish = async () => {
    if (selectedIds.length === 0) return;

    setPublishing(true);
    try {
      // WordPress 계정이 선택된 경우 전용 엔드포인트 사용
      const hasWordPress = accounts.some(a => a.platform === "WORDPRESS" && selectedIds.includes(a.id));
      const nonWpIds = selectedIds.filter(id => {
        const account = accounts.find(a => a.id === id);
        return account?.platform !== "WORDPRESS";
      });

      const publishResults: PublishResult[] = [];

      // WordPress 배포 (카테고리 포함)
      if (hasWordPress) {
        const wpPayload: Record<string, unknown> = {
          contentId,
          status: isScheduled ? "future" : "publish",
        };
        if (selectedCategories.length > 0) wpPayload.categories = selectedCategories;
        if (isScheduled && scheduledDate) wpPayload.scheduledAt = scheduledDate;

        const wpRes = await fetch("/api/publish/wordpress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(wpPayload),
        });

        if (wpRes.ok) {
          const wpData = await wpRes.json();
          // WordPress 계정 정보로 result 생성
          const wpAccount = accounts.find(a => a.platform === "WORDPRESS" && selectedIds.includes(a.id));
          publishResults.push({
            socialAccountId: wpAccount?.id ?? "",
            platform: "WORDPRESS",
            accountName: wpAccount?.accountName ?? "",
            status: "SUCCESS",
            platformPostUrl: wpData.postUrl,
          });
        } else {
          const wpErr = await wpRes.json();
          const wpAccount = accounts.find(a => a.platform === "WORDPRESS" && selectedIds.includes(a.id));
          publishResults.push({
            socialAccountId: wpAccount?.id ?? "",
            platform: "WORDPRESS",
            accountName: wpAccount?.accountName ?? "",
            status: "FAILED",
            errorMessage: wpErr.error ?? "WordPress 배포 실패",
          });
        }
      }

      // 기타 플랫폼 배포 (기존 /api/publish)
      if (nonWpIds.length > 0) {
        const payload: Record<string, unknown> = {
          contentId,
          socialAccountIds: nonWpIds,
        };
        if (isScheduled && scheduledDate) payload.scheduledAt = scheduledDate;

        const res = await fetch("/api/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          publishResults.push(...(data.results ?? []));
        } else {
          const data = await res.json();
          alert(data.error || "배포 중 오류가 발생했습니다");
        }
      }

      if (publishResults.length > 0) {
        setResults(publishResults);
      }
    } catch (err) {
      console.error("Publish error:", err);
      alert("배포 중 오류가 발생했습니다");
    } finally {
      setPublishing(false);
    }
  };

  const groupedAccounts = accounts.reduce((acc, account) => {
    if (!acc[account.platform]) {
      acc[account.platform] = [];
    }
    acc[account.platform].push(account);
    return acc;
  }, {} as Record<string, SocialAccount[]>);

  const hasWpSelected = accounts.some(a => a.platform === "WORDPRESS" && selectedIds.includes(a.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>콘텐츠 배포</DialogTitle>
          <DialogDescription>
            &ldquo;{contentTitle}&rdquo;을(를) 배포할 채널을 선택하세요
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <div className="space-y-4">
            <h4 className="font-medium">배포 결과</h4>
            {results.map((result) => {
              const config = platformConfig[result.platform];
              if (!config) return null;
              const Icon = config.icon;

              return (
                <div key={result.socialAccountId} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full bg-muted ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{config.name}</p>
                      <p className="text-xs text-muted-foreground">{result.accountName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.status === "SUCCESS" ? (
                      <>
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-xs text-green-600">완료</span>
                        {result.platformPostUrl && (
                          <a href={result.platformPostUrl} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 underline ml-1">보기</a>
                        )}
                      </>
                    ) : result.status === "PENDING" ? (
                      <>
                        <Calendar className="h-4 w-4 text-yellow-600" />
                        <span className="text-xs text-yellow-600">예약됨</span>
                      </>
                    ) : (
                      <>
                        <X className="h-4 w-4 text-red-600" />
                        <span className="text-xs text-red-600">실패</span>
                        {result.errorMessage && (
                          <span className="text-xs text-red-400 ml-1">{result.errorMessage.slice(0, 30)}</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {results.every((r) => r.status === "SUCCESS" || r.status === "PENDING") && (
              <Button className="w-full" onClick={() => onOpenChange(false)}>
                완료
              </Button>
            )}
            {results.some(r => r.status === "FAILED") && (
              <Button variant="outline" className="w-full" onClick={() => setResults(null)}>
                다시 시도
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Schedule Toggle */}
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="schedule"
                checked={isScheduled}
                onChange={(e) => setIsScheduled(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="schedule" className="cursor-pointer">
                예약 배포
              </Label>
            </div>

            {isScheduled && (
              <div className="mb-4">
                <Label htmlFor="scheduledDate">예약 날짜/시간</Label>
                <Input
                  id="scheduledDate"
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="mt-1"
                />
              </div>
            )}

            {/* Account List */}
            <div className="space-y-4 max-h-64 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : accounts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  연동된 계정이 없습니다
                </div>
              ) : (
                Object.entries(groupedAccounts).map(([platform, platformAccounts]) => {
                  const config = platformConfig[platform];
                  if (!config) return null;
                  const Icon = config.icon;

                  return (
                    <div key={platform} className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Icon className="h-4 w-4" />
                        {config.name}
                      </div>
                      {platformAccounts.map((account) => (
                        <label
                          key={account.id}
                          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedIds.includes(account.id)
                              ? "border-primary bg-primary/5"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(account.id)}
                            onChange={() => toggleAccount(account.id)}
                            className="rounded"
                          />
                          <span className="text-sm">{account.accountName}</span>
                        </label>
                      ))}
                    </div>
                  );
                })
              )}
            </div>

            {/* WordPress 카테고리 선택 */}
            {hasWpSelected && (
              <div className="mt-4 border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowCategories(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted text-sm font-medium transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-slate-500" />
                    WordPress 카테고리
                    {selectedCategories.length > 0 && (
                      <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {selectedCategories.length}
                      </span>
                    )}
                  </span>
                  {showCategories ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showCategories && (
                  <div className="p-3 max-h-48 overflow-y-auto">
                    {loadingCategories ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">카테고리 불러오는 중...</span>
                      </div>
                    ) : wpCategories.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-3">
                        카테고리가 없습니다. (선택하지 않으면 미분류로 배포됩니다)
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {wpCategories.map(cat => (
                          <label
                            key={cat.id}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                              selectedCategories.includes(cat.id)
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-muted/50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedCategories.includes(cat.id)}
                              onChange={() => toggleCategory(cat.id)}
                              className="rounded"
                            />
                            <span className="text-sm flex-1">{cat.name}</span>
                            <span className="text-xs text-muted-foreground">({cat.count})</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Publish Button */}
            <Button
              className="w-full mt-4"
              onClick={handlePublish}
              disabled={selectedIds.length === 0 || publishing || (isScheduled && !scheduledDate)}
            >
              {publishing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  배포 중...
                </>
              ) : isScheduled ? (
                <>
                  <Calendar className="mr-2 h-4 w-4" />
                  예약하기
                </>
              ) : (
                `지금 배포 (${selectedIds.length}개)`
              )}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
