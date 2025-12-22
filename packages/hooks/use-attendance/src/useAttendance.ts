/**
 * useAttendance Hook
 *
 * React Query 기반 출결 Hook
 * [불변 규칙] tenant 변경 시 invalidateQueries() 자동 발생
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import type { AttendanceLog, CreateAttendanceLogInput, AttendanceFilter } from '@services/attendance-service';

export interface AttendanceNotification {
  id: string;
  student_id: string;
  student_name?: string;
  title: string;
  message: string;
  attendance_type: 'check_in' | 'check_out' | 'absent' | 'late';
  occurred_at: string;
  created_at: string;
}

export interface QRTokenVerificationResult {
  valid: boolean;
  tenantId?: string;
  locationType?: string;
  locationId?: string;
  error?: string;
}

export interface OTPVerificationResult {
  success: boolean;
  studentId?: string;
  error?: string;
}

export interface AttendanceSubmissionResult {
  success: boolean;
  attendanceId?: string;
  error?: string;
}

export interface FallbackAuthInput {
  qrToken: string;
  studentId: string;
  birthDate: string; // YYYY (생년 4자리)
}

/**
 * 출결 알림 조회 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 * 학부모는 자신의 자녀에 대한 출결 알림만 조회 가능 (RLS 정책)
 */
export function useAttendanceNotifications(studentId?: string) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<AttendanceNotification[]>({
    queryKey: ['attendance-notifications', tenantId, studentId],
    queryFn: async () => {
      // TODO: 실제 API 엔드포인트로 교체 필요
      // 현재는 notifications 테이블에서 출결 관련 알림을 조회한다고 가정
      // RLS 정책에 의해 현재 사용자의 자녀에 대한 알림만 조회됨
      const filters: Record<string, unknown> = {
        notification_type: 'attendance',
      };
      if (studentId) {
        filters.student_id = studentId;
      }

      const response = await apiClient.get<AttendanceNotification>('notifications', {
        filters,
        orderBy: { column: 'created_at', ascending: false },
        limit: 50,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return (response.data || []) as AttendanceNotification[];
    },
    enabled: !!tenantId,
    refetchInterval: 60000, // 1분마다 자동 갱신
  });
}

/**
 * QR 출결 관련 Hook
 */
export function useQRAttendance() {
  /**
   * QR 토큰 검증
   */
  const verifyQRToken = async (qrToken: string): Promise<QRTokenVerificationResult> => {
    try {
      // TODO: 실제 API 엔드포인트로 교체 필요
      // Edge Function: fns-attendance-verify-qr-token 호출
      const response = await apiClient.post<QRTokenVerificationResult>(
        'functions/v1/fns-attendance-verify-qr-token',
        { qr_token: qrToken }
      );

      if (response.error) {
        return { valid: false, error: response.error.message };
      }

      return response.data || { valid: false, error: '알 수 없는 오류' };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : '토큰 검증 실패' };
    }
  };

  /**
   * OTP 발송
   */
  const sendOTP = async (phone: string): Promise<void> => {
    // TODO: 실제 API 엔드포인트로 교체 필요
    const response = await apiClient.post('functions/v1/fns-auth-send-otp', { phone });

    if (response.error) {
      throw new Error(response.error.message);
    }
  };

  /**
   * OTP 검증
   */
  const verifyOTP = async (phone: string, otp: string): Promise<OTPVerificationResult> => {
    try {
      // TODO: 실제 API 엔드포인트로 교체 필요
      const response = await apiClient.post<OTPVerificationResult>(
        'functions/v1/fns-auth-verify-otp',
        { phone, otp }
      );

      if (response.error) {
        return { success: false, error: response.error.message };
      }

      return response.data || { success: false, error: '알 수 없는 오류' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'OTP 검증 실패' };
    }
  };

  /**
   * 출결 제출
   */
  const submitAttendance = async (params: {
    qrToken: string;
    studentId: string;
    authMethod: string;
    gps?: { lat?: number; lng?: number };
  }): Promise<AttendanceSubmissionResult> => {
    try {
      // TODO: 실제 API 엔드포인트로 교체 필요
      // Edge Function: fns-attendance-submit 호출
      const response = await apiClient.post<AttendanceSubmissionResult>(
        'functions/v1/fns-attendance-submit',
        {
          qr_token: params.qrToken,
          student_id: params.studentId,
          auth_method: params.authMethod,
          gps_lat: params.gps?.lat,
          gps_lng: params.gps?.lng,
          source: 'qr',
        }
      );

      if (response.error) {
        return { success: false, error: response.error.message };
      }

      return response.data || { success: false, error: '알 수 없는 오류' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '출결 제출 실패' };
    }
  };

  /**
   * 보조 인증으로 출결 제출
   */
  const submitAttendanceWithFallback = async (
    input: FallbackAuthInput
  ): Promise<AttendanceSubmissionResult> => {
    try {
      // TODO: 실제 API 엔드포인트로 교체 필요
      const response = await apiClient.post<AttendanceSubmissionResult>(
        'functions/v1/fns-attendance-submit-fallback',
        input as unknown as Record<string, unknown>
      );

      if (response.error) {
        return { success: false, error: response.error.message };
      }

      return response.data || { success: false, error: '알 수 없는 오류' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '출결 제출 실패' };
    }
  };

  return {
    verifyQRToken,
    sendOTP,
    verifyOTP,
    submitAttendance,
    submitAttendanceWithFallback,
  };
}

/**
 * 출결 로그 조회 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
/**
 * 출결 로그 조회 함수 (Hook의 queryFn 로직을 재사용)
 * [불변 규칙] useQuery 내부에서도 이 함수를 사용하여 일관성 유지
 */
export async function fetchAttendanceLogs(
  tenantId: string,
  filter?: AttendanceFilter
): Promise<AttendanceLog[]> {
  const filters: Record<string, unknown> = {};

  if (filter?.student_id) {
    filters.student_id = filter.student_id;
  }
  if (filter?.class_id) {
    filters.class_id = filter.class_id;
  }
  if (filter?.attendance_type) {
    filters.attendance_type = filter.attendance_type;
  }
  if (filter?.status) {
    filters.status = filter.status;
  }
  if (filter?.date_from) {
    filters.occurred_at = { gte: filter.date_from };
  }
  if (filter?.date_to) {
    filters.occurred_at = {
      ...(filters.occurred_at || {}),
      lte: filter.date_to
    };
  }

  const response = await apiClient.get<AttendanceLog>('attendance_logs', {
    filters,
    orderBy: { column: 'occurred_at', ascending: false },
    limit: 1000,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return (response.data || []) as AttendanceLog[];
}

export function useAttendanceLogs(filter?: AttendanceFilter) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<AttendanceLog[]>({
    queryKey: ['attendance-logs', tenantId, filter],
    queryFn: () => fetchAttendanceLogs(tenantId!, filter),
    enabled: !!tenantId,
  });
}

/**
 * 출결 로그 생성 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function useCreateAttendanceLog() {
  const context = getApiContext();
  const tenantId = context.tenantId;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAttendanceLogInput) => {
      const response = await apiClient.post<AttendanceLog>('attendance_logs', input as unknown as Record<string, unknown>);

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data!;
    },
    onSuccess: () => {
      // 출결 로그 목록 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['attendance-logs', tenantId] });
    },
  });
}

/**
 * 출결 로그 수정 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function useUpdateAttendanceLog() {
  const context = getApiContext();
  const tenantId = context.tenantId;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ logId, input }: { logId: string; input: Partial<CreateAttendanceLogInput> }) => {
      const response = await apiClient.patch<AttendanceLog>('attendance_logs', logId, input as unknown as Record<string, unknown>);

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data!;
    },
    onSuccess: () => {
      // 출결 로그 목록 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['attendance-logs', tenantId] });
    },
  });
}

/**
 * 출결 로그 삭제 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function useDeleteAttendanceLog() {
  const context = getApiContext();
  const tenantId = context.tenantId;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (logId: string) => {
      const response = await apiClient.delete('attendance_logs', logId);

      if (response.error) {
        throw new Error(response.error.message);
      }
    },
    onSuccess: () => {
      // 출결 로그 목록 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['attendance-logs', tenantId] });
    },
  });
}
