/**
 * usePayments Hook
 *
 * React Query 기반 결제 내역 Hook
 * [불변 규칙] tenant 변경 시 invalidateQueries() 자동 발생
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';

export interface Payment {
  id: string;
  invoice_id?: string;
  student_id?: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  payment_method?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentFilter {
  status?: 'pending' | 'completed' | 'failed' | 'cancelled';
  student_id?: string;
  invoice_id?: string;
  created_at?: { gte?: string; lte?: string };
}

/**
 * 결제 내역 조회 함수 (Hook의 queryFn 로직을 재사용)
 * [불변 규칙] useQuery 내부에서도 이 함수를 사용하여 일관성 유지
 */
export async function fetchPayments(
  tenantId: string,
  filter?: PaymentFilter
): Promise<Payment[]> {
  if (!tenantId) return [];

  const filters: Record<string, unknown> = {};
  if (filter?.status) {
    filters.status = filter.status;
  }
  if (filter?.student_id) {
    filters.student_id = filter.student_id;
  }
  if (filter?.invoice_id) {
    filters.invoice_id = filter.invoice_id;
  }
  if (filter?.created_at) {
    filters.created_at = filter.created_at;
  }

  const response = await apiClient.get<Payment>('payments', {
    filters,
    orderBy: { column: 'created_at', ascending: false },
    limit: 100,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return (response.data || []) as Payment[];
}

/**
 * 결제 내역 조회 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function usePayments(filter?: PaymentFilter) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<Payment[]>({
    queryKey: ['payments', tenantId, filter],
    queryFn: () => fetchPayments(tenantId!, filter),
    enabled: !!tenantId,
  });
}

