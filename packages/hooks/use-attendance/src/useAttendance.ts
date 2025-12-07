/**
 * Attendance Hooks
 * 
 * 출결 관�?React Query ??
 * [불�? 규칙] ?�라?�언?�는 Hooks�??�해?�만 ?�이???�근
 * [불�? 규칙] api-sdk�??�해?�만 ?�이???�청
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import type {
  AttendanceLog,
  CreateAttendanceLogInput,
  AttendanceFilter,
} from '@services/attendance-service';

/**
 * 출결 로그 조회 ??
 * [불�? 규칙] Zero-Trust: tenantId??Context?�서 ?�동?�로 가?�옴
 */
export function useAttendanceLogs(filter?: AttendanceFilter) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['attendance-logs', tenantId, filter],
    queryFn: async () => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // ?�터�?Supabase 쿼리 ?�식?�로 변??
      const filters: Record<string, any> = {};
      if (filter?.student_id) filters.student_id = filter.student_id;
      if (filter?.class_id) filters.class_id = filter.class_id;
      if (filter?.attendance_type) filters.attendance_type = filter.attendance_type;
      if (filter?.status) filters.status = filter.status;

      const response = await apiClient.get<AttendanceLog>('attendance_logs', {
        filters,
        orderBy: { column: 'occurred_at', ascending: false },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      let logs = response.data || [];

      // ?�짜 ?�터 (?�라?�언??측에??처리)
      if (filter?.date_from) {
        const dateFrom = new Date(filter.date_from);
        logs = logs.filter((log) => new Date(log.occurred_at) >= dateFrom);
      }
      if (filter?.date_to) {
        const dateTo = new Date(filter.date_to);
        dateTo.setHours(23, 59, 59, 999); // ?�루 ?�까지
        logs = logs.filter((log) => new Date(log.occurred_at) <= dateTo);
      }

      return logs;
    },
    enabled: !!tenantId,
  });
}

/**
 * ?�생�?출결 로그 조회 ??
 */
export function useAttendanceLogsByStudent(
  studentId: string,
  filter?: Omit<AttendanceFilter, 'student_id'>
) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['attendance-logs', tenantId, 'student', studentId, filter],
    queryFn: async () => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const filters: Record<string, any> = { student_id: studentId };
      if (filter?.class_id) filters.class_id = filter.class_id;
      if (filter?.attendance_type) filters.attendance_type = filter.attendance_type;
      if (filter?.status) filters.status = filter.status;

      const response = await apiClient.get<AttendanceLog>('attendance_logs', {
        filters,
        orderBy: { column: 'occurred_at', ascending: false },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      let logs = response.data || [];

      // ?�짜 ?�터 (?�라?�언??측에??처리)
      if (filter?.date_from) {
        const dateFrom = new Date(filter.date_from);
        logs = logs.filter((log) => new Date(log.occurred_at) >= dateFrom);
      }
      if (filter?.date_to) {
        const dateTo = new Date(filter.date_to);
        dateTo.setHours(23, 59, 59, 999);
        logs = logs.filter((log) => new Date(log.occurred_at) <= dateTo);
      }

      return logs;
    },
    enabled: !!tenantId && !!studentId,
  });
}

/**
 * 반별 출결 로그 조회 ??
 */
export function useAttendanceLogsByClass(
  classId: string,
  filter?: Omit<AttendanceFilter, 'class_id'>
) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['attendance-logs', tenantId, 'class', classId, filter],
    queryFn: async () => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const filters: Record<string, any> = { class_id: classId };
      if (filter?.student_id) filters.student_id = filter.student_id;
      if (filter?.attendance_type) filters.attendance_type = filter.attendance_type;
      if (filter?.status) filters.status = filter.status;

      const response = await apiClient.get<AttendanceLog>('attendance_logs', {
        filters,
        orderBy: { column: 'occurred_at', ascending: false },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      let logs = response.data || [];

      // ?�짜 ?�터 (?�라?�언??측에??처리)
      if (filter?.date_from) {
        const dateFrom = new Date(filter.date_from);
        logs = logs.filter((log) => new Date(log.occurred_at) >= dateFrom);
      }
      if (filter?.date_to) {
        const dateTo = new Date(filter.date_to);
        dateTo.setHours(23, 59, 59, 999);
        logs = logs.filter((log) => new Date(log.occurred_at) <= dateTo);
      }

      return logs;
    },
    enabled: !!tenantId && !!classId,
  });
}

/**
 * 출결 로그 ?�성 ??
 */
export function useCreateAttendanceLog() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async (input: CreateAttendanceLogInput) => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const response = await apiClient.post<AttendanceLog>('attendance_logs', {
        student_id: input.student_id,
        class_id: input.class_id,
        occurred_at: input.occurred_at,
        attendance_type: input.attendance_type,
        status: input.status,
        notes: input.notes,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data!;
    },
    onSuccess: () => {
      // 출결 로그 목록 쿼리 무효??
      queryClient.invalidateQueries({ queryKey: ['attendance-logs', tenantId] });
    },
  });
}

/**
 * 출결 로그 ??�� ??
 */
export function useDeleteAttendanceLog() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async (logId: string) => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const response = await apiClient.delete('attendance_logs', logId);

      if (response.error) {
        throw new Error(response.error.message);
      }
    },
    onSuccess: () => {
      // 출결 로그 목록 쿼리 무효??
      queryClient.invalidateQueries({ queryKey: ['attendance-logs', tenantId] });
    },
  });
}

