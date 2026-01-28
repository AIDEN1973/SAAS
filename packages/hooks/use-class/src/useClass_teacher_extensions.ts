/**
 * Teacher Statistics and Assigned Classes Hooks
 * P1-1, P1-3: 강사별 담당 수업 목록 및 통계
 *
 * [최적화] get_teachers_with_stats RPC를 통해 N+1 문제 해결
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import type { Class, Teacher, TeacherFilter, TeacherPosition, TeacherStatus } from '@services/class-service';

// ==================== P1-3: 강사 통계 =====================

export interface TeacherStatistics {
  total_classes: number;
  total_students: number;
  main_teacher_classes: number;
  assistant_classes: number;
}

/**
 * 강사 통계 조회 Hook
 * P1-3: 담당 수업 수, 담당 학생 수, 담임/부담임 구분
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

// ==================== P1-1: 강사별 담당 수업 목록 =====================

export interface TeacherClassAssignment {
  class_id: string;
  teacher_id: string;
  role: 'teacher' | 'assistant';
  assigned_at: string;
  is_active: boolean;
  academy_classes: Class;
}

/**
 * 강사별 담당 수업 목록 조회 Hook
 * P1-1: 강사 카드에 담당 수업 정보 표시
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

// ==================== [최적화] 통계 포함 강사 목록 조회 =====================

/**
 * 통계가 포함된 강사 타입
 * N+1 문제 해결을 위해 한 번의 쿼리로 강사 정보와 통계를 함께 조회
 */
export interface TeacherWithStats extends Omit<Teacher, 'position'> {
  position: TeacherPosition;
  total_classes: number;
  total_students: number;
  main_teacher_classes: number;
  assistant_classes: number;
}

/**
 * RPC 응답 타입 (DB에서 반환하는 raw 데이터)
 */
interface TeacherWithStatsRaw {
  id: string;
  tenant_id: string;
  person_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  teacher_position: string | null;
  specialization: string | null;
  employee_id: string | null;
  hire_date: string | null;
  status: string;
  login_id: string | null;
  user_id: string | null;
  profile_image_url: string | null;
  bio: string | null;
  notes: string | null;
  pay_type: string | null;
  base_salary: number | null;
  hourly_rate: number | null;
  bank_name: string | null;
  bank_account: string | null;
  salary_notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  total_classes: number;
  total_students: number;
  main_teacher_classes: number;
  assistant_classes: number;
}

/**
 * 통계가 포함된 강사 목록 조회 Hook
 * [최적화] 테이블 조인으로 N+1 문제 해결
 *
 * 기존 useTeachers + useTeacherStatistics 조합 대신 이 훅을 사용하면
 * 강사 수에 관계없이 2회의 쿼리로 모든 데이터를 가져옵니다.
 * (강사 목록 1회 + 통계 집계 1회)
 */
export function useTeachersWithStats(filter?: TeacherFilter) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['teachers-with-stats', tenantId, filter],
    queryFn: async () => {
      if (!tenantId) return [];

      // 1. 강사 목록 조회 (persons JOIN)
      const teachersResponse = await apiClient.get<{
        id: string;
        tenant_id: string;
        person_id: string;
        position: string;
        specialization: string | null;
        employee_id: string | null;
        hire_date: string | null;
        status: string;
        login_id: string | null;
        user_id: string | null;
        profile_image_url: string | null;
        bio: string | null;
        notes: string | null;
        pay_type: string | null;
        base_salary: number | null;
        hourly_rate: number | null;
        bank_name: string | null;
        bank_account: string | null;
        salary_notes: string | null;
        created_at: string;
        updated_at: string;
        created_by: string | null;
        updated_by: string | null;
        persons: {
          id: string;
          name: string;
          phone: string | null;
          email: string | null;
          address: string | null;
        };
      }>('academy_teachers', {
        select: `
          id,
          tenant_id,
          person_id,
          position,
          specialization,
          employee_id,
          hire_date,
          status,
          login_id,
          user_id,
          profile_image_url,
          bio,
          notes,
          pay_type,
          base_salary,
          hourly_rate,
          bank_name,
          bank_account,
          salary_notes,
          created_at,
          updated_at,
          created_by,
          updated_by,
          persons (
            id,
            name,
            phone,
            email,
            address
          )
        `,
        filters: {
          deleted_at: null,
          ...(filter?.status && !Array.isArray(filter.status) ? { status: filter.status } : {}),
        },
        orderBy: { column: 'created_at', ascending: false },
      });

      if (teachersResponse.error) {
        throw new Error(teachersResponse.error.message);
      }

      const rawTeachers = teachersResponse.data || [];

      // 검색 필터 적용 (클라이언트 측)
      let filteredTeachers = rawTeachers;
      if (filter?.search?.trim()) {
        const searchLower = filter.search.trim().toLowerCase();
        filteredTeachers = rawTeachers.filter((t) =>
          t.persons?.name?.toLowerCase().includes(searchLower)
        );
      }

      // status 배열 필터 적용
      if (filter?.status && Array.isArray(filter.status)) {
        const statusArray = filter.status;
        filteredTeachers = filteredTeachers.filter((t) => statusArray.includes(t.status as TeacherStatus));
      }

      // 2. 통계 조회 (class_teachers + class_enrollments)
      const teacherIds = filteredTeachers.map((t) => t.id);

      // 통계 맵 초기화
      const statsMap: Record<string, {
        total_classes: number;
        total_students: number;
        main_teacher_classes: number;
        assistant_classes: number;
      }> = {};

      teacherIds.forEach((id) => {
        statsMap[id] = {
          total_classes: 0,
          total_students: 0,
          main_teacher_classes: 0,
          assistant_classes: 0,
        };
      });

      if (teacherIds.length > 0) {
        // class_teachers에서 담당 수업 정보 조회
        const classTeachersResponse = await apiClient.get<{
          teacher_id: string;
          class_id: string;
          role: 'teacher' | 'assistant';
        }>('class_teachers', {
          select: 'teacher_id, class_id, role',
          filters: {
            teacher_id: teacherIds,
            is_active: true,
          },
        });

        if (classTeachersResponse.data) {
          const classTeachers = classTeachersResponse.data;

          // 수업별 학생 수 조회 (테이블명: student_classes, 상태 컬럼: is_active)
          const classIds = [...new Set(classTeachers.map((ct) => ct.class_id))];

          const enrollmentsMap: Record<string, number> = {};
          if (classIds.length > 0) {
            const enrollmentsResponse = await apiClient.get<{
              class_id: string;
              student_id: string;
            }>('student_classes', {
              select: 'class_id, student_id',
              filters: {
                class_id: classIds,
                is_active: true,
              },
            });

            if (enrollmentsResponse.data) {
              enrollmentsResponse.data.forEach((e) => {
                enrollmentsMap[e.class_id] = (enrollmentsMap[e.class_id] || 0) + 1;
              });
            }
          }

          // 강사별 통계 집계
          classTeachers.forEach((ct) => {
            const stats = statsMap[ct.teacher_id];
            if (stats) {
              stats.total_classes++;
              stats.total_students += enrollmentsMap[ct.class_id] || 0;
              if (ct.role === 'teacher') {
                stats.main_teacher_classes++;
              } else {
                stats.assistant_classes++;
              }
            }
          });
        }
      }

      // 최종 데이터 변환
      const teachers: TeacherWithStats[] = filteredTeachers.map((raw) => ({
        id: raw.id,
        person_id: raw.person_id,
        tenant_id: raw.tenant_id,
        name: raw.persons?.name || '',
        email: raw.persons?.email || undefined,
        phone: raw.persons?.phone || undefined,
        address: raw.persons?.address || undefined,
        position: (raw.position || 'teacher') as TeacherPosition,
        specialization: raw.specialization || undefined,
        employee_id: raw.employee_id || undefined,
        hire_date: raw.hire_date || undefined,
        status: (raw.status || 'active') as TeacherStatus,
        login_id: raw.login_id || undefined,
        user_id: raw.user_id || undefined,
        profile_image_url: raw.profile_image_url || undefined,
        bio: raw.bio || undefined,
        notes: raw.notes || undefined,
        pay_type: raw.pay_type || undefined,
        base_salary: raw.base_salary || undefined,
        hourly_rate: raw.hourly_rate || undefined,
        bank_name: raw.bank_name || undefined,
        bank_account: raw.bank_account || undefined,
        salary_notes: raw.salary_notes || undefined,
        created_at: raw.created_at,
        updated_at: raw.updated_at,
        created_by: raw.created_by || undefined,
        updated_by: raw.updated_by || undefined,
        total_classes: statsMap[raw.id]?.total_classes || 0,
        total_students: statsMap[raw.id]?.total_students || 0,
        main_teacher_classes: statsMap[raw.id]?.main_teacher_classes || 0,
        assistant_classes: statsMap[raw.id]?.assistant_classes || 0,
      }));

      // 이름순 정렬
      teachers.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

      return teachers;
    },
    enabled: !!tenantId,
  });
}
