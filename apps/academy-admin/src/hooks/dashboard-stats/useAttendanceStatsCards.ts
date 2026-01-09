/**
 * 출석 통계 카드 Hook
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 *
 * 포함 섹션:
 * - 섹션 4: 오늘 출석률, 지각률, 결석률
 * - 섹션 5: 최근 7일 평균 출석률
 * - 섹션 6: 이번 달 평균 출석률, 출석률 개선율
 */

import { useQuery } from '@tanstack/react-query';
import { fetchAttendanceStats } from '@hooks/use-student';
import { fetchAttendanceLogs } from '@hooks/use-attendance';
import type { StatsCard } from '../../types/dashboardCard';
import { calculateTrendPercentPoint } from '../../utils/trend-calculation-utils';
import { normalizeStatsCard } from '../../utils/dashboard-card-normalization';
import { safe, logError } from '../../utils';
import { createQueryKey } from '@hooks/use-query-key-utils';
import type { DateRange } from '../../utils/date-range-utils';
import type { Dayjs } from 'dayjs';

// [P2-FIX] 로컬 logError 제거 - SSOT logError 사용 (../../utils)

export interface UseAttendanceStatsCardsParams {
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
  enabled?: boolean;
}

/**
 * 출석 통계 카드 조회 Hook (섹션 4-6)
 *
 * 생성 카드:
 * 1. 오늘 출석률
 * 2. 오늘 지각률
 * 3. 오늘 결석률
 * 4. 최근 7일 평균 출석률
 * 5. 이번 달 평균 출석률
 * 6. 출석률 개선율 (전월 대비)
 *
 * @param params.tenantId 테넌트 ID
 * @param params.baseKST 기준 KST 시각
 * @param params.monthlyRange 월간 날짜 범위
 * @param params.weeklyRange 주간 날짜 범위
 * @param params.enabled 쿼리 활성화 여부
 * @returns 출석 통계 카드 배열
 */
export function useAttendanceStatsCards({
  tenantId,
  baseKST,
  monthlyRange,
  weeklyRange,
  enabled = true,
}: UseAttendanceStatsCardsParams) {
  return useQuery({
    queryKey: createQueryKey('attendance-stats-cards', tenantId, monthlyRange.currentMonthStr),
    queryFn: async () => {
      if (!tenantId) return [];

      const cards: StatsCard[] = [];

      try {
        // ========================================
        // 섹션 4: 오늘 출석률/지각률/결석률
        // ========================================
        const todayKST = baseKST;
        const todayDateForStats = new Date(todayKST.format('YYYY-MM-DD') + 'T00:00:00+09:00');
        const yesterdayKST = todayKST.clone().subtract(1, 'day');
        const yesterdayDateForStats = new Date(yesterdayKST.format('YYYY-MM-DD') + 'T00:00:00+09:00');

        const [attendanceStats, yesterdayAttendanceStats] = await Promise.all([
          safe(fetchAttendanceStats(tenantId, todayDateForStats), { attendance_rate: 0, total_students: 0, present: 0, late: 0, absent: 0, not_checked: 0 }),
          safe(fetchAttendanceStats(tenantId, yesterdayDateForStats), { attendance_rate: 0, total_students: 0, present: 0, late: 0, absent: 0, not_checked: 0 }),
        ]);

        const attendanceTrend = (yesterdayAttendanceStats?.total_students ?? 0) > 0
          ? `${attendanceStats.attendance_rate >= yesterdayAttendanceStats.attendance_rate ? '+' : ''}${Math.round(attendanceStats.attendance_rate - yesterdayAttendanceStats.attendance_rate)}%p`
          : undefined;

        const yesterdayLateRate = yesterdayAttendanceStats && yesterdayAttendanceStats.total_students > 0
          ? Math.round((yesterdayAttendanceStats.late / yesterdayAttendanceStats.total_students) * 100)
          : 0;
        const lateRate = attendanceStats.total_students > 0
          ? Math.round((attendanceStats.late / attendanceStats.total_students) * 100)
          : 0;
        const lateTrend = (yesterdayAttendanceStats?.total_students ?? 0) > 0
          ? `${lateRate >= yesterdayLateRate ? '+' : ''}${Math.round(lateRate - yesterdayLateRate)}%p`
          : undefined;

        const yesterdayAbsentRate = yesterdayAttendanceStats && yesterdayAttendanceStats.total_students > 0
          ? Math.round((yesterdayAttendanceStats.absent / yesterdayAttendanceStats.total_students) * 100)
          : 0;
        const absentRate = attendanceStats.total_students > 0
          ? Math.round((attendanceStats.absent / attendanceStats.total_students) * 100)
          : 0;
        const absentTrend = (yesterdayAttendanceStats?.total_students ?? 0) > 0
          ? `${absentRate >= yesterdayAbsentRate ? '+' : ''}${Math.round(absentRate - yesterdayAbsentRate)}%p`
          : undefined;

        cards.push(normalizeStatsCard({
          id: 'stats-attendance-rate',
          type: 'stats',
          title: '오늘 출석률',
          value: attendanceStats.attendance_rate.toFixed(1),
          unit: '%',
          trend: attendanceTrend,
          action_url: '/attendance',
          chartDataKey: 'attendance_rate',
        }));

        cards.push(normalizeStatsCard({
          id: 'stats-late-rate',
          type: 'stats',
          title: '오늘 지각률',
          value: lateRate.toString(),
          unit: '%',
          trend: lateTrend,
          action_url: '/attendance',
          chartDataKey: 'late_rate',
        }));

        cards.push(normalizeStatsCard({
          id: 'stats-absent-rate',
          type: 'stats',
          title: '오늘 결석률',
          value: absentRate.toString(),
          unit: '%',
          trend: absentTrend,
          action_url: '/attendance',
          chartDataKey: 'absent_rate',
        }));

        // ========================================
        // 섹션 5: 최근 7일 평균 출석률
        // ========================================
        const sevenDaysAgoStr = weeklyRange.current.dateString.from;
        const fourteenDaysAgoStr = weeklyRange.last.dateString.from;
        const beforeSevenDaysAgoStr = weeklyRange.last.dateString.to;

        const [weeklyLogs, lastWeekLogs] = await Promise.all([
          safe(fetchAttendanceLogs(tenantId, {
            date_from: sevenDaysAgoStr,
            date_to: baseKST.format('YYYY-MM-DD'),
            attendance_type: 'check_in',
          }), []),
          safe(fetchAttendanceLogs(tenantId, {
            date_from: fourteenDaysAgoStr,
            date_to: beforeSevenDaysAgoStr,
            attendance_type: 'check_in',
          }), []),
        ]);

        const weeklyPresentLogs = weeklyLogs?.filter((log) => log.status === 'present') || [];
        const presentCount = weeklyPresentLogs.length;
        const weeklyAttendanceRate = weeklyLogs && weeklyLogs.length > 0
          ? Math.round((presentCount / weeklyLogs.length) * 100)
          : 0;

        const lastWeekPresentLogs = lastWeekLogs?.filter((log) => log.status === 'present') || [];
        const lastWeekPresentCount = lastWeekPresentLogs.length;
        const lastWeekAttendanceRate = lastWeekLogs && lastWeekLogs.length > 0
          ? Math.round((lastWeekPresentCount / lastWeekLogs.length) * 100)
          : 0;
        const weeklyTrend = calculateTrendPercentPoint(weeklyAttendanceRate, lastWeekAttendanceRate);

        cards.push(normalizeStatsCard({
          id: 'stats-weekly-attendance',
          type: 'stats',
          title: '최근 7일 평균 출석률',
          value: weeklyAttendanceRate.toString(),
          unit: '%',
          trend: weeklyTrend,
          action_url: '/attendance',
        }));

        // ========================================
        // 섹션 6: 이번 달 평균 출석률 & 출석률 개선율
        // ========================================
        const todayStrForMonthly = baseKST.clone().format('YYYY-MM-DD');
        const [monthlyLogs, lastMonthLogs] = await Promise.all([
          safe(fetchAttendanceLogs(tenantId, {
            date_from: monthlyRange.current.dateString.from,
            date_to: todayStrForMonthly,
            attendance_type: 'check_in',
          }), []),
          safe(fetchAttendanceLogs(tenantId, {
            date_from: monthlyRange.last.dateString.from,
            date_to: monthlyRange.last.dateString.to,
            attendance_type: 'check_in',
          }), []),
        ]);

        const monthlyPresentLogs = monthlyLogs?.filter((log) => log.status === 'present') || [];
        const monthlyPresentCount = monthlyPresentLogs.length;
        const monthlyAttendanceRate = monthlyLogs && monthlyLogs.length > 0
          ? Math.round((monthlyPresentCount / monthlyLogs.length) * 100)
          : 0;

        const lastMonthPresentLogs = lastMonthLogs?.filter((log) => log.status === 'present') || [];
        const lastMonthPresentCount = lastMonthPresentLogs.length;
        const lastMonthAttendanceRate = lastMonthLogs && lastMonthLogs.length > 0
          ? Math.round((lastMonthPresentCount / lastMonthLogs.length) * 100)
          : 0;
        const monthlyTrend = calculateTrendPercentPoint(monthlyAttendanceRate, lastMonthAttendanceRate);

        cards.push(normalizeStatsCard({
          id: 'stats-monthly-attendance-rate',
          type: 'stats',
          title: '이번 달 평균 출석률',
          value: monthlyAttendanceRate.toString(),
          unit: '%',
          trend: monthlyTrend,
          action_url: '/attendance',
          chartDataKey: 'attendance_rate',
        }));

        const currentMonthRate = monthlyAttendanceRate;
        const lastMonthRate = lastMonthAttendanceRate;
        const improvementRate = lastMonthRate > 0
          ? Math.round(((currentMonthRate - lastMonthRate) / lastMonthRate) * 100)
          : currentMonthRate > 0 ? 100 : 0;

        cards.push(normalizeStatsCard({
          id: 'stats-attendance-improvement-rate',
          type: 'stats',
          title: '출석률 개선율',
          value: `${improvementRate > 0 ? '+' : ''}${improvementRate}`,
          unit: '%',
          action_url: '/attendance',
          chartDataKey: 'attendance_rate',
        }));
      } catch (error) {
        logError('AttendanceStatsCards:Error', error);
        // Fail Closed: 에러 시 빈 배열 반환
      }

      return cards;
    },
    enabled: enabled && !!tenantId,
    staleTime: 60 * 1000, // 1분
    gcTime: 5 * 60 * 1000, // 5분
  });
}
