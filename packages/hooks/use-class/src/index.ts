/**
 * useClass Hook
 */

// Re-export TeacherPosition type from @services/class-service
export type { TeacherPosition } from '@services/class-service';

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
  useResignTeacher,
  useClassTeachers,
  useAssignTeacher,
  useUnassignTeacher,
  useCheckScheduleConflicts,
} from './useClass';

export {
  useTeacherStatistics,
  useTeacherClasses,
  useTeachersWithStats,
} from './useClass_teacher_extensions';

export type {
  TeacherStatistics,
  TeacherClassAssignment,
  TeacherWithStats,
} from './useClass_teacher_extensions';

export {
  useCreateTeacherInvitation,
  useValidateTeacherInvitation,
  useSelfRegisterTeacher,
  useTeacherInvitations,
  useApproveTeacher,
  useApproveTeacherRegistration,
  useRejectTeacherRegistration,
  usePendingTeacherRegistrations,
  POSITION_LABELS,
} from './useTeacherInvitation';

export {
  useRolePermissions,
  useUpdateRolePermission,
  usePositionPermissionDescription,
  useHasPageAccess,
  PAGE_PATHS,
  DEFAULT_PERMISSIONS,
  getPageLabel,
  POSITION_LABELS as ROLE_POSITION_LABELS,
} from './useRolePermissions';

export type {
  RolePermission,
  PagePathKey,
} from './useRolePermissions';

export {
  useCurrentTeacherPosition,
} from './useCurrentTeacherPosition';

