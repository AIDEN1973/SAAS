/**
 * useStudentStats Hook
 *
 * React Query 기반 학생 통계 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 * [불변 규칙] RPC 함수 호출: student_stats(p_tenant_id)
 */

import { useQuery } from '@tanstack/react-query';
import { getApiContext } from '@api-sdk/core';
import { apiClient } from '@api-sdk/core';

// React Query 시간 설정 상수 (하드코딩 금지)
const STALE_TIME_ONE_MINUTE = 60000; // 1분
const GC_TIME_FIVE_MINUTES = 300000; // 5분
const REFETCH_INTERVAL_FIVE_MINUTES = 300000; // 5분

export interface StudentStats {
  total: number;
  active: number;
  inactive: number;
  new_this_month: number;
  by_status: Record<string, number>;
}

export interface AttendanceStats {
  total_students: number;
  present: number;
  late: number;
  absent: number;
  not_checked: number;
  attendance_rate: number;
}

export interface StudentAlerts {
  risk_count: number;
  absent_count: number;
  consultation_pending_count: number;
}

export interface ConsultationStats {
  this_month_count: number;
  pending_count: number;
  urgent_count: number;
}

/**
 * 학생 통계 조회 함수
 */
export async function fetchStudentStats(tenantId: string): Promise<StudentStats> {
  const response = await apiClient.callRPC<StudentStats[]>('student_stats', {
    p_tenant_id: tenantId,
  });

  if (response.error) {
    // ✅ 더 자세한 에러 정보 로깅
    console.error('[fetchStudentStats] RPC 호출 실패:', {
      function: 'student_stats',
      tenantId,
      error: response.error,
      message: response.error.message,
      code: response.error.code,
    });
    throw new Error(`Failed to fetch student stats: ${response.error.message}${response.error.code ? ` (${response.error.code})` : ''}`);
  }

  // ✅ RETURNS TABLE은 항상 배열을 반환하므로 첫 번째 요소 사용
  if (!response.data || response.data.length === 0) {
    throw new Error('Student stats not found');
  }

  return response.data[0];
}

/**
 * 학생 통계 Hook
 */
export function useStudentStats() {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<StudentStats>({
    queryKey: ['student-stats', tenantId],
    queryFn: () => fetchStudentStats(tenantId!),
    enabled: !!tenantId,
    staleTime: STALE_TIME_ONE_MINUTE,
    gcTime: GC_TIME_FIVE_MINUTES,
  });
}

/**
 * 출석 통계 조회 함수
 */
export async function fetchAttendanceStats(
  tenantId: string,
  date: Date
): Promise<AttendanceStats> {
  // KST 기준 날짜로 변환
  const kstDate = new Date(
    date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' })
  );
  const dateStr = kstDate.toISOString().split('T')[0]; // YYYY-MM-DD

  const response = await apiClient.callRPC<AttendanceStats[]>('attendance_stats', {
    p_tenant_id: tenantId,
    p_date: dateStr,
  });

  if (response.error) {
    // ✅ 더 자세한 에러 정보 로깅
    console.error('[fetchAttendanceStats] RPC 호출 실패:', {
      function: 'attendance_stats',
      tenantId,
      date: dateStr,
      error: response.error,
      message: response.error.message,
      code: response.error.code,
    });
    throw new Error(`Failed to fetch attendance stats: ${response.error.message}${response.error.code ? ` (${response.error.code})` : ''}`);
  }

  // ✅ RETURNS TABLE은 항상 배열을 반환하므로 첫 번째 요소 사용
  if (!response.data || response.data.length === 0) {
    throw new Error('Attendance stats not found');
  }

  return response.data[0];
}

/**
 * 출석 통계 Hook
 */
export function useAttendanceStats(date: Date) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<AttendanceStats>({
    queryKey: ['attendance-stats', tenantId, date.toISOString().split('T')[0]],
    queryFn: () => fetchAttendanceStats(tenantId!, date),
    enabled: !!tenantId && !!date,
    staleTime: STALE_TIME_ONE_MINUTE,
    gcTime: GC_TIME_FIVE_MINUTES,
  });
}

/**
 * 학생 알림 요약 조회 함수
 */
export async function fetchStudentAlerts(tenantId: string): Promise<StudentAlerts> {
  const response = await apiClient.callRPC<StudentAlerts[]>('student_alerts_summary', {
    p_tenant_id: tenantId,
  });

  if (response.error) {
    // ✅ 더 자세한 에러 정보 로깅
    console.error('[fetchStudentAlerts] RPC 호출 실패:', {
      function: 'student_alerts_summary',
      tenantId,
      error: response.error,
      message: response.error.message,
      code: response.error.code,
    });
    throw new Error(`Failed to fetch student alerts: ${response.error.message}${response.error.code ? ` (${response.error.code})` : ''}`);
  }

  // ✅ RETURNS TABLE은 항상 배열을 반환하므로 첫 번째 요소 사용
  if (!response.data || response.data.length === 0) {
    throw new Error('Student alerts not found');
  }

  return response.data[0];
}

/**
 * 학생 알림 요약 Hook
 */
export function useStudentAlerts() {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<StudentAlerts>({
    queryKey: ['student-alerts', tenantId],
    queryFn: () => fetchStudentAlerts(tenantId!),
    enabled: !!tenantId,
    staleTime: STALE_TIME_ONE_MINUTE,
    gcTime: GC_TIME_FIVE_MINUTES,
    refetchInterval: REFETCH_INTERVAL_FIVE_MINUTES,
  });
}

/**
 * 상담 통계 조회 함수
 */
export async function fetchConsultationStats(tenantId: string): Promise<ConsultationStats> {
  const response = await apiClient.callRPC<ConsultationStats[]>('consultation_stats', {
    p_tenant_id: tenantId,
  });

  if (response.error) {
    console.error('[fetchConsultationStats] RPC 호출 실패:', {
      function: 'consultation_stats',
      tenantId,
      error: response.error,
      message: response.error.message,
      code: response.error.code,
    });
    throw new Error(`Failed to fetch consultation stats: ${response.error.message}${response.error.code ? ` (${response.error.code})` : ''}`);
  }

  if (!response.data || response.data.length === 0) {
    throw new Error('Consultation stats not found');
  }

  return response.data[0];
}

/**
 * 상담 통계 Hook
 */
export function useConsultationStats() {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<ConsultationStats>({
    queryKey: ['consultation-stats', tenantId],
    queryFn: () => fetchConsultationStats(tenantId!),
    enabled: !!tenantId,
    staleTime: STALE_TIME_ONE_MINUTE,
    gcTime: GC_TIME_FIVE_MINUTES,
  });
}

