/**
 * useInvoiceItems Hook
 *
 * React Query 기반 청구서 항목 Hook
 * [불변 규칙] tenant 변경 시 invalidateQueries() 자동 발생
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id?: string;
  product_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItemFilter {
  invoice_id?: string;
  product_id?: string;
  created_at?: { gte?: string; lte?: string };
}

/**
 * 청구서 항목 조회 함수 (Hook의 queryFn 로직을 재사용)
 * [불변 규칙] useQuery 내부에서도 이 함수를 사용하여 일관성 유지
 */
export async function fetchInvoiceItems(
  tenantId: string,
  filter?: InvoiceItemFilter
): Promise<InvoiceItem[]> {
  if (!tenantId) return [];

  const filters: Record<string, unknown> = {};
  if (filter?.invoice_id) {
    filters.invoice_id = filter.invoice_id;
  }
  if (filter?.product_id) {
    filters.product_id = filter.product_id;
  }
  if (filter?.created_at) {
    filters.created_at = filter.created_at;
  }

  const response = await apiClient.get<InvoiceItem>('invoice_items', {
    filters,
    orderBy: { column: 'created_at', ascending: false },
    limit: 100,
  });

  if (response.error) {
    // invoice_items 테이블이 없을 수 있으므로 빈 배열 반환
    if (response.error.message?.includes('does not exist') || response.error.message?.includes('relation')) {
      return [];
    }
    throw new Error(response.error.message);
  }

  return (response.data || []) as InvoiceItem[];
}

/**
 * 청구서 항목 조회 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function useInvoiceItems(filter?: InvoiceItemFilter) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<InvoiceItem[]>({
    queryKey: ['invoice-items', tenantId, filter],
    queryFn: () => fetchInvoiceItems(tenantId!, filter),
    enabled: !!tenantId,
  });
}

