/**
 * useDailyRegionMetrics Hook
 *
 * React Query 기반 지역 일일 통계 Hook
 * [불변 규칙] tenant 변경 시 invalidateQueries() 자동 발생
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';

export interface DailyRegionMetric {
  id: string;
  industry_type: string;
  region_level: 'dong' | 'gu_gun' | 'si' | 'zone' | 'nation';
  region_code: string;
  date_kst: string;
  store_count?: number;
  active_members_avg?: number | string;
  active_members_median?: number | string;
  active_members_p25?: number | string;
  active_members_p75?: number | string;
  revenue_avg?: number | string;
  revenue_median?: number | string;
  revenue_p25?: number | string;
  revenue_p75?: number | string;
  avg_attendance_rate?: number | string;
  attendance_rate_p25?: number | string;
  attendance_rate_p75?: number | string;
  student_growth_rate_avg?: number | string;
  student_growth_rate_p25?: number | string;
  student_growth_rate_p75?: number | string;
  revenue_growth_rate_avg?: number | string;
  revenue_growth_rate_p25?: number | string;
  revenue_growth_rate_p75?: number | string;
  created_at: string;
  updated_at: string;
}

export interface DailyRegionMetricFilter {
  industry_type?: string;
  region_level?: 'dong' | 'gu_gun' | 'si' | 'zone' | 'nation';
  region_code?: string;
  date_kst?: { gte?: string; lte?: string };
}

/**
 * 지역 일일 통계 조회 함수 (Hook의 queryFn 로직을 재사용)
 * [불변 규칙] useQuery 내부에서도 이 함수를 사용하여 일관성 유지
 */
export async function fetchDailyRegionMetrics(
  tenantId: string,
  filter?: DailyRegionMetricFilter
): Promise<DailyRegionMetric[]> {
  if (!tenantId) return [];

  try {
    const filters: Record<string, unknown> = {};
    if (filter?.industry_type) {
      filters.industry_type = filter.industry_type;
    }
    if (filter?.region_level) {
      filters.region_level = filter.region_level;
    }
    if (filter?.region_code) {
      filters.region_code = filter.region_code;
    }
    if (filter?.date_kst) {
      filters.date_kst = filter.date_kst;
    }

    const response = await apiClient.get<DailyRegionMetric>('daily_region_metrics', {
      filters,
      orderBy: { column: 'date_kst', ascending: false },
      limit: 100,
    });

    if (response.error) {
      // 에러는 무시하고 빈 배열 반환 (fallback 처리)
      return [];
    }

    return (response.data || []) as DailyRegionMetric[];
  } catch (error) {
    // 에러는 무시하고 빈 배열 반환 (fallback 처리)
    return [];
  }
}

/**
 * 지역 일일 통계 조회 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function useDailyRegionMetrics(filter?: DailyRegionMetricFilter) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<DailyRegionMetric[]>({
    queryKey: ['daily-region-metrics', tenantId, filter],
    queryFn: () => fetchDailyRegionMetrics(tenantId!, filter),
    enabled: !!tenantId,
  });
}

