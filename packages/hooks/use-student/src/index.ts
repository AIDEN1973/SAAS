/**
 * useStudent Hook
 */

export {
  useStudents,
  fetchStudents,
  fetchPersons,
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
  useUpdateStudentTags,
  useConsultations,
  fetchConsultations,
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
  useRequestApprovalStudentTaskCard,
  useApproveAndExecuteStudentTaskCard,
} from './useStudentTaskCard';

export { useStudentTaskCardAction } from './useStudentTaskCardAction';

export type { StudentTaskCard, TaskCard } from './useStudentTaskCard';
