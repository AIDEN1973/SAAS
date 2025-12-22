/**
 * useAttendance Hook
 */

export {
  useAttendanceNotifications,
  useQRAttendance,
  useAttendanceLogs,
  fetchAttendanceLogs,
  useCreateAttendanceLog,
  useUpdateAttendanceLog,
  useDeleteAttendanceLog,
} from './useAttendance';

export type {
  AttendanceNotification,
  QRTokenVerificationResult,
  OTPVerificationResult,
  AttendanceSubmissionResult,
  FallbackAuthInput,
} from './useAttendance';
