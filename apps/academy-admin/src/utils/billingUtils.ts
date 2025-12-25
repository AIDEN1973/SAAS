/**
 * Billing 관련 유틸리티 함수
 *
 * [불변 규칙] Billing 도메인 상태값은 이 파일에서 SSOT로 관리
 * [P0-2 수정] status 값 비교를 헬퍼 함수로 통일하여 타입 안정성 확보
 */

/**
 * 청구서/수납 상태 enum (SSOT)
 * [P0-2 수정] BillingHistoryItem.status의 실제 값과 일치하도록 정의
 * packages/hooks/use-billing/src/useBilling.ts의 BillingHistoryItem.status 타입과 동기화
 */
export const INVOICE_PAID_STATUSES = new Set<string>(['paid']);

/**
 * 청구서가 수납 완료 상태인지 확인
 * [P0-2 수정] status 값 비교를 SSOT 기반 헬퍼로 통일
 *
 * @param status 청구서 상태
 * @returns 수납 완료 여부
 */
export function isInvoicePaid(status?: string): boolean {
  return !!status && INVOICE_PAID_STATUSES.has(status);
}

