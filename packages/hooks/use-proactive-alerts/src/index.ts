import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';

export interface ProactiveAlert {
  id: string;
  tenant_id: string;
  trigger_id: string;
  trigger_type: 'filter_tag_spike' | 'billing_overdue_spike' | 'attendance_drop' | 'churn_risk_increase';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  recommended_actions: Array<{
    action: string;
    label: string;
    params: Record<string, unknown>;
  }>;
  detected_data: Record<string, unknown>;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
  read_at: string | null;
  dismissed_at: string | null;
}

export interface ProactiveAlertTrigger {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  trigger_type: 'filter_tag_spike' | 'billing_overdue_spike' | 'attendance_drop' | 'churn_risk_increase';
  config: Record<string, unknown>;
  is_active: boolean;
  last_triggered_at: string | null;
  last_check_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 선제적 알림 목록 조회 훅
 *
 * @example
 * ```tsx
 * const { data: alerts, isLoading } = useProactiveAlerts({ onlyUnread: true });
 * ```
 */
export function useProactiveAlerts(options?: { onlyUnread?: boolean }) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['proactive-alerts', tenantId, options?.onlyUnread],
    queryFn: async () => {
      const filters: Record<string, unknown> = {};

      if (options?.onlyUnread) {
        filters.is_read = false;
        filters.is_dismissed = false;
      }

      const response = await apiClient.get('proactive_alerts', {
        filters,
        orderBy: { column: 'created_at', ascending: false },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return (response.data || []) as ProactiveAlert[];
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60, // 1분
  });
}

/**
 * 선제적 알림 읽음 처리 훅
 *
 * @example
 * ```tsx
 * const { mutate: markAsRead } = useMarkAlertAsRead();
 * markAsRead(alertId);
 * ```
 */
export function useMarkAlertAsRead() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiClient.patch('proactive_alerts', alertId, {
        is_read: true,
        read_at: new Date().toISOString(),
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proactive-alerts', tenantId] });
    },
  });
}

/**
 * 선제적 알림 무시 처리 훅
 *
 * @example
 * ```tsx
 * const { mutate: dismissAlert } = useDismissAlert();
 * dismissAlert(alertId);
 * ```
 */
export function useDismissAlert() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiClient.patch('proactive_alerts', alertId, {
        is_dismissed: true,
        dismissed_at: new Date().toISOString(),
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proactive-alerts', tenantId] });
    },
  });
}

/**
 * 선제적 알림 트리거 목록 조회 훅
 *
 * @example
 * ```tsx
 * const { data: triggers, isLoading } = useProactiveAlertTriggers();
 * ```
 */
export function useProactiveAlertTriggers() {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['proactive-alert-triggers', tenantId],
    queryFn: async () => {
      const response = await apiClient.get('proactive_alert_triggers', {
        orderBy: { column: 'created_at', ascending: false },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return (response.data || []) as ProactiveAlertTrigger[];
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5, // 5분
  });
}

/**
 * 선제적 알림 트리거 생성 훅
 *
 * @example
 * ```tsx
 * const { mutate: createTrigger } = useCreateProactiveAlertTrigger();
 * createTrigger({
 *   name: '필터 태그 급증 감지',
 *   trigger_type: 'filter_tag_spike',
 *   config: { tag_ids: ['tag-uuid'], threshold_percent: 50, period_days: 7, min_change: 3 }
 * });
 * ```
 */
export function useCreateProactiveAlertTrigger() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async (data: Partial<ProactiveAlertTrigger>) => {
      const response = await apiClient.post('proactive_alert_triggers', data);

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proactive-alert-triggers', tenantId] });
    },
  });
}

/**
 * 선제적 알림 트리거 수정 훅
 *
 * @example
 * ```tsx
 * const { mutate: updateTrigger } = useUpdateProactiveAlertTrigger();
 * updateTrigger({ id: 'trigger-uuid', config: { threshold_percent: 60 } });
 * ```
 */
export function useUpdateProactiveAlertTrigger() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ProactiveAlertTrigger> & { id: string }) => {
      const response = await apiClient.patch('proactive_alert_triggers', id, data);

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proactive-alert-triggers', tenantId] });
    },
  });
}

/**
 * 선제적 알림 트리거 삭제 훅
 *
 * @example
 * ```tsx
 * const { mutate: deleteTrigger } = useDeleteProactiveAlertTrigger();
 * deleteTrigger('trigger-uuid');
 * ```
 */
export function useDeleteProactiveAlertTrigger() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async (triggerId: string) => {
      const response = await apiClient.delete('proactive_alert_triggers', triggerId);

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proactive-alert-triggers', tenantId] });
    },
  });
}
