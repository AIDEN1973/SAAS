/**
 * useAttendance Hook
 *
 * React Query 기반 출결 Hook
 * [불변 규칙] tenant 변경 시 invalidateQueries() 자동 발생
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 */

import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import { useSession } from '@hooks/use-auth';
import { createExecutionAuditRecord } from '@hooks/use-student/src/execution-audit-utils';
import type { AttendanceLog, CreateAttendanceLogInput, AttendanceFilter } from '@services/attendance-service';

/**
 * [근본 수정] 출결 로그 쿼리 무효화 헬퍼 함수
 * predicate를 사용하여 모든 관련 쿼리를 확실하게 무효화
 */
function invalidateAttendanceLogsQueries(queryClient: QueryClient, tenantId: string | undefined) {
  console.log('[invalidateAttendanceLogsQueries] 🔄 쿼리 무효화 실행');
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey;
      const isMatch = Array.isArray(key) && key[0] === 'attendance-logs' && key[1] === tenantId;
      if (isMatch) {
        console.log('[invalidateAttendanceLogsQueries] 📌 무효화 대상:', key);
      }
      return isMatch;
    },
  });
}

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
  // [버그 수정] 'all' 또는 빈 문자열은 필터에서 제외 (유효한 UUID만 허용)
  if (filter?.class_id && filter.class_id !== 'all' && filter.class_id.trim() !== '') {
    filters.class_id = filter.class_id;
  }
  if (filter?.attendance_type) {
    filters.attendance_type = filter.attendance_type;
  }
  if (filter?.status) {
    filters.status = filter.status;
  }
  // [근본 수정] 날짜 필터링 - KST 시간대 명시하여 하루 전체를 조회
  // attendance_logs.occurred_at은 TIMESTAMPTZ (UTC 저장)
  // 클라이언트에서 KST로 저장하면 DB에는 UTC로 변환되어 저장됨
  // 예: '2026-01-13T00:57:00+09:00' (KST) → '2026-01-12T15:57:00+00:00' (UTC)
  // 따라서 필터에도 KST 시간대를 명시해야 올바르게 조회됨
  if (filter?.date_from) {
    // 날짜만 있으면 해당 날짜의 KST 시작 시간으로 변환
    const fromDate = filter.date_from.includes('T')
      ? filter.date_from
      : `${filter.date_from}T00:00:00+09:00`; // KST 시간대 명시
    filters.occurred_at = { gte: fromDate };
  }
  if (filter?.date_to) {
    // 날짜만 있으면 해당 날짜의 KST 끝 시간으로 변환
    const toDate = filter.date_to.includes('T')
      ? filter.date_to
      : `${filter.date_to}T23:59:59.999+09:00`; // KST 시간대 명시
    filters.occurred_at = {
      ...(filters.occurred_at || {}),
      lte: toDate
    };
  }

  // [디버그] 필터 확인
  console.log('[fetchAttendanceLogs] 🔍 최종 필터:', JSON.stringify(filters, null, 2));

  const response = await apiClient.get<AttendanceLog>('attendance_logs', {
    filters,
    orderBy: { column: 'occurred_at', ascending: false },
    limit: 1000,
  });

  // [디버그] 응답 확인
  console.log('[fetchAttendanceLogs] 📥 응답:', {
    success: response.success,
    dataCount: response.data?.length || 0,
    error: response.error,
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
    // [근본 수정] queryKey에 filter를 JSON 문자열로 변환하여 안정적인 캐시 키 생성
    // 객체 참조 대신 값 기반 비교를 보장
    queryKey: ['attendance-logs', tenantId, JSON.stringify(filter)],
    queryFn: () => fetchAttendanceLogs(tenantId!, filter),
    enabled: !!tenantId,
    // [근본 수정] staleTime을 0으로 설정하여 항상 최신 데이터 요청
    staleTime: 0,
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
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (input: CreateAttendanceLogInput) => {
      const startTime = Date.now();
      const response = await apiClient.post<AttendanceLog>('attendance_logs', input as unknown as Record<string, unknown>);

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      if (session?.user?.id && response.data) {
        const durationMs = Date.now() - startTime;
        await createExecutionAuditRecord(
          {
            operation_type: 'attendance.create',
            status: 'success',
            summary: `출결 로그 생성 완료 (${input.attendance_type})`,
            details: {
              attendance_log_id: response.data.id,
              student_id: input.student_id,
              attendance_type: input.attendance_type,
            },
            reference: {
              entity_type: 'attendance_log',
              entity_id: response.data.id,
            },
            duration_ms: durationMs,
          },
          session.user.id
        );
      }

      return response.data!;
    },
    onSuccess: () => {
      // [근본 수정] 헬퍼 함수를 사용하여 모든 관련 쿼리 무효화
      invalidateAttendanceLogsQueries(queryClient, tenantId);
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
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({ logId, input }: { logId: string; input: Partial<CreateAttendanceLogInput> }) => {
      const startTime = Date.now();
      const response = await apiClient.patch<AttendanceLog>('attendance_logs', logId, input as unknown as Record<string, unknown>);

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      if (session?.user?.id && response.data) {
        const durationMs = Date.now() - startTime;
        const changedFields = Object.keys(input);
        await createExecutionAuditRecord(
          {
            operation_type: 'attendance.update',
            status: 'success',
            summary: `출결 로그 수정 완료 (${changedFields.join(', ')})`,
            details: {
              attendance_log_id: logId,
              changed_fields: changedFields,
            },
            reference: {
              entity_type: 'attendance_log',
              entity_id: logId,
            },
            duration_ms: durationMs,
          },
          session.user.id
        );
      }

      return response.data!;
    },
    onSuccess: () => {
      // [근본 수정] 헬퍼 함수를 사용하여 모든 관련 쿼리 무효화
      invalidateAttendanceLogsQueries(queryClient, tenantId);
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
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (logId: string) => {
      const startTime = Date.now();
      const response = await apiClient.delete('attendance_logs', logId);

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      if (session?.user?.id) {
        const durationMs = Date.now() - startTime;
        await createExecutionAuditRecord(
          {
            operation_type: 'attendance.delete',
            status: 'success',
            summary: `출결 로그 삭제 완료`,
            details: {
              attendance_log_id: logId,
            },
            reference: {
              entity_type: 'attendance_log',
              entity_id: logId,
            },
            duration_ms: durationMs,
          },
          session.user.id
        );
      }
    },
    onSuccess: () => {
      // [근본 수정] 헬퍼 함수를 사용하여 모든 관련 쿼리 무효화
      invalidateAttendanceLogsQueries(queryClient, tenantId);
    },
  });
}

/**
 * 출결 로그 UPSERT Hook (INSERT 또는 UPDATE)
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 *
 * id가 있으면 UPDATE (PATCH), 없으면 INSERT를 수행합니다.
 * attendance_logs 테이블은 파티션 테이블이므로 Supabase의 .insert().select() 조합 시
 * ON CONFLICT 에러가 발생합니다. INSERT 시에는 .select() 없이 순수 INSERT만 수행하여
 * 이 문제를 우회합니다.
 */
export function useUpsertAttendanceLog() {
  const context = getApiContext();
  const tenantId = context.tenantId;
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (input: CreateAttendanceLogInput & { id?: string | number }) => {
      const startTime = Date.now();

      const { id, ...inputWithoutId } = input;

      if (id) {
        // id가 있으면 UPDATE (기존 레코드 수정)
        console.log('[useUpsertAttendanceLog] 🔄 UPDATE 모드 (id:', id, ')');
        const response = await apiClient.patch<AttendanceLog>(
          'attendance_logs',
          String(id),
          inputWithoutId as unknown as Record<string, unknown>
        );

        if (response.error) {
          throw new Error(response.error.message);
        }

        // Execution Audit 기록 생성
        if (session?.user?.id && response.data) {
          const durationMs = Date.now() - startTime;
          await createExecutionAuditRecord(
            {
              operation_type: 'attendance.update',
              status: 'success',
              summary: `출결 로그 수정 완료 (${input.attendance_type})`,
              details: {
                attendance_log_id: response.data.id,
                student_id: input.student_id,
                attendance_type: input.attendance_type,
                status: input.status,
              },
              reference: {
                entity_type: 'attendance_log',
                entity_id: response.data.id,
              },
              duration_ms: durationMs,
            },
            session.user.id
          );
        }

        return response.data!;
      } else {
        // id가 없으면 UPSERT (RPC 함수 사용)
        // [근본 해결] 파티션 테이블에서 Supabase PostgREST의 INSERT는 ON CONFLICT 문제 발생
        // 서버의 upsert_attendance_log RPC 함수가 SELECT-then-INSERT/UPDATE 로직을 처리
        // [불변 규칙] apiClient.callRPC()를 통해서만 RPC 함수 호출 (Zero-Trust 준수)
        console.log('[useUpsertAttendanceLog] ➕ UPSERT 모드 (apiClient.callRPC 사용)');

        // RPC 함수 파라미터 구성
        const rpcParams = {
          p_tenant_id: tenantId,
          p_student_id: inputWithoutId.student_id,
          p_class_id: inputWithoutId.class_id || null,
          p_occurred_at: inputWithoutId.occurred_at,
          p_attendance_type: inputWithoutId.attendance_type,
          p_status: inputWithoutId.status,
          p_check_in_method: (inputWithoutId as Record<string, unknown>).check_in_method || 'manual',
          p_notes: inputWithoutId.notes || null,
        };

        console.log('[useUpsertAttendanceLog] RPC params:', rpcParams);

        // [불변 규칙] apiClient.callRPC()를 통한 RPC 함수 호출
        // upsert_attendance_log 함수는 서버에서 중복 체크 후 INSERT 또는 UPDATE 수행
        const response = await apiClient.callRPC<AttendanceLog>('upsert_attendance_log', rpcParams);

        if (!response.success || response.error) {
          console.error('[useUpsertAttendanceLog] RPC 실패:', response.error);
          throw new Error(response.error?.message || 'RPC 호출 실패');
        }

        console.log('[useUpsertAttendanceLog] RPC 성공!', response.data);

        const upsertedData = response.data as AttendanceLog;

        // Execution Audit 기록 생성
        if (session?.user?.id && upsertedData) {
          const durationMs = Date.now() - startTime;
          await createExecutionAuditRecord(
            {
              operation_type: 'attendance.upsert',
              status: 'success',
              summary: `출결 로그 UPSERT 완료 (${input.attendance_type})`,
              details: {
                attendance_log_id: upsertedData.id,
                student_id: input.student_id,
                attendance_type: input.attendance_type,
                status: input.status,
              },
              reference: {
                entity_type: 'attendance_log',
                entity_id: String(upsertedData.id),
              },
              duration_ms: durationMs,
            },
            session.user.id
          );
        }

        return upsertedData;
      }
    },
    onSuccess: () => {
      // [근본 수정] 헬퍼 함수를 사용하여 모든 관련 쿼리 무효화
      invalidateAttendanceLogsQueries(queryClient, tenantId);
    },
  });
}
