/**
 * API SDK Core
 *
 * Zero-Trust 권한 주입
 * Rate Limiting 테넌트별 100 req/s
 * Input Validation with Zod
 */

export * from './types';
export * from './context';
export * from './client';
export * from './rate-limiter';
export * from './validation';
export { apiClient, createApiClient, ApiClient } from './client';
export { setApiContext, getApiContext, clearApiContext } from './context';
export {
  rateLimiter,
  createRateLimiter,
  RateLimiter,
  RateLimitExceededError,
  type RateLimiterConfig
} from './rate-limiter';
export {
  validateInput,
  validateAndPrepare,
  validateField,
  // Common schemas
  emailSchema,
  phoneSchema,
  nameSchema,
  uuidSchema,
  dateSchema,
  // Student schemas
  createStudentInputSchema,
  updateStudentInputSchema,
  studentFilterSchema,
  studentStatusSchema,
  // Guardian schemas
  createGuardianInputSchema,
  // Attendance schemas
  createAttendanceInputSchema,
  attendanceTypeSchema,
  attendanceStatusSchema,
  // Class schemas
  createClassInputSchema,
  dayOfWeekSchema,
  timeSchema,
  // Tag schemas
  createTagInputSchema,
  // Types
  type ValidationResult,
  type ValidationSuccess,
  type ValidationError,
  type ValidationErrorItem,
  type CreateStudentInput,
  type UpdateStudentInput,
  type StudentFilter,
  type CreateGuardianInput,
  type CreateAttendanceInput,
  type CreateClassInput,
  type CreateTagInput,
} from './validation';

