"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CreditExhaustedModalProps {
  isOpen: boolean;
  onUpgrade: () => void;
  onDismiss: () => void;
}

export function CreditExhaustedModal({
  isOpen,
  onUpgrade,
  onDismiss,
}: CreditExhaustedModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onDismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <DialogTitle>크레딧이 모두 소진되었습니다</DialogTitle>
          </div>
          <DialogDescription>
            더 많은 크레딧과 기능을 원하시면 업그레이드해주세요.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">현재 플랜</span>
              <span className="font-medium">FREE</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">사용 가능 크레딧</span>
              <span className="font-medium text-destructive">0건</span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">STARTER 플랜으로 업그레이드하면:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• 월 50개 크레딧</li>
              <li>• 모든 SNS 연동</li>
              <li>• 우선 지원</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onDismiss} className="w-full sm:w-auto">
            현재 플랜 유지
          </Button>
          <Button onClick={onUpgrade} className="w-full sm:w-auto">
            STARTER로 업그레이드 (₩199,000/월)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
