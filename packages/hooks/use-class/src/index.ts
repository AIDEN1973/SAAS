/**
 * useClass Hook
 */

export {
  useClasses,
  fetchClasses,
  useClass,
  useCreateClass,
  useUpdateClass,
  useDeleteClass,
  useClassStatistics,
  useTeachers,
  useTeacher,
  useCreateTeacher,
  useUpdateTeacher,
  useDeleteTeacher,
  useClassTeachers,
  useAssignTeacher,
  useUnassignTeacher,
  useCheckScheduleConflicts,
} from './useClass';

export {
  useTeacherStatistics,
  useTeacherClasses,
} from './useClass_teacher_extensions';

export type {
  TeacherStatistics,
  TeacherClassAssignment,
} from './useClass_teacher_extensions';

