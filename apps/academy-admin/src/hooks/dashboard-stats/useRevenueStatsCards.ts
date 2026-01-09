/**
 * 매출/ARPU 통계 카드 Hook
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 *
 * 포함 섹션:
 * - 섹션 7-10: 매출, 예정 매출, ARPU, 월간 매출 성장률, 주간 매출, 미납률
 */

import { useQuery } from '@tanstack/react-query';
import { fetchBillingHistory } from '@hooks/use-billing';
import { fetchPayments } from '@hooks/use-payments';
import type { StatsCard } from '../../types/dashboardCard';
import { calculateTrend } from '../../utils/trend-calculation-utils';
import { normalizeStatsCard } from '../../utils/dashboard-card-normalization';
import { safe, logError } from '../../utils';
import { createQueryKey } from '@hooks/use-query-key-utils';
import type { DateRange } from '../../utils/date-range-utils';
import type { BillingHistoryItem } from '@hooks/use-billing';
import type { Dayjs } from 'dayjs';

// [P2-FIX] 로컬 logError 제거 - SSOT logError 사용 (../../utils)

// 숫자를 천 단위 콤마로 포맷팅
function formatNumberWithCommas(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export interface UseRevenueStatsCardsParams {
  tenantId: string | null;
  baseKST: Dayjs;
  monthlyRange: {
    current: DateRange;
    last: DateRange;
    currentMonthStr: string;
    lastMonthStr: string;
  };
  weeklyRange: {
    current: DateRange;
    last: DateRange;
  };
  studentCount: number;
  lastMonthStudentCount: number;
  enabled?: boolean;
}

/**
 * 매출/ARPU 통계 카드 조회 Hook (섹션 7-10)
 *
 * 생성 카드:
 * 1. 이번 달 매출
 * 2. 이번 달 예정 매출
 * 3. ARPU (학생 1인당 매출)
 * 4. 월간 매출 성장률
 * 5. 최근 7일 매출
 * 6. 미납률
 *
 * @param params.tenantId 테넌트 ID
 * @param params.baseKST 기준 KST 시각
 * @param params.monthlyRange 월간 날짜 범위
 * @param params.weeklyRange 주간 날짜 범위
 * @param params.studentCount 현재 학생 수 (ARPU 계산용)
 * @param params.lastMonthStudentCount 전월 학생 수 (ARPU 계산용)
 * @param params.enabled 쿼리 활성화 여부
 * @returns 매출 통계 카드 배열
 */
export function useRevenueStatsCards({
  tenantId,
  baseKST,
  monthlyRange,
  weeklyRange,
  studentCount,
  lastMonthStudentCount,
  enabled = true,
}: UseRevenueStatsCardsParams) {
  return useQuery({
    queryKey: createQueryKey('revenue-stats-cards', tenantId, monthlyRange.currentMonthStr, studentCount),
    queryFn: async () => {
      if (!tenantId) return [];

      const cards: StatsCard[] = [];
      const rolling7StartISO = weeklyRange.current.iso.gte;
      const rolling14StartISO = weeklyRange.last.iso.gte;
      const rolling7EndISO = weeklyRange.last.iso.lte;

      try {
        // ========================================
        // 매출 데이터 조회 (섹션 7-10 공통)
        // ========================================
        const [invoices, lastMonthInvoices] = await Promise.all([
          safe(fetchBillingHistory(tenantId, {
            period_start: { gte: monthlyRange.current.dateString.from, lte: monthlyRange.current.dateString.to },
          }), []),
          safe(fetchBillingHistory(tenantId, {
            period_start: { gte: monthlyRange.last.dateString.from, lte: monthlyRange.last.dateString.to },
          }), []),
        ]);

        const safeInvoices = Array.isArray(invoices) ? invoices : [];
        let totalRevenue = 0;
        let expectedRevenue = 0;
        let totalAmount = 0;
        let unpaidAmount = 0;

        if (safeInvoices.length > 0) {
          safeInvoices.forEach((inv: BillingHistoryItem) => {
            totalRevenue += inv.amount_paid || 0;
            expectedRevenue += inv.amount || 0;
            totalAmount += inv.amount || 0;
            if (inv.status === 'pending' || inv.status === 'overdue') {
              const diff = (inv.amount || 0) - (inv.amount_paid || 0);
              unpaidAmount += Math.max(0, diff);
            }
          });
        }

        const safeLastMonthInvoices = Array.isArray(lastMonthInvoices) ? lastMonthInvoices : [];
        let lastMonthRevenue = 0;
        let lastMonthExpectedRevenue = 0;
        let lastMonthTotalAmount = 0;
        let lastMonthUnpaidAmount = 0;

        if (safeLastMonthInvoices.length > 0) {
          safeLastMonthInvoices.forEach((inv: BillingHistoryItem) => {
            lastMonthRevenue += inv.amount_paid || 0;
            lastMonthExpectedRevenue += inv.amount || 0;
            lastMonthTotalAmount += inv.amount || 0;
            if (inv.status === 'pending' || inv.status === 'overdue') {
              const diff = (inv.amount || 0) - (inv.amount_paid || 0);
              lastMonthUnpaidAmount += Math.max(0, diff);
            }
          });
        }

        // ========================================
        // 섹션 7: 이번 달 매출
        // ========================================
        const revenueTrend = calculateTrend(totalRevenue, lastMonthRevenue, '전월 대비');

        cards.push(normalizeStatsCard({
          id: 'stats-revenue',
          type: 'stats',
          title: '이번 달 매출',
          value: formatNumberWithCommas(totalRevenue),
          unit: '원',
          trend: revenueTrend,
          action_url: '/billing',
          chartDataKey: 'revenue',
        }));

        // ========================================
        // 섹션 7-1: 예정 매출
        // ========================================
        const expectedRevenueTrend = calculateTrend(expectedRevenue, lastMonthExpectedRevenue, '전월 대비');

        cards.push(normalizeStatsCard({
          id: 'stats-expected-revenue',
          type: 'stats',
          title: '이번 달 예정 매출',
          value: formatNumberWithCommas(expectedRevenue),
          unit: '원',
          trend: expectedRevenueTrend,
          action_url: '/billing',
        }));

        // ========================================
        // 섹션 8: ARPU (학생 1인당 평균 매출)
        // ========================================
        const arpu = studentCount > 0
          ? Math.round(totalRevenue / studentCount)
          : 0;
        const lastMonthArpu = lastMonthStudentCount > 0
          ? Math.round(lastMonthRevenue / lastMonthStudentCount)
          : 0;
        const arpuTrend = calculateTrend(arpu, lastMonthArpu, '전월 대비');

        cards.push(normalizeStatsCard({
          id: 'stats-arpu',
          type: 'stats',
          title: 'ARPU (학생 1인당 매출)',
          value: formatNumberWithCommas(arpu),
          unit: '원',
          trend: arpuTrend,
          action_url: '/billing',
          chartDataKey: 'arpu',
        }));

        // ========================================
        // 섹션 9: 월간 매출 성장률
        // ========================================
        const revenueGrowthRate = lastMonthRevenue > 0
          ? Math.round(((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
          : totalRevenue > 0 ? 100 : 0;

        cards.push(normalizeStatsCard({
          id: 'stats-revenue-growth',
          type: 'stats',
          title: '월간 매출 성장률',
          value: `${revenueGrowthRate > 0 ? '+' : ''}${revenueGrowthRate}`,
          unit: '%',
          action_url: '/billing',
        }));

        // ========================================
        // 섹션 9-1: 최근 7일 매출
        // ========================================
        const nowISO = baseKST.toISOString();
        const [weeklyPayments, lastWeekPayments] = await Promise.all([
          safe(fetchPayments(tenantId, {
            status: 'completed',
            created_at: { gte: rolling7StartISO, lte: nowISO },
          }), []),
          safe(fetchPayments(tenantId, {
            status: 'completed',
            created_at: { gte: rolling14StartISO, lte: rolling7EndISO },
          }), []),
        ]);

        const weeklyPaymentsSafe = Array.isArray(weeklyPayments) ? weeklyPayments : [];
        const lastWeekPaymentsSafe = Array.isArray(lastWeekPayments) ? lastWeekPayments : [];
        const weeklyRevenue = weeklyPaymentsSafe.reduce((sum, payment) => {
          return sum + (payment.amount || 0);
        }, 0);
        const lastWeekRevenue = lastWeekPaymentsSafe.reduce((sum, payment) => {
          return sum + (payment.amount || 0);
        }, 0);
        const weeklyRevenueTrend = calculateTrend(weeklyRevenue, lastWeekRevenue, '전주 대비');

        cards.push(normalizeStatsCard({
          id: 'stats-weekly-revenue',
          type: 'stats',
          title: '최근 7일 매출',
          value: formatNumberWithCommas(weeklyRevenue),
          unit: '원',
          trend: weeklyRevenueTrend,
          action_url: '/billing',
          chartDataKey: 'revenue',
        }));

        // ========================================
        // 섹션 10: 미납률
        // ========================================
        const unpaidRate = totalAmount > 0
          ? Math.round((unpaidAmount / totalAmount) * 100)
          : 0;
        const lastMonthUnpaidRate = lastMonthTotalAmount > 0
          ? Math.round((lastMonthUnpaidAmount / lastMonthTotalAmount) * 100)
          : 0;
        const unpaidRateTrend = lastMonthUnpaidRate > 0
          ? `${unpaidRate >= lastMonthUnpaidRate ? '+' : ''}${Math.round(unpaidRate - lastMonthUnpaidRate)}%p`
          : undefined;

        cards.push(normalizeStatsCard({
          id: 'stats-unpaid-rate',
          type: 'stats',
          title: '미납률',
          value: unpaidRate.toString(),
          unit: '%',
          trend: unpaidRateTrend,
          action_url: '/billing',
        }));
      } catch (error) {
        logError('RevenueStatsCards:Error', error);
        // Fail Closed: 에러 시 빈 배열 반환
      }

      return cards;
    },
    enabled: enabled && !!tenantId,
    staleTime: 60 * 1000, // 1분
    gcTime: 5 * 60 * 1000, // 5분
  });
}
