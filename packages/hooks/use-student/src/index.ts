/**
 * useStudent Hook
 */

export {
  useStudents,
  useStudent,
  useCreateStudent,
  useBulkCreateStudents,
  useUpdateStudent,
  useDeleteStudent,
  useGuardians,
  useCreateGuardian,
  useUpdateGuardian,
  useDeleteGuardian,
  useStudentTags,
  useStudentTagsByStudent,
  useUpdateStudentTags,
  useConsultations,
  useCreateConsultation,
  useUpdateConsultation,
  useDeleteConsultation,
  useGenerateConsultationAISummary,
  useStudentClasses,
  useAssignStudentToClass,
  useUnassignStudentFromClass,
} from './useStudent';

export {
  useStudentTaskCards,
  useCompleteStudentTaskCard,
} from './useStudentTaskCard';

export type { StudentTaskCard } from './useStudentTaskCard';
