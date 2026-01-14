/**
 * useAIInsights Hook
 *
 * React Query 기반 AI 인사이트 Hook
 * [불변 규칙] tenant 변경 시 invalidateQueries() 자동 발생
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';

export interface AIInsight {
  id: string;
  tenant_id: string;
  student_id?: string;
  insight_type: 'weekly_briefing' | 'daily_briefing' | 'attendance_anomaly' | 'performance_analysis' | 'regional_comparison' | 'regional_analytics' | 'risk_analysis';
  title: string;
  summary: string;
  insights?: string | string[];
  details?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  related_entity_type?: string;
  related_entity_id?: string;
  status: 'active' | 'archived' | 'dismissed';
  action_url?: string;
  created_at: string;
  updated_at: string;
}

export interface AIInsightFilter {
  insight_type?: 'weekly_briefing' | 'daily_briefing' | 'attendance_anomaly' | 'performance_analysis' | 'regional_comparison' | 'regional_analytics' | 'risk_analysis';
  status?: 'active' | 'archived' | 'dismissed';
  student_id?: string;
  related_entity_id?: string;
  created_at?: { gte?: string; lte?: string };
}

/**
 * AI 인사이트 조회 함수 (Hook의 queryFn 로직을 재사용)
 * [불변 규칙] useQuery 내부에서도 이 함수를 사용하여 일관성 유지
 */
export async function fetchAIInsights(
  tenantId: string,
  filter?: AIInsightFilter
): Promise<AIInsight[]> {
  if (!tenantId) return [];

  const filters: Record<string, unknown> = {};
  if (filter?.insight_type) {
    filters.insight_type = filter.insight_type;
  }
  if (filter?.status) {
    filters.status = filter.status;
  }
  if (filter?.student_id) {
    filters.student_id = filter.student_id;
  }
  if (filter?.related_entity_id) {
    filters.related_entity_id = filter.related_entity_id;
  }
  if (filter?.created_at) {
    filters.created_at = filter.created_at;
  }

  const response = await apiClient.get<AIInsight>('ai_insights', {
    filters,
    orderBy: { column: 'created_at', ascending: false },
    limit: 100,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return (response.data || []) as AIInsight[];
}

/**
 * AI 인사이트 조회 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function useAIInsights(filter?: AIInsightFilter) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<AIInsight[]>({
    queryKey: ['ai-insights', tenantId, filter],
    queryFn: () => fetchAIInsights(tenantId!, filter),
    enabled: !!tenantId,
  });
}

/**
 * AI 인사이트 Dismiss Hook
 * P2-2: AI Dismiss 기능 구현
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 * [불변 규칙] Mutation 성공 시 자동으로 쿼리 무효화하여 UI 갱신
 */
export function useDismissAIInsight() {
  const context = getApiContext();
  const tenantId = context.tenantId;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (insightId: string) => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // AI 인사이트를 dismissed 상태로 업데이트
      const response = await apiClient.patch<AIInsight>('ai_insights', insightId, {
        status: 'dismissed',
        updated_at: new Date().toISOString(),
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    },
    onSuccess: () => {
      // 모든 AI 인사이트 쿼리 무효화하여 UI 자동 갱신
      queryClient.invalidateQueries({ queryKey: ['ai-insights', tenantId] });
    },
  });
}

