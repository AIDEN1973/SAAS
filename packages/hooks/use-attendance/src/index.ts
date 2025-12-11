/**
 * useAttendance Hook
 */

export {
  useAttendanceNotifications,
  useQRAttendance,
  useAttendanceLogs,
  useCreateAttendanceLog,
  useDeleteAttendanceLog,
} from './useAttendance';

export type {
  AttendanceNotification,
  QRTokenVerificationResult,
  OTPVerificationResult,
  AttendanceSubmissionResult,
  FallbackAuthInput,
} from './useAttendance';
