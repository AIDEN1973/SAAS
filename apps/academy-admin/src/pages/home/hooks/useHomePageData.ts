/**
 * HomePage 데이터 오케스트레이터 훅
 *
 * [LAYER: UI_PAGE]
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdaptiveNavigation } from '@hooks/use-adaptive-navigation';
import { useDailyStoreMetrics } from '@hooks/use-daily-store-metrics';
import { toKST } from '@lib/date-utils';
import { createSafeNavigate } from '../../../utils';
import { useEmergencyCards } from './useEmergencyCards';
import { useAiBriefingCards } from './useAiBriefingCards';
import { useBillingSummary } from './useBillingSummary';
import { useTodayClasses } from './useTodayClasses';
import { useStatsCards } from './useStatsCards';
import { useCardAssembly } from './useCardAssembly';
import type { CardGroup } from './useCardAssembly';

const DASHBOARD_PERIODS = {
  DAILY_METRICS_DAYS: 30,
} as const;

export function useHomePageData(tenantId: string) {
  const navigate = useNavigate();

  const safeNavigate = useMemo(
    () => createSafeNavigate(navigate),
    [navigate]
  );

  const isSafeInternalTarget = (raw: string): boolean => {
    if (!raw || typeof raw !== 'string' || raw.trim().length === 0) return false;
    let decoded: string;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      return false;
    }
    if (!decoded.startsWith('/')) return false;
    if (decoded.startsWith('//')) return false;
    if (decoded.includes('://')) return false;
    const lowerDecoded = decoded.toLowerCase();
    if (lowerDecoded.includes('javascript:') || lowerDecoded.includes('data:') ||
        lowerDecoded.includes('vbscript:') || lowerDecoded.includes('file:') ||
        lowerDecoded.includes('about:')) return false;
    if (decoded.includes('\\')) return false;
    return true;
  };

  // 그래프 모달 상태
  const [chartModalOpen, setChartModalOpen] = useState<{ cardId: string | null }>({ cardId: null });

  // 최근 30일 일별 메트릭
  const nowKST = useMemo(() => toKST(), []);
  const dailyMetricsRange = useMemo(() => {
    const thirtyDaysAgo = nowKST.clone().subtract(DASHBOARD_PERIODS.DAILY_METRICS_DAYS, 'day').format('YYYY-MM-DD');
    const today = nowKST.format('YYYY-MM-DD');
    return { date_kst: { gte: thirtyDaysAgo, lte: today } };
  }, [nowKST]);
  const { data: dailyStoreMetrics } = useDailyStoreMetrics(dailyMetricsRange);

  // Context Signals
  const adaptiveNav = useAdaptiveNavigation();

  // 서브 훅 호출
  const { enhancedEmergencyCards, loadConfigOnce } = useEmergencyCards(tenantId);
  const { enhancedAiBriefingCards } = useAiBriefingCards({ tenantId, loadConfigOnce });
  const { billingSummary } = useBillingSummary(tenantId);
  const { todayClasses } = useTodayClasses();
  const { statsCards } = useStatsCards(tenantId);

  // 카드 조합
  const { sortedCards, groupedCards } = useCardAssembly({
    enhancedEmergencyCards,
    enhancedAiBriefingCards,
    todayClasses,
    statsCards,
    billingSummary,
  });

  return {
    safeNavigate,
    isSafeInternalTarget,
    chartModalOpen,
    setChartModalOpen,
    dailyStoreMetrics,
    adaptiveNav,
    sortedCards,
    groupedCards,
  };
}

export type { CardGroup };
