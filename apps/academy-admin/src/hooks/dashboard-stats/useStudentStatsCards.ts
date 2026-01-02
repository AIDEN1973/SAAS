// LAYER: UI_HOOK
/**
 * 학생 통계 카드 Hook
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 * [SSOT] Shared Catalog 등록 필요: use-dashboard-stats
 *
 * 분리 이유:
 * - HomePage의 statsCards queryFn이 1,000+ lines로 과도하게 복잡
 * - 각 통계 섹션을 독립적으로 테스트 및 유지보수 가능하도록 분리
 * - React Query가 독립적 쿼리를 자동으로 병렬 실행
 *
 * 포함 섹션:
 * - 섹션 1: 총 학생 수 (트렌드 포함)
 * - 섹션 2: 학생 상세 통계 (신규/활성/비활성)
 * - 섹션 3: 월간 학생 성장률, 이번 주 신규 등록, 학생 유지율
 */

import { useQuery } from '@tanstack/react-query';
import { fetchPersonsCount, fetchStudentStats, fetchPersons } from '@hooks/use-student';
import type { StatsCard } from '../../types/dashboardCard';
import { calculateTrend } from '../../utils/trend-calculation-utils';
import { normalizeStatsCard } from '../../utils/dashboard-card-normalization';
import { safe, logError } from '../../utils';
import { createQueryKey } from '@hooks/use-query-key-utils';
import type { DateRange } from '../../utils/date-range-utils';

// [P2-FIX] 로컬 logError 제거 - SSOT logError 사용 (../../utils)

export interface UseStudentStatsCardsParams {
  tenantId: string | null;
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
 * 학생 통계 카드 조회 Hook (섹션 1-4)
 *
 * 생성 카드:
 * 1. 총 학생 수 (트렌드 포함)
 * 2. 이번 달 신규 등록
 * 3. 활성 학생 수
 * 4. 비활성 학생 수
 * 5. 월간 학생 성장률
 * 6. 이번 주 신규 등록
 * 7. 학생 유지율
 *
 * @param params.tenantId 테넌트 ID
 * @param params.monthlyRange 월간 날짜 범위
 * @param params.weeklyRange 주간 날짜 범위
 * @param params.enabled 쿼리 활성화 여부
 * @returns 학생 통계 카드 배열
 */
export function useStudentStatsCards({
  tenantId,
  monthlyRange,
  weeklyRange,
  enabled = true,
}: UseStudentStatsCardsParams) {
  return useQuery({
    queryKey: createQueryKey('student-stats-cards', tenantId, monthlyRange.currentMonthStr),
    queryFn: async () => {
      if (!tenantId) return [];

      const cards: StatsCard[] = [];
      const lastMonthEnd = monthlyRange.last.iso.lte;
      const lastMonthStart = monthlyRange.last.iso.gte;
      const currentMonthEnd = monthlyRange.current.iso.lte;
      const rolling7StartISO = weeklyRange.current.iso.gte;
      const rolling14StartISO = weeklyRange.last.iso.gte;
      const rolling7EndISO = weeklyRange.last.iso.lte;

      try {
        // ========================================
        // 섹션 1: 총 학생 수
        // ========================================
        const [studentCount, lastMonthStudentCount] = await Promise.all([
          safe(fetchPersonsCount(tenantId, {
            person_type: 'student',
          }), 0),
          safe(fetchPersonsCount(tenantId, {
            person_type: 'student',
            created_at: { lte: lastMonthEnd },
          }), 0),
        ]);

        const studentTrend = calculateTrend(studentCount, lastMonthStudentCount, '전월 대비');

        cards.push(normalizeStatsCard({
          id: 'stats-students',
          type: 'stats',
          title: '총 학생 수',
          value: String(studentCount),
          unit: '명',
          trend: studentTrend,
          action_url: '/students',
        }));

        // ========================================
        // 섹션 2: 학생 상세 통계 (신규/활성/비활성)
        // ========================================
        const [studentStats, lastMonthNewStudents] = await Promise.all([
          safe(fetchStudentStats(tenantId), { total: 0, active: 0, inactive: 0, new_this_month: 0, by_status: {} }),
          safe(fetchPersons(tenantId, {
            person_type: 'student',
            created_at: { gte: lastMonthStart, lte: lastMonthEnd },
          }), []),
        ]);

        const lastMonthNewCount = lastMonthNewStudents?.length || 0;
        const newStudentsTrend = calculateTrend(studentStats.new_this_month, lastMonthNewCount, '전월 대비');

        cards.push(normalizeStatsCard({
          id: 'stats-new-students',
          type: 'stats',
          title: '이번 달 신규 등록',
          value: studentStats.new_this_month.toString(),
          unit: '명',
          trend: newStudentsTrend,
          action_url: '/students',
          chartDataKey: 'new_enrollments',
        }));

        cards.push(normalizeStatsCard({
          id: 'stats-active-students',
          type: 'stats',
          title: '활성 학생 수',
          value: studentStats.active.toString(),
          unit: '명',
          trend: undefined,
          action_url: '/students',
          chartDataKey: 'active_student_count',
        }));

        cards.push(normalizeStatsCard({
          id: 'stats-inactive-students',
          type: 'stats',
          title: '비활성 학생 수',
          value: studentStats.inactive.toString(),
          unit: '명',
          trend: undefined,
          action_url: '/students',
          chartDataKey: 'inactive_student_count',
        }));

        // ========================================
        // 섹션 3: 월간 학생 성장률
        // ========================================
        const currentStudentCount = await safe(fetchPersonsCount(tenantId, {
          person_type: 'student',
          created_at: { lte: currentMonthEnd },
        }), 0);

        const lastStudentCount = lastMonthStudentCount;
        const growthRate = lastStudentCount > 0
          ? Math.round(((currentStudentCount - lastStudentCount) / lastStudentCount) * 100)
          : currentStudentCount > 0 ? 100 : 0;

        cards.push(normalizeStatsCard({
          id: 'stats-student-growth',
          type: 'stats',
          title: '월간 학생 성장률',
          value: `${growthRate > 0 ? '+' : ''}${growthRate}`,
          unit: '%',
          action_url: '/students',
        }));

        // 섹션 3-1: 이번 주 신규 등록
        const nowISO = new Date().toISOString();
        const [weeklyNewStudents, lastWeekNewStudents] = await Promise.all([
          safe(fetchPersons(tenantId, {
            person_type: 'student',
            created_at: { gte: rolling7StartISO, lte: nowISO },
          }), []),
          safe(fetchPersons(tenantId, {
            person_type: 'student',
            created_at: { gte: rolling14StartISO, lte: rolling7EndISO },
          }), []),
        ]);

        const weeklyNewCount = weeklyNewStudents?.length || 0;
        const lastWeekNewCount = lastWeekNewStudents?.length || 0;
        const weeklyNewTrend = calculateTrend(weeklyNewCount, lastWeekNewCount, '전주 대비');

        cards.push(normalizeStatsCard({
          id: 'stats-weekly-new-students',
          type: 'stats',
          title: '이번 주 신규 등록',
          value: weeklyNewCount.toString(),
          unit: '명',
          trend: weeklyNewTrend,
          action_url: '/students',
          chartDataKey: 'new_enrollments',
        }));

        // 섹션 3-2: 학생 유지율
        const totalCount = studentCount;
        const activeCount = studentStats.active;
        const retentionRate = totalCount > 0
          ? Math.round((activeCount / totalCount) * 100)
          : 0;

        cards.push(normalizeStatsCard({
          id: 'stats-student-retention-rate',
          type: 'stats',
          title: '학생 유지율',
          value: retentionRate.toString(),
          unit: '%',
          trend: undefined,
          action_url: '/students',
          chartDataKey: 'active_student_count',
        }));
      } catch (error) {
        logError('StudentStatsCards:Error', error);
        // Fail Closed: 에러 시 빈 배열 반환
      }

      return cards;
    },
    enabled: enabled && !!tenantId,
    staleTime: 60 * 1000, // 1분
    gcTime: 5 * 60 * 1000, // 5분
  });
}
