/**
 * 수업/반 통계 카드 Hook
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 *
 * 포함 섹션:
 * - 섹션 11-13: 반당 평균 인원, 평균 정원률, 평균 수납 기간
 */

import { useQuery } from '@tanstack/react-query';
import { fetchClasses } from '@hooks/use-class';
import { fetchBillingHistory } from '@hooks/use-billing';
import type { StatsCard } from '../../../apps/academy-admin/src/types/dashboardCard';
import { normalizeStatsCard } from '../../../apps/academy-admin/src/utils/dashboard-card-normalization';
import { safe, logError } from '../../../apps/academy-admin/src/utils/error-handling-utils';
import { createQueryKey } from '@hooks/use-query-key-utils';
import type { DateRange } from '../../../apps/academy-admin/src/utils/date-range-utils';
import type { BillingHistoryItem } from '@hooks/use-billing';

// 인보이스 상태가 결제 완료 여부 확인
function isInvoicePaid(status: string): boolean {
  return status === 'paid' || status === 'completed';
}

export interface UseClassStatsCardsParams {
  tenantId: string | null;
  monthlyRange: {
    current: DateRange;
    last: DateRange;
    currentMonthStr: string;
    lastMonthStr: string;
  };
  studentCount: number;
  enabled?: boolean;
}

/**
 * 수업/반 통계 카드 조회 Hook (섹션 11-13)
 *
 * 생성 카드:
 * 1. 반당 평균 인원
 * 2. 평균 정원률
 * 3. 평균 수납 기간
 *
 * @param params.tenantId 테넌트 ID
 * @param params.monthlyRange 월간 날짜 범위
 * @param params.studentCount 현재 학생 수 (반당 평균 인원 계산용)
 * @param params.enabled 쿼리 활성화 여부
 * @returns 수업 통계 카드 배열
 */
export function useClassStatsCards({
  tenantId,
  monthlyRange,
  studentCount,
  enabled = true,
}: UseClassStatsCardsParams) {
  return useQuery({
    queryKey: createQueryKey('class-stats-cards', tenantId, monthlyRange.currentMonthStr, studentCount),
    queryFn: async () => {
      if (!tenantId) return [];

      const cards: StatsCard[] = [];

      try {
        // ========================================
        // 섹션 11-12: 반당 평균 인원 & 평균 정원률
        // ========================================
        const classes = await safe(fetchClasses(tenantId, { status: 'active' }), []);
        const classCount = classes?.length || 0;
        const avgStudentsPerClass = classCount > 0 && studentCount > 0
          ? Math.round(studentCount / classCount)
          : 0;

        cards.push(normalizeStatsCard({
          id: 'stats-avg-students-per-class',
          type: 'stats',
          title: '반당 평균 인원',
          value: avgStudentsPerClass.toString(),
          unit: '명',
          trend: undefined,
          action_url: '/classes',
          chartDataKey: 'avg_students_per_class',
        }));

        let totalCapacity = 0;
        let totalCurrent = 0;
        if (classes && classes.length > 0) {
          classes.forEach((cls) => {
            if (cls.capacity && cls.capacity > 0) {
              totalCapacity += cls.capacity;
              totalCurrent += cls.current_count || 0;
            }
          });
        }
        const avgCapacityRate = totalCapacity > 0
          ? Math.round((totalCurrent / totalCapacity) * 100)
          : 0;

        cards.push(normalizeStatsCard({
          id: 'stats-avg-capacity-rate',
          type: 'stats',
          title: '평균 정원률',
          value: avgCapacityRate.toString(),
          unit: '%',
          trend: undefined,
          action_url: '/classes',
          chartDataKey: 'avg_capacity_rate',
        }));

        // ========================================
        // 섹션 13: 평균 수납 기간
        // ========================================
        const invoices = await safe(fetchBillingHistory(tenantId, {
          period_start: { gte: monthlyRange.current.dateString.from, lte: monthlyRange.current.dateString.to },
        }), []);

        let totalDays = 0;
        let paidCount = 0;
        const ONE_DAY_MS = 1000 * 60 * 60 * 24;
        const safeInvoices = Array.isArray(invoices) ? invoices : [];

        if (safeInvoices.length > 0) {
          safeInvoices.forEach((inv: BillingHistoryItem) => {
            if (isInvoicePaid(inv.status) && (inv.amount_paid ?? 0) > 0 && inv.period_start && inv.updated_at) {
              const periodStart = new Date(`${inv.period_start}T00:00:00+09:00`).getTime();
              const paidDate = new Date(inv.updated_at).getTime();
              const daysDiff = Math.max(0, Math.round((paidDate - periodStart) / ONE_DAY_MS));
              totalDays += daysDiff;
              paidCount += 1;
            }
          });
        }

        const avgCollectionDays = paidCount > 0
          ? Math.round(totalDays / paidCount)
          : 0;

        cards.push(normalizeStatsCard({
          id: 'stats-avg-collection-period',
          type: 'stats',
          title: '평균 수납 기간',
          value: avgCollectionDays.toString(),
          unit: '일',
          trend: undefined,
          action_url: '/billing',
        }));
      } catch (error) {
        logError('ClassStatsCards:Error', error);
        // Fail Closed: 에러 시 빈 배열 반환
      }

      return cards;
    },
    enabled: enabled && !!tenantId,
    staleTime: 60 * 1000, // 1분
    gcTime: 5 * 60 * 1000, // 5분
  });
}
