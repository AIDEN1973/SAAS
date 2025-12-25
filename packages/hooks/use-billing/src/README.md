# useBilling Hook

## fetchBillingHistory 반환 규약

**SSOT (Single Source of Truth)**: `fetchBillingHistory`는 **항상 배열을 반환**합니다.

- 성공 시: `Promise<BillingHistoryItem[]>` (빈 배열 가능)
- 에러 시: `throw new Error(...)` (예외 발생)
- `response.data`가 없거나 null인 경우: `[]` (빈 배열 반환)

**주의사항**:
- `fetchBillingHistory` 반환값은 항상 배열이므로 `Array.isArray()` 체크는 선택적입니다.
- 하지만 방어적 프로그래밍을 위해 `Array.isArray()` 체크를 권장합니다.

## BillingHistoryItem.status 값

**SSOT (Single Source of Truth)**: `status`는 다음 유니온 타입을 가집니다.

- `'pending' | 'paid' | 'overdue' | 'cancelled'`

**수납 완료 상태 확인**:
- `status === 'paid'`로 확인 (다른 값은 수납 미완료)
- 프론트에서는 `@utils/billingUtils.isInvoicePaid()` 헬퍼 함수 사용 권장

