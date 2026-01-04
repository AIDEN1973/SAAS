/**
 * Teacher Statistics and Assigned Classes Hooks
 * P1-1, P1-3: 강사별 담당 반 목록 및 통계
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import type { Class } from '@services/class-service';

// ==================== P1-3: 강사 통계 =====================

export interface TeacherStatistics {
  total_classes: number;
  total_students: number;
  main_teacher_classes: number;
  assistant_classes: number;
}

/**
 * 강사 통계 조회 Hook
 * P1-3: 담당 반 수, 담당 학생 수, 담임/부담임 구분
 */
export function useTeacherStatistics(teacherId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['teacher-statistics', tenantId, teacherId],
    queryFn: async () => {
      if (!tenantId || !teacherId) return null;

      const response = await apiClient.callRPC<TeacherStatistics>('get_teacher_statistics', {
        p_tenant_id: tenantId,
        p_teacher_id: teacherId,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data!;
    },
    enabled: !!tenantId && !!teacherId,
  });
}

// ==================== P1-1: 강사별 담당 반 목록 =====================

export interface TeacherClassAssignment {
  class_id: string;
  teacher_id: string;
  role: 'teacher' | 'assistant';
  assigned_at: string;
  is_active: boolean;
  academy_classes: Class;
}

/**
 * 강사별 담당 반 목록 조회 Hook
 * P1-1: 강사 카드에 담당 반 정보 표시
 */
export function useTeacherClasses(teacherId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<TeacherClassAssignment[]>({
    queryKey: ['teacher-classes', tenantId, teacherId],
    queryFn: async () => {
      if (!tenantId || !teacherId) return [];

      interface ClassTeacherWithClass {
        class_id: string;
        teacher_id: string;
        role: 'teacher' | 'assistant';
        assigned_at: string;
        is_active: boolean;
        academy_classes?: {
          id: string;
          tenant_id: string;
          name: string;
          subject?: string;
          grade?: string;
          day_of_week: string;
          start_time: string;
          end_time: string;
          capacity: number;
          current_count: number;
          room?: string;
          color?: string;
          status: string;
        };
      }

      const response = await apiClient.get<ClassTeacherWithClass>('class_teachers', {
        filters: { teacher_id: teacherId, is_active: true },
        select: `
          class_id,
          teacher_id,
          role,
          assigned_at,
          is_active,
          academy_classes (
            id,
            tenant_id,
            name,
            subject,
            grade,
            day_of_week,
            start_time,
            end_time,
            capacity,
            current_count,
            room,
            color,
            status
          )
        `,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data || [];
      return data.map((ct: ClassTeacherWithClass) => ({
        class_id: ct.class_id,
        teacher_id: ct.teacher_id,
        role: ct.role,
        assigned_at: ct.assigned_at,
        is_active: ct.is_active,
        academy_classes: ct.academy_classes as Class,
      }));
    },
    enabled: !!tenantId && !!teacherId,
  });
}
