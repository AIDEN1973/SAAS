/**
 * Today Classes 쿼리 훅
 *
 * [LAYER: UI_PAGE]
 */

import { useMemo } from 'react';
import { useClasses } from '@hooks/use-class';
import { useAttendanceLogs } from '@hooks/use-attendance';
import { toKST } from '@lib/date-utils';
import type { DayOfWeek } from '@services/class-service';
import type { ClassCard } from '../../../types/dashboardCard';
import type { AttendanceLog } from '@services/attendance-service';
import { normalizeClassCard } from '../../../utils';
import { ROUTES } from '../../../constants';

export function useTodayClasses() {
  const nowKST = useMemo(() => toKST(), []);

  const todayDayOfWeek: DayOfWeek = (() => {
    const dayOfWeek = nowKST.day();
    const dayOfWeekMap: Record<number, DayOfWeek> = {
      0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
      4: 'thursday', 5: 'friday', 6: 'saturday',
    };
    return dayOfWeekMap[dayOfWeek] ?? 'monday';
  })();

  const classesParams = useMemo(() => ({
    day_of_week: todayDayOfWeek,
    status: 'active' as const,
  }), [todayDayOfWeek]);

  const { data: todayClassesData } = useClasses(classesParams);

  const attendanceParams = useMemo(() => {
    const dateFrom = nowKST.clone().startOf('day').format('YYYY-MM-DD');
    const dateTo = nowKST.clone().endOf('day').format('YYYY-MM-DD');
    return {
      date_from: dateFrom,
      date_to: dateTo,
      attendance_type: 'check_in' as const,
    };
  }, [nowKST]);

  const { data: todayAttendanceLogs } = useAttendanceLogs(attendanceParams);

  const todayClasses = useMemo<ClassCard[]>(() => {
    const safeTodayClassesData = Array.isArray(todayClassesData) ? todayClassesData : [];
    const safeTodayAttendanceLogs: AttendanceLog[] = Array.isArray(todayAttendanceLogs) ? todayAttendanceLogs : [];
    if (safeTodayClassesData.length === 0) return [];

    return safeTodayClassesData.map((cls) => {
      const attendanceCount = safeTodayAttendanceLogs.filter((log) =>
        log.class_id === cls.id && log.status === 'present'
      ).length;
      const studentCount = cls.current_count || 0;

      return normalizeClassCard({
        id: cls.id,
        type: 'class',
        class_name: cls.name,
        start_time: cls.start_time,
        student_count: studentCount,
        attendance_count: attendanceCount,
        action_url: ROUTES.ATTENDANCE_BY_CLASS(cls.id),
      });
    });
  }, [todayClassesData, todayAttendanceLogs]);

  return { todayClasses };
}
