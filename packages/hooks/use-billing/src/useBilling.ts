/**
 * useBilling Hook
 *
 * React Query 기반 결제/청구 Hook
 * [불변 규칙] tenant 변경 시 invalidateQueries() 자동 발생
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import { useSession } from '@hooks/use-auth';
import { createExecutionAuditRecord } from '@hooks/use-student/src/execution-audit-utils';

export interface BillingHistoryItem {
  id: string;
  student_id: string;
  student_name?: string;
  title?: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  period_start: string;
  period_end: string;
  created_at: string;
  updated_at: string;
}

export interface Invoice extends BillingHistoryItem {}

export interface BillingHistoryFilter {
  student_id?: string;
  period_start?: { gte?: string; lte?: string };
  status?: 'pending' | 'paid' | 'overdue' | 'cancelled';
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  receiptUrl?: string;
  error?: string;
}

export interface PaymentInput {
  invoiceId: string;
  paymentMethod: 'card' | 'account' | 'simple';
  amount: number;
  cardInfo?: {
    number: string;
    expiry: string;
    cvc: string;
    password: string;
  };
}

/**
 * 결제 내역 조회 함수 (Hook의 queryFn 로직을 재사용)
 * [불변 규칙] useQuery 내부에서도 이 함수를 사용하여 일관성 유지
 */
export async function fetchBillingHistory(
  tenantId: string,
  filter?: BillingHistoryFilter
): Promise<BillingHistoryItem[]> {
  // TODO: 실제 API 엔드포인트로 교체 필요
  // 현재는 invoices 테이블에서 조회한다고 가정
  // RLS 정책에 의해 현재 사용자의 자녀에 대한 청구서만 조회됨
  const filters: Record<string, unknown> = {};
  if (filter?.student_id) {
    filters.student_id = filter.student_id;
  }
  if (filter?.period_start) {
    filters.period_start = filter.period_start;
  }
  if (filter?.status) {
    filters.status = filter.status;
  }

  const response = await apiClient.get<BillingHistoryItem>('invoices', {
    filters,
    orderBy: { column: 'created_at', ascending: false },
    limit: 100,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return (response.data || []) as BillingHistoryItem[];
}

/**
 * 결제 내역 조회 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 * 학부모는 자신의 자녀에 대한 청구서만 조회 가능 (RLS 정책)
 */
export function useBillingHistory(filter?: BillingHistoryFilter) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<BillingHistoryItem[]>({
    queryKey: ['billing-history', tenantId, filter],
    queryFn: () => fetchBillingHistory(tenantId!, filter),
    enabled: !!tenantId,
  });
}

/**
 * 청구서 조회 Hook (단일)
 */
export function useInvoice(invoiceId?: string) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<Invoice[]>({
    queryKey: ['invoice', tenantId, invoiceId],
    queryFn: async (): Promise<Invoice[]> => {
      if (!invoiceId) return [];

      // TODO: 실제 API 엔드포인트로 교체 필요
      const response = await apiClient.get<Invoice>(`invoices/${invoiceId}`);

      if (response.error) {
        throw new Error(response.error.message);
      }

      return (response.data || []) as Invoice[];
    },
    enabled: !!tenantId && !!invoiceId,
  });
}

/**
 * 결제 처리 Hook
 */
export function useProcessPayment() {
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (input: PaymentInput): Promise<PaymentResult> => {
      const startTime = Date.now();
      // TODO: 실제 API 엔드포인트로 교체 필요
      // Edge Function: fns-payment-process 호출
      const response = await apiClient.post<PaymentResult>(
        'functions/v1/fns-payment-process',
        input as unknown as Record<string, unknown>
      );

      // Execution Audit 기록 생성 (액티비티.md 3.2, 3.3, 12 참조)
      if (session?.user?.id && tenantId) {
        const durationMs = Date.now() - startTime;
        const status: 'success' | 'failed' = response.error ? 'failed' : (response.data?.success ? 'success' : 'failed');

        await createExecutionAuditRecord(
          {
            operation_type: 'payment.process',
            status: status,
            summary: `결제 처리 ${status === 'success' ? '완료' : '실패'} (${input.paymentMethod}, ${input.amount}원)`,
            details: {
              invoice_id: input.invoiceId,
              payment_method: input.paymentMethod,
              amount: input.amount,
            },
            reference: {
              entity_type: 'invoice',
              entity_id: input.invoiceId,
            },
            duration_ms: durationMs,
            ...(response.error && {
              error_code: 'PAYMENT_FAILED',
              error_summary: response.error.message,
            }),
          },
          session.user.id
        );
      }

      if (response.error) {
        return { success: false, error: response.error.message };
      }

      return response.data || { success: false, error: '알 수 없는 오류' };
    },
  });
}
