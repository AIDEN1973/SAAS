/**
 * useDailyStoreMetrics Hook
 *
 * React Query 기반 매장 일일 통계 Hook
 * [불변 규칙] tenant 변경 시 invalidateQueries() 자동 발생
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';

export interface DailyStoreMetric {
  id: string;
  tenant_id: string;
  store_id?: string | null;
  student_count: number;
  revenue: number;
  attendance_rate: number;
  new_enrollments: number;
  late_rate: number;
  absent_rate: number;
  active_student_count: number;
  inactive_student_count: number;
  avg_students_per_class: number;
  avg_capacity_rate: number;
  arpu: number;
  date_kst: string;
  created_at: string;
  updated_at: string;
}

export interface DailyStoreMetricFilter {
  date_kst?: { gte?: string; lte?: string };
}

/**
 * 매장 일일 통계 조회 함수 (Hook의 queryFn 로직을 재사용)
 * [불변 규칙] useQuery 내부에서도 이 함수를 사용하여 일관성 유지
 */
export async function fetchDailyStoreMetrics(
  tenantId: string,
  filter?: DailyStoreMetricFilter
): Promise<DailyStoreMetric[]> {
  if (!tenantId) return [];

  try {
    const filters: Record<string, unknown> = {
      tenant_id: tenantId,
    };
    if (filter?.date_kst) {
      filters.date_kst = filter.date_kst;
    }

    const response = await apiClient.get<DailyStoreMetric>('daily_store_metrics', {
      filters,
      orderBy: { column: 'date_kst', ascending: true },
      limit: 100,
    });

    if (response.error) {
      // 에러는 무시하고 빈 배열 반환 (fallback 처리)
      return [];
    }

    return (response.data || []) as DailyStoreMetric[];
  } catch (error) {
    // 에러는 무시하고 빈 배열 반환 (fallback 처리)
    return [];
  }
}

/**
 * 매장 일일 통계 조회 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function useDailyStoreMetrics(filter?: DailyStoreMetricFilter) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<DailyStoreMetric[]>({
    queryKey: ['daily-store-metrics', tenantId, filter],
    queryFn: () => fetchDailyStoreMetrics(tenantId!, filter),
    enabled: !!tenantId,
  });
}

