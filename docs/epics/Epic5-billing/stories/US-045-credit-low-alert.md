# US-045: 크레딧 부족 알림

> **Story ID**: US-045
> **Epic**: Epic 5: 결제
> **优先순위**: P1
> **작성일**: 2026-03-31
> **Phase**: Phase 5

---

## 개요

크레딧이 부족해지면 사용자에게 알림을 제공한다.

---

## 사용자 스토리

> **As a** 무료 티어 사용자
> **I want to** 크레딧이 부족해지면 알림을 받는다
> **So that** 업그레이드 결정 가능

---

## acceptance criteria

### 잔액 부족 안내

- [ ] 크레딧 2건 이하 시 생성 시 안내 메시지
- [ ] 0건 시 게이팅 모달 표시
- [ ] "STARTER로 업그레이드" 버튼
- [ ] "FREE 플랜 유지" 링크

### 알림 발송

- [ ] 이메일 또는 카카오톡 알림
- [ ] 사용자 알림 설정尊重

---

## 구현 참고사항

### 게이팅 모달

```typescript
// components/features/content/credit-exhausted-modal.tsx
export function CreditExhaustedModal({ isOpen, onUpgrade, onDismiss }: Props) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>크레딧이 모두 소진되었습니다</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground">
          더 많은 크레딧과 기능을 원하시면 업그레이드해주세요.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onDismiss}>
            현재 플랜 유지
          </Button>
          <Button onClick={onUpgrade}>
            STARTER로 업그레이드（₩19,900/月）
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 추정 시간

**Story Point**: 2
