/**
 * useStudent Hook
 */

export {
  useStudents,
  fetchStudents,
  fetchPersons,
  fetchPersonsCount,
  useStudentsPaged,
  useStudent,
  useCreateStudent,
  useBulkCreateStudents,
  useUpdateStudent,
  useDeleteStudent,
  useGuardians,
  fetchGuardians,
  useCreateGuardian,
  useUpdateGuardian,
  useDeleteGuardian,
  useStudentTags,
  useStudentTagsByStudent,
  useAllStudentTagAssignments,
  useUpdateStudentTags,
  useConsultations,
  useAllConsultations,
  fetchConsultations,
  useCreateConsultation,
  useUpdateConsultation,
  useDeleteConsultation,
  useGenerateConsultationAISummary,
  useStudentClasses,
  useAllStudentClasses,
  useAssignStudentToClass,
  useUnassignStudentFromClass,
  useUpdateStudentClassEnrolledAt,
} from './useStudent';

export {
  useStudentTaskCards,
  useCompleteStudentTaskCard,
  useRequestApprovalStudentTaskCard,
  useApproveAndExecuteStudentTaskCard,
  useSnoozeStudentTaskCard,
  useDeleteStudentTaskCard,
} from './useStudentTaskCard';

export { useStudentTaskCardAction } from './useStudentTaskCardAction';

export type { StudentTaskCard, TaskCard } from './useStudentTaskCard';

export {
  useStudentStats,
  useAttendanceStats,
  useStudentAlerts,
  useConsultationStats,
  fetchStudentStats,
  fetchAttendanceStats,
  fetchStudentAlerts,
  fetchConsultationStats,
} from './useStudentStats';

export type {
  StudentStats,
  AttendanceStats,
  StudentAlerts,
  ConsultationStats,
} from './useStudentStats';

export {
  useRecentActivity,
  fetchRecentActivity,
} from './useRecentActivity';

export type {
  RecentActivity,
} from './useRecentActivity';

// 캐시 키 SSOT 및 무효화 유틸리티
export {
  STUDENT_CACHE_KEYS,
  invalidateStudentConsultations,
  invalidateStudentData,
  invalidateGuardians,
  invalidateStudentTags,
  invalidateStudentClasses,
} from './cache-keys';
