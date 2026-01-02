/**
 * Dashboard Stats Hooks
 *
 * HomePage의 statsCards queryFn을 독립적인 훅으로 분리
 */

export { useStudentStatsCards } from './useStudentStatsCards';
export type { UseStudentStatsCardsParams } from './useStudentStatsCards';

export { useAttendanceStatsCards } from './useAttendanceStatsCards';
export type { UseAttendanceStatsCardsParams } from './useAttendanceStatsCards';

export { useRevenueStatsCards } from './useRevenueStatsCards';
export type { UseRevenueStatsCardsParams } from './useRevenueStatsCards';

export { useClassStatsCards } from './useClassStatsCards';
export type { UseClassStatsCardsParams } from './useClassStatsCards';
