/**
 * Emergency Cards 쿼리 훅
 *
 * [LAYER: UI_PAGE]
 */

import { useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@api-sdk/core';
import { useStudentTaskCards, fetchStudentAlerts } from '@hooks/use-student';
import { fetchPayments } from '@hooks/use-payments';
import { useTenantSettingByPath } from '@hooks/use-config';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { createQueryKey } from '@hooks/use-query-key-utils';
import type { DashboardCard, EmergencyCard } from '../../../types/dashboardCard';
import { getBaseKST } from '../../../utils/date-range-utils';
import {
  getPolicyValue,
  getPolicyValueWithPath,
  normalizeEmergencyCard,
  normalizeDashboardCards,
  logError,
  POLICY_REGISTRY,
  p,
} from '../../../utils';
import { ROUTES } from '../../../constants';

const CACHE_TIMES = {
  TENANT_CONFIG_STALE: 5 * 60 * 1000,
  TENANT_CONFIG_GC: 10 * 60 * 1000,
  EMERGENCY_REFETCH: 60 * 1000,
  EMERGENCY_STALE: 30 * 1000,
  EMERGENCY_GC: 5 * 60 * 1000,
} as const;

type TenantSettingRow = { key: string; value: unknown };

function asObjectArray<T extends { id: string }>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is T =>
    !!v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    'id' in v &&
    typeof (v as { id?: unknown }).id === 'string'
  );
}

export function useEmergencyCards(tenantId: string) {
  const terms = useIndustryTerms();
  const queryClient = useQueryClient();
  const { data: studentTaskCards } = useStudentTaskCards();

  const tenantConfigQueryKey = useMemo(
    () => createQueryKey('tenant-config', tenantId),
    [tenantId]
  );

  const fetchTenantConfig = useCallback(async (): Promise<Record<string, unknown> | null> => {
    if (!tenantId) return null;
    try {
      const response = await apiClient.get<TenantSettingRow>('tenant_settings', {
        filters: { key: 'config' },
      });
      if (response.error) return null;
      if (!Array.isArray(response.data)) return null;
      const rows: TenantSettingRow[] = response.data;
      if (rows.length === 0) return null;
      const configRecord = rows.find((item) => item.key === 'config');
      if (!configRecord || !configRecord.value) return null;
      const raw = configRecord.value;
      if (typeof raw === 'string') {
        try {
          const parsed: unknown = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
          }
          logError('useEmergencyCards:TenantConfig:InvalidParsedType', new Error(`Expected object, got ${typeof parsed}`));
          return null;
        } catch (error) {
          logError('useEmergencyCards:TenantConfig:JSONParse', error);
          return null;
        }
      }
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        return raw as Record<string, unknown>;
      }
      return null;
    } catch (error) {
      logError('useEmergencyCards:TenantConfig:Fetch', error);
      return null;
    }
  }, [tenantId]);

  const { data: config } = useQuery({
    queryKey: tenantConfigQueryKey,
    queryFn: fetchTenantConfig,
    enabled: !!tenantId,
    staleTime: CACHE_TIMES.TENANT_CONFIG_STALE,
    gcTime: CACHE_TIMES.TENANT_CONFIG_GC,
  });

  const loadConfigOnce = useCallback(async (): Promise<Record<string, unknown> | null> => {
    if (!tenantId) return null;
    return queryClient.fetchQuery({
      queryKey: tenantConfigQueryKey,
      queryFn: fetchTenantConfig,
      staleTime: CACHE_TIMES.TENANT_CONFIG_STALE,
    });
  }, [tenantId, queryClient, tenantConfigQueryKey, fetchTenantConfig]);

  const { data: emergencyCards } = useQuery({
    queryKey: createQueryKey('emergency-cards', tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      const cards: EmergencyCard[] = [];
      const config = await loadConfigOnce();
      if (!config) return cards;
      const baseKST = getBaseKST();

      // 1. 결제 실패 임계값
      const paymentFailedThreshold = getPolicyValue<number>('PAYMENT_FAILED_THRESHOLD', config);
      const lookbackDays = getPolicyValue<number>('PAYMENT_FAILED_LOOKBACK_DAYS', config);
      try {
        if (paymentFailedThreshold !== null && lookbackDays !== null) {
          const fromISO = baseKST.clone().subtract(lookbackDays, 'day').startOf('day').toISOString();
          const toISO = baseKST.clone().endOf('day').toISOString();
          const failedPayments = await fetchPayments(tenantId, {
            status: 'failed',
            created_at: { gte: fromISO, lte: toISO },
          });
          const failedPaymentsSafe = Array.isArray(failedPayments) ? failedPayments : [];
          if (failedPaymentsSafe.length > 0) {
            const failedCount = failedPaymentsSafe.length;
            if (failedCount >= paymentFailedThreshold) {
              cards.push(normalizeEmergencyCard({
                id: 'payment-failed-emergency',
                type: 'emergency',
                title: `${terms.PAYMENT_LABEL} 실패 알림`,
                message: `최근 ${lookbackDays}일간 ${terms.PAYMENT_LABEL} 실패가 ${failedCount}건 발생했습니다.`,
                priority: 1,
                action_url: ROUTES.BILLING_HOME,
              }));
            }
          }
        }
      } catch (error) {
        logError('useEmergencyCards:PaymentFailed', error);
      }

      // 4. 학생 알림 요약
      try {
        const studentAlerts = await fetchStudentAlerts(tenantId);
        if (studentAlerts.risk_count > 0) {
          cards.push(normalizeEmergencyCard({
            id: 'emergency-risk-students',
            type: 'emergency',
            title: `${terms.EMERGENCY_RISK_LABEL} ${terms.PERSON_LABEL_PLURAL}`,
            message: `${studentAlerts.risk_count}명의 ${terms.PERSON_LABEL_PRIMARY}${p.이가(terms.PERSON_LABEL_PRIMARY)} ${terms.EMERGENCY_RISK_LABEL}입니다.`,
            priority: 4,
            action_url: terms.ROUTES.PRIMARY_RISK,
          }));
        }
        if (studentAlerts.absent_count > 0) {
          cards.push(normalizeEmergencyCard({
            id: 'emergency-absent-students',
            type: 'emergency',
            title: `${terms.ABSENCE_LABEL} ${terms.PERSON_LABEL_PLURAL} 알림`,
            message: `${studentAlerts.absent_count}명의 ${terms.PERSON_LABEL_PRIMARY}${p.이가(terms.PERSON_LABEL_PRIMARY)} ${terms.EMERGENCY_ABSENT_LABEL}입니다.`,
            priority: 5,
            action_url: terms.ROUTES.PRIMARY_ABSENT,
          }));
        }
        if (studentAlerts.consultation_pending_count > 0) {
          cards.push(normalizeEmergencyCard({
            id: 'emergency-consultation-pending',
            type: 'emergency',
            title: `${terms.CONSULTATION_LABEL} 대기 ${terms.PERSON_LABEL_PLURAL}`,
            message: `${studentAlerts.consultation_pending_count}명의 ${terms.PERSON_LABEL_PRIMARY}${p.이가(terms.PERSON_LABEL_PRIMARY)} ${terms.EMERGENCY_CONSULTATION_PENDING_LABEL}입니다.`,
            priority: 6,
            action_url: terms.ROUTES.PRIMARY_CONSULTATION,
          }));
        }
      } catch (error) {
        logError('useEmergencyCards:StudentAlerts', error);
      }

      return cards;
    },
    enabled: !!tenantId,
    refetchInterval: CACHE_TIMES.EMERGENCY_REFETCH,
    staleTime: CACHE_TIMES.EMERGENCY_STALE,
    gcTime: CACHE_TIMES.EMERGENCY_GC,
  });

  // AI 위험 점수 임계값
  const { data: aiRiskScoreThreshold } = useTenantSettingByPath(POLICY_REGISTRY.AI_RISK_SCORE_THRESHOLD.path);
  const aiRiskScoreThresholdValue = getPolicyValueWithPath<number>('AI_RISK_SCORE_THRESHOLD', config, aiRiskScoreThreshold);

  // studentTaskCards에서 risk 카드를 파생하여 Emergency 카드에 합성
  const enhancedEmergencyCards = useMemo(() => {
    if (!emergencyCards || !studentTaskCards) return emergencyCards || [];
    if (typeof aiRiskScoreThresholdValue !== 'number') return emergencyCards;

    const safeStudentTaskCards = asObjectArray<Partial<DashboardCard> & { id: string }>(studentTaskCards);
    const normalizedTaskCards = normalizeDashboardCards(safeStudentTaskCards);
    const highRiskCard = normalizedTaskCards.find((card) => {
      if (!('task_type' in card) || card.task_type !== 'risk' || !('action_url' in card) || !card.action_url) return false;
      const score = 'priority' in card && typeof card.priority === 'number' ? card.priority : 0;
      return Number.isFinite(score) && score >= aiRiskScoreThresholdValue;
    });

    if (highRiskCard) {
      const aiRiskEmergency = normalizeEmergencyCard({
        id: 'ai-risk-emergency',
        type: 'emergency',
        title: 'AI 위험 감지',
        message: `높은 위험 점수를 가진 ${terms.PERSON_LABEL_PRIMARY}${p.이가(terms.PERSON_LABEL_PRIMARY)} 감지되었습니다.`,
        priority: 3,
        action_url: highRiskCard.action_url,
      });
      return [...emergencyCards, aiRiskEmergency];
    }

    return emergencyCards;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emergencyCards, studentTaskCards, aiRiskScoreThresholdValue]);

  return {
    enhancedEmergencyCards,
    config,
    loadConfigOnce,
  };
}
