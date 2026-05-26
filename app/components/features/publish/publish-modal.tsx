"use client";

import { useState, useEffect, useCallback } from "react";
import { Instagram, Facebook, Twitter, Linkedin, Globe, AtSign, Loader2, Check, X, Calendar, Tag, ChevronDown, ChevronUp } from "lucide-react";
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
  THREADS: { name: "Threads", icon: AtSign, color: "text-neutral-900" },
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

  // WordPress 카테고리 관련 상태 — 사이트별 분리
  const [wpCategoriesMap, setWpCategoriesMap] = useState<Record<string, WordPressCategory[]>>({});
  const [selectedCategoriesMap, setSelectedCategoriesMap] = useState<Record<string, number[]>>({});
  const [loadingCategoriesMap, setLoadingCategoriesMap] = useState<Record<string, boolean>>({});
  const [showCategories, setShowCategories] = useState(false);
  // 현재 카테고리 탭에서 선택된 WP 사이트
  const [activeCategoryTab, setActiveCategoryTab] = useState<string | null>(null);

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
      setWpCategoriesMap({});
      setSelectedCategoriesMap({});
      setLoadingCategoriesMap({});
      setShowCategories(false);
      setActiveCategoryTab(null);
    }
  }, [open]);

  // WordPress 계정이 선택/해제될 때 해당 사이트의 카테고리 로드
  const selectedWpAccounts = accounts.filter(a => a.platform === "WORDPRESS" && selectedIds.includes(a.id));

  const fetchWpCategories = useCallback(async (accountId: string) => {
    if (wpCategoriesMap[accountId]) return; // 이미 로드됨
    setLoadingCategoriesMap(prev => ({ ...prev, [accountId]: true }));
    try {
      const res = await fetch(`/api/publish/wordpress?action=categories&socialAccountId=${accountId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.categories) {
          setWpCategoriesMap(prev => ({ ...prev, [accountId]: data.categories }));
        }
      }
    } catch (err) {
      console.error("카테고리 로드 실패:", err);
    } finally {
      setLoadingCategoriesMap(prev => ({ ...prev, [accountId]: false }));
    }
  }, [wpCategoriesMap]);

  useEffect(() => {
    // 선택된 WP 계정의 카테고리 미리 로드
    for (const wpAcc of selectedWpAccounts) {
      fetchWpCategories(wpAcc.id);
    }
    // 선택된 WP 계정이 있으면 카테고리 패널 표시, 첫 번째 탭 활성화
    if (selectedWpAccounts.length > 0) {
      setShowCategories(true);
      if (!activeCategoryTab || !selectedWpAccounts.find(a => a.id === activeCategoryTab)) {
        setActiveCategoryTab(selectedWpAccounts[0].id);
      }
    } else {
      setShowCategories(false);
      setActiveCategoryTab(null);
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

  const toggleAccount = (accountId: string) => {
    setSelectedIds((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    );
  };

  const toggleCategory = (accountId: string, categoryId: number) => {
    setSelectedCategoriesMap(prev => {
      const current = prev[accountId] ?? [];
      return {
        ...prev,
        [accountId]: current.includes(categoryId)
          ? current.filter(id => id !== categoryId)
          : [...current, categoryId],
      };
    });
  };

  const handlePublish = async () => {
    if (selectedIds.length === 0) return;

    setPublishing(true);
    try {
      // WordPress 계정 분리
      const wpSelectedAccounts = accounts.filter(a => a.platform === "WORDPRESS" && selectedIds.includes(a.id));
      const nonWpIds = selectedIds.filter(id => {
        const account = accounts.find(a => a.id === id);
        return account?.platform !== "WORDPRESS";
      });

      const publishResults: PublishResult[] = [];

      // WordPress 배포 — 각 사이트별 개별 배포 (카테고리 사이트별 적용)
      for (const wpAccount of wpSelectedAccounts) {
        const siteCategories = selectedCategoriesMap[wpAccount.id] ?? [];
        const wpPayload: Record<string, unknown> = {
          contentId,
          socialAccountId: wpAccount.id,
          status: isScheduled ? "future" : "publish",
        };
        if (siteCategories.length > 0) wpPayload.categories = siteCategories;
        if (isScheduled && scheduledDate) wpPayload.scheduledAt = scheduledDate;

        try {
          const wpRes = await fetch("/api/publish/wordpress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(wpPayload),
          });

          if (wpRes.ok) {
            const wpData = await wpRes.json();
            publishResults.push({
              socialAccountId: wpAccount.id,
              platform: "WORDPRESS",
              accountName: wpAccount.accountName,
              status: "SUCCESS",
              platformPostUrl: wpData.postUrl,
            });
          } else {
            const wpErr = await wpRes.json();
            publishResults.push({
              socialAccountId: wpAccount.id,
              platform: "WORDPRESS",
              accountName: wpAccount.accountName,
              status: "FAILED",
              errorMessage: wpErr.error ?? "WordPress 배포 실패",
            });
          }
        } catch {
          publishResults.push({
            socialAccountId: wpAccount.id,
            platform: "WORDPRESS",
            accountName: wpAccount.accountName,
            status: "FAILED",
            errorMessage: "네트워크 오류",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg !bg-white !border-gray-200 !text-gray-900" style={{ background: "#fff", border: "1.5px solid #E5E7EB", color: "#111827" }}>
        <DialogHeader>
          <DialogTitle style={{ color: "#111827" }}>콘텐츠 배포</DialogTitle>
          <DialogDescription style={{ color: "#6B7280" }}>
            &ldquo;{contentTitle}&rdquo;을(를) 배포할 채널을 선택하세요
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <div className="space-y-4">
            <h4 className="font-medium" style={{ color: "#111827" }}>배포 결과</h4>
            {results.map((result, idx) => {
              const config = platformConfig[result.platform];
              if (!config) return null;
              const Icon = config.icon;

              return (
                <div key={`${result.socialAccountId}-${idx}`} className="flex items-center justify-between p-3 rounded-lg" style={{ border: "1.5px solid #E5E7EB", background: "#FAFAFA" }}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${config.color}`} style={{ background: "#F3F4F6" }}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm" style={{ color: "#111827" }}>{config.name}</p>
                      <p className="text-xs" style={{ color: "#6B7280" }}>{result.accountName}</p>
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
                style={{ accentColor: "var(--brand-500)" }}
              />
              <Label htmlFor="schedule" className="cursor-pointer" style={{ color: "#374151", fontWeight: 600 }}>
                예약 배포
              </Label>
            </div>

            {isScheduled && (
              <div className="mb-4">
                <Label htmlFor="scheduledDate" style={{ color: "#374151", fontWeight: 600 }}>예약 날짜/시간</Label>
                <Input
                  id="scheduledDate"
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="mt-1"
                  style={{ background: "#fff", border: "1.5px solid #E5E7EB", color: "#111827" }}
                />
              </div>
            )}

            {/* Account List */}
            <div className="space-y-4 max-h-64 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#9CA3AF" }} />
                </div>
              ) : accounts.length === 0 ? (
                <div className="text-center py-8" style={{ color: "#9CA3AF" }}>
                  연동된 계정이 없습니다
                </div>
              ) : (
                Object.entries(groupedAccounts).map(([platform, platformAccounts]) => {
                  const config = platformConfig[platform];
                  if (!config) return null;
                  const Icon = config.icon;
                  const isMultiPlatform = platform === "WORDPRESS" && platformAccounts.length > 1;

                  return (
                    <div key={platform} className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "#6B7280" }}>
                        <Icon className="h-4 w-4" />
                        {config.name}
                        {isMultiPlatform && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "#EFF6FF", color: "#3B82F6" }}>
                            {platformAccounts.length}개 사이트
                          </span>
                        )}
                      </div>
                      {platformAccounts.map((account) => (
                        <label
                          key={account.id}
                          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors`}
                          style={{
                            border: selectedIds.includes(account.id) ? "1.5px solid var(--brand-500)" : "1.5px solid #E5E7EB",
                            background: selectedIds.includes(account.id) ? "#F0F4FF" : "#fff",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(account.id)}
                            onChange={() => toggleAccount(account.id)}
                            className="rounded"
                            style={{ accentColor: "var(--brand-500)" }}
                          />
                          <span className="text-sm" style={{ color: "#111827", fontWeight: 600 }}>{account.accountName}</span>
                        </label>
                      ))}
                    </div>
                  );
                })
              )}
            </div>

            {/* WordPress 카테고리 선택 — 사이트별 탭 */}
            {showCategories && selectedWpAccounts.length > 0 && (
              <div className="mt-4 rounded-lg overflow-hidden" style={{ border: "1.5px solid #E5E7EB" }}>
                <button
                  type="button"
                  onClick={() => setShowCategories(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors"
                  style={{ background: "#F9FAFB", color: "#374151" }}
                >
                  <span className="flex items-center gap-2">
                    <Tag className="h-4 w-4" style={{ color: "#6B7280" }} />
                    WordPress 카테고리
                    {Object.values(selectedCategoriesMap).flat().length > 0 && (
                      <span className="text-white text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--brand-500)" }}>
                        {Object.values(selectedCategoriesMap).flat().length}
                      </span>
                    )}
                  </span>
                  {showCategories ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showCategories && (
                  <div style={{ borderTop: "1px solid #E5E7EB" }}>
                    {/* 사이트 탭 (2개 이상일 때만 표시) */}
                    {selectedWpAccounts.length > 1 && (
                      <div className="flex" style={{ borderBottom: "1px solid #E5E7EB", background: "#F9FAFB" }}>
                        {selectedWpAccounts.map(wpAcc => (
                          <button
                            key={wpAcc.id}
                            type="button"
                            onClick={() => setActiveCategoryTab(wpAcc.id)}
                            className="flex-1 px-3 py-2 text-xs font-semibold transition-colors relative"
                            style={{
                              color: activeCategoryTab === wpAcc.id ? "var(--brand-500)" : "#9CA3AF",
                              background: activeCategoryTab === wpAcc.id ? "#fff" : "transparent",
                            }}
                          >
                            {wpAcc.accountName}
                            {(selectedCategoriesMap[wpAcc.id]?.length ?? 0) > 0 && (
                              <span className="ml-1 text-white text-[10px] font-bold w-4 h-4 rounded-full inline-flex items-center justify-center" style={{ background: "var(--brand-500)" }}>
                                {selectedCategoriesMap[wpAcc.id]?.length}
                              </span>
                            )}
                            {activeCategoryTab === wpAcc.id && (
                              <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "var(--brand-500)" }} />
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* 카테고리 목록 */}
                    {activeCategoryTab && (
                      <div className="p-3 max-h-48 overflow-y-auto">
                        {loadingCategoriesMap[activeCategoryTab] ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#9CA3AF" }} />
                            <span className="ml-2 text-sm" style={{ color: "#9CA3AF" }}>카테고리 불러오는 중...</span>
                          </div>
                        ) : (wpCategoriesMap[activeCategoryTab] ?? []).length === 0 ? (
                          <p className="text-sm text-center py-3" style={{ color: "#9CA3AF" }}>
                            카테고리가 없습니다. (선택하지 않으면 미분류로 배포됩니다)
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {(wpCategoriesMap[activeCategoryTab] ?? []).map(cat => (
                              <label
                                key={cat.id}
                                className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors"
                                style={{
                                  background: (selectedCategoriesMap[activeCategoryTab] ?? []).includes(cat.id) ? "#EEF2FF" : "transparent",
                                  color: (selectedCategoriesMap[activeCategoryTab] ?? []).includes(cat.id) ? "var(--brand-500)" : "#374151",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={(selectedCategoriesMap[activeCategoryTab] ?? []).includes(cat.id)}
                                  onChange={() => toggleCategory(activeCategoryTab, cat.id)}
                                  className="rounded"
                                  style={{ accentColor: "var(--brand-500)" }}
                                />
                                <span className="text-sm flex-1">{cat.name}</span>
                                <span className="text-xs" style={{ color: "#9CA3AF" }}>({cat.count})</span>
                              </label>
                            ))}
                          </div>
                        )}
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
