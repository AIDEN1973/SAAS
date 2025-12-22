/**
 * useNotificationTemplates Hook
 *
 * React Query 기반 알림 템플릿 Hook
 * [불변 규칙] tenant 변경 시 invalidateQueries() 자동 발생
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: 'sms' | 'kakao' | 'email' | 'push';
  content: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationTemplateFilter {
  channel?: 'sms' | 'kakao' | 'email' | 'push';
  name?: string;
}

/**
 * 알림 템플릿 조회 함수 (Hook의 queryFn 로직을 재사용)
 * [불변 규칙] useQuery 내부에서도 이 함수를 사용하여 일관성 유지
 */
export async function fetchNotificationTemplates(
  tenantId: string,
  filter?: NotificationTemplateFilter
): Promise<NotificationTemplate[]> {
  if (!tenantId) return [];

  try {
    const filters: Record<string, unknown> = {};
    if (filter?.channel) {
      filters.channel = filter.channel;
    }
    if (filter?.name) {
      filters.name = filter.name;
    }

    const response = await apiClient.get<NotificationTemplate>('notification_templates', {
      filters,
      orderBy: { column: 'created_at', ascending: false },
    });

    if (response.error) {
      // 테이블이 아직 생성되지 않았을 수 있으므로 빈 배열 반환
      if (response.error.message?.includes('does not exist') || response.error.message?.includes('relation')) {
        return [];
      }
      throw new Error(response.error.message);
    }

    return (response.data || []) as NotificationTemplate[];
  } catch (error) {
    // 테이블이 없으면 빈 배열 반환
    return [];
  }
}

/**
 * 알림 템플릿 조회 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function useNotificationTemplates(filter?: NotificationTemplateFilter) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<NotificationTemplate[]>({
    queryKey: ['notification-templates', tenantId, filter],
    queryFn: () => fetchNotificationTemplates(tenantId!, filter),
    enabled: !!tenantId,
  });
}

