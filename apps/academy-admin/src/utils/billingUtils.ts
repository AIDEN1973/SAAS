/**
 * Billing 관련 유틸리티 함수
 *
 * [불변 규칙] Billing 도메인 상태값은 이 파일에서 SSOT로 관리
 * [P0-2 수정] status 값 비교를 헬퍼 함수로 통일하여 타입 안정성 확보
 */

/**
 * 청구서/수납 상태 정의 (SSOT)
 * [불변 규칙] 모든 상태값은 이 객체에서 정의
 * packages/hooks/use-billing/src/useBilling.ts의 BillingHistoryItem.status 타입과 동기화
 */
export const INVOICE_STATUSES = {
  DRAFT: 'draft',
  PENDING: 'pending',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
} as const;

/**
 * InvoiceStatus 타입 (SSOT)
 */
export type InvoiceStatus = typeof INVOICE_STATUSES[keyof typeof INVOICE_STATUSES];

/**
 * 청구서 상태 라벨 (SSOT)
 * [불변 규칙] UI 표시용 라벨은 이 객체에서 관리
 */
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: '초안',
  pending: '대기',
  paid: '결제완료',
  overdue: '연체',
  cancelled: '취소',
};

/**
 * 청구서 상태 색상 (SSOT)
 * [불변 규칙] UI 색상은 이 객체에서 관리
 */
export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'gray',
  pending: 'warning',
  paid: 'success',
  overdue: 'error',
  cancelled: 'gray',
};

/**
 * 수납 완료 상태 Set (SSOT)
 */
export const INVOICE_PAID_STATUSES = new Set<InvoiceStatus>([INVOICE_STATUSES.PAID]);

/**
 * 청구서가 수납 완료 상태인지 확인
 * [P0-2 수정] status 값 비교를 SSOT 기반 헬퍼로 통일
 *
 * @param status 청구서 상태
 * @returns 수납 완료 여부
 */
export function isInvoicePaid(status?: string): boolean {
  return !!status && INVOICE_PAID_STATUSES.has(status as InvoiceStatus);
}

