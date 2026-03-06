/**
 * Stats Cards 조합 훅
 *
 * [LAYER: UI_PAGE]
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPersonsCount } from '@hooks/use-student';
import { useStudentStatsCards } from '../../../hooks/dashboard-stats/useStudentStatsCards';
import { useAttendanceStatsCards } from '../../../hooks/dashboard-stats/useAttendanceStatsCards';
import { useRevenueStatsCards } from '../../../hooks/dashboard-stats/useRevenueStatsCards';
import { useClassStatsCards } from '../../../hooks/dashboard-stats/useClassStatsCards';
import { createQueryKey } from '@hooks/use-query-key-utils';
import { getBaseKST, calculateMonthlyRange, calculateWeeklyRange } from '../../../utils/date-range-utils';
import { safe } from '../../../utils';

export function useStatsCards(tenantId: string) {
  const baseKST = useMemo(() => getBaseKST(), []);
  const monthlyRange = useMemo(() => calculateMonthlyRange(baseKST), [baseKST]);
  const weeklyRange = useMemo(() => calculateWeeklyRange(baseKST), [baseKST]);

  const { data: studentCountData } = useQuery({
    queryKey: createQueryKey('student-count-for-stats', tenantId),
    queryFn: async () => {
      if (!tenantId) return { current: 0, lastMonth: 0 };
      const lastMonthEnd = monthlyRange.last.iso.lte;
      const [current, lastMonth] = await Promise.all([
        safe(fetchPersonsCount(tenantId, { person_type: 'student' }), 0),
        safe(fetchPersonsCount(tenantId, { person_type: 'student', created_at: { lte: lastMonthEnd } }), 0),
      ]);
      return { current, lastMonth };
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const studentCount = studentCountData?.current ?? 0;
  const lastMonthStudentCount = studentCountData?.lastMonth ?? 0;

  const { data: studentStatsCards = [] } = useStudentStatsCards({
    tenantId, monthlyRange, weeklyRange, enabled: !!tenantId,
  });
  const { data: attendanceStatsCards = [] } = useAttendanceStatsCards({
    tenantId, baseKST, monthlyRange, weeklyRange, enabled: !!tenantId,
  });
  const { data: revenueStatsCards = [] } = useRevenueStatsCards({
    tenantId, baseKST, monthlyRange, weeklyRange, studentCount, lastMonthStudentCount,
    enabled: !!tenantId && studentCount !== undefined,
  });
  const { data: classStatsCards = [] } = useClassStatsCards({
    tenantId, monthlyRange, studentCount,
    enabled: !!tenantId && studentCount !== undefined,
  });

  const statsCards = useMemo(() => [
    ...studentStatsCards,
    ...attendanceStatsCards,
    ...revenueStatsCards,
    ...classStatsCards,
  ], [studentStatsCards, attendanceStatsCards, revenueStatsCards, classStatsCards]);

  return { statsCards };
}
