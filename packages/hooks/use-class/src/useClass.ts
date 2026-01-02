/**
 * useClass Hook
 *
 * React Query 기반 반/강사 관리 Hook
 * [불변 규칙] tenant 변경 시 invalidateQueries() 자동 발생
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import { toKST } from '@lib/date-utils';
import { useSession } from '@hooks/use-auth';
import { createExecutionAuditRecord } from '@hooks/use-student/src/execution-audit-utils';
import type {
  CreateClassInput,
  UpdateClassInput,
  ClassFilter,
  Class,
  Teacher,
  CreateTeacherInput,
  UpdateTeacherInput,
  TeacherFilter,
  ClassTeacher,
  AssignTeacherInput,
} from '@services/class-service';
import type { Person } from '@core/party';

/**
 * 반 목록 조회 함수 (Hook의 queryFn 로직을 재사용)
 * [불변 규칙] useQuery 내부에서도 이 함수를 사용하여 일관성 유지
 */
export async function fetchClasses(
  tenantId: string,
  filter?: ClassFilter
): Promise<Class[]> {
  if (!tenantId) return [];

  const response = await apiClient.get<Class>('academy_classes', {
    filters: (filter || {}) as Record<string, unknown>,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data || [];
}

/**
 * 반 목록 조회 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function useClasses(filter?: ClassFilter) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<Class[]>({
    queryKey: ['classes', tenantId, filter],
    queryFn: () => fetchClasses(tenantId!, filter),
    enabled: !!tenantId,
  });
}

/**
 * 반 상세 조회 Hook
 */
export function useClass(classId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['class', tenantId, classId],
    queryFn: async () => {
      if (!tenantId || !classId) return null;

      const response = await apiClient.get<Class>('academy_classes', {
        filters: { id: classId },
        limit: 1,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data?.[0] || null;
    },
    enabled: !!tenantId && !!classId,
  });
}

/**
 * 반 생성 Hook
 * [P0-2 수정] DB RPC 함수로 트랜잭션 처리하여 반 생성 + 강사 배정 atomic 보장
 */
export function useCreateClass() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (input: CreateClassInput) => {
      const startTime = Date.now();
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // P0-2: teacher_ids가 있는 경우 DB RPC 함수 사용 (트랜잭션 보장)
      if (input.teacher_ids && input.teacher_ids.length > 0) {
        const response = await apiClient.callRPC<Class>('create_class_with_teachers', {
          p_tenant_id: tenantId,
          p_name: input.name,
          p_subject: input.subject,
          p_grade: input.grade,
          p_day_of_week: input.day_of_week || 'monday',
          p_start_time: input.start_time || '14:00:00',
          p_end_time: input.end_time || '15:30:00',
          p_capacity: input.capacity || 20,
          p_room: input.room,
          p_notes: input.notes,
          p_status: input.status || 'active',
          p_teacher_ids: input.teacher_ids,
          p_created_by: session?.user?.id,
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
        if (session?.user?.id && response.data) {
          const durationMs = Date.now() - startTime;
          await createExecutionAuditRecord(
            {
              operation_type: 'class.register',
              status: 'success',
              summary: `${input.name || '반'} 등록 완료 (강사 ${input.teacher_ids.length}명 배정)`,
              details: {
                class_id: response.data.id,
                teacher_count: input.teacher_ids.length,
              },
              reference: {
                entity_type: 'class',
                entity_id: response.data.id,
              },
              duration_ms: durationMs,
            },
            session.user.id
          );
        }

        return response.data!;
      }

      // teacher_ids가 없는 경우 기존 방식 사용
      const response = await apiClient.post<Class>('academy_classes', {
        ...input,
        status: input.status || 'active',
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      if (session?.user?.id && response.data) {
        const durationMs = Date.now() - startTime;
        await createExecutionAuditRecord(
          {
            operation_type: 'class.register',
            status: 'success',
            summary: `${input.name || '반'} 등록 완료`,
            details: {
              class_id: response.data.id,
            },
            reference: {
              entity_type: 'class',
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
      void queryClient.invalidateQueries({ queryKey: ['classes', tenantId] });
    },
  });
}

/**
 * 반 수정 Hook
 */
export function useUpdateClass() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({
      classId,
      input,
    }: {
      classId: string;
      input: UpdateClassInput;
    }) => {
      const startTime = Date.now();
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const response = await apiClient.patch<Class>('academy_classes', classId, input as Record<string, unknown>);

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      if (session?.user?.id && response.data) {
        const durationMs = Date.now() - startTime;
        const changedFields = Object.keys(input).filter((key) => input[key as keyof UpdateClassInput] !== undefined);
        await createExecutionAuditRecord(
          {
            operation_type: 'class.update',
            status: 'success',
            summary: `${response.data.name || '반'} 정보 수정 완료 (${changedFields.join(', ')})`,
            details: {
              class_id: classId,
              changed_fields: changedFields,
            },
            reference: {
              entity_type: 'class',
              entity_id: classId,
            },
            duration_ms: durationMs,
          },
          session.user.id
        );
      }

      return response.data!;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['classes', tenantId] });
      void queryClient.invalidateQueries({
        queryKey: ['class', tenantId, data.id],
      });
    },
  });
}

/**
 * 반 삭제 Hook
 */
export function useDeleteClass() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (classId: string) => {
      const startTime = Date.now();
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // 소프트 삭제: status를 'archived'로 변경
      const response = await apiClient.patch<Class>('academy_classes', classId, {
        status: 'archived',
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      if (session?.user?.id && response.data) {
        const durationMs = Date.now() - startTime;
        await createExecutionAuditRecord(
          {
            operation_type: 'class.delete',
            status: 'success',
            summary: `${response.data.name || '반'} 삭제 완료 (archived)`,
            details: {
              class_id: classId,
              new_status: 'archived',
            },
            reference: {
              entity_type: 'class',
              entity_id: classId,
            },
            duration_ms: durationMs,
          },
          session.user.id
        );
      }

      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', tenantId] });
    },
  });
}

/**
 * 반별 통계 조회 Hook
 */
export function useClassStatistics(classId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['class-statistics', tenantId, classId],
    queryFn: async () => {
      if (!tenantId || !classId) return null;

      // TODO: 출결 테이블이 구현되면 실제 통계 계산
      // 현재는 기본값 반환
      const classData = await apiClient.get<Class>('academy_classes', {
        filters: { id: classId },
        limit: 1,
      });

      if (classData.error || !classData.data?.[0]) {
        throw new Error('Class not found');
      }

      const classInfo = classData.data[0];
      return {
        attendance_rate: 0,  // TODO: 출결 테이블 기반 계산
        capacity_rate: (classInfo.current_count / classInfo.capacity) * 100,
        late_rate: 0,  // TODO: 출결 테이블 기반 계산
      };
    },
    enabled: !!tenantId && !!classId,
  });
}

// ==================== 강사(Teacher) 관리 =====================

/**
 * 강사 목록 조회 Hook
 */
export function useTeachers(filter?: TeacherFilter) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['teachers', tenantId, filter],
    queryFn: async () => {
      if (!tenantId) return [];

      // persons + academy_teachers 조인하여 조회
      interface PersonWithAcademyTeachers extends Person {
        academy_teachers?: Array<Record<string, unknown>>;
      }
      const response = await apiClient.get<PersonWithAcademyTeachers[]>('persons', {
        select: `
          *,
          academy_teachers (
            employee_id,
            specialization,
            hire_date,
            status,
            profile_image_url,
            bio,
            notes,
            created_at,
            updated_at,
            created_by,
            updated_by
          )
        `,
        filters: { person_type: 'teacher' },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // 데이터 변환 persons + academy_teachers -> Teacher
      const personsData = response.data || [];
      let teachers: Teacher[] = personsData.map((person) => {
        const personWithTeachers = person as unknown as Person & { academy_teachers?: Array<Record<string, unknown>> };
        const teacherData = personWithTeachers.academy_teachers?.[0] || {};
        return {
          id: personWithTeachers.id,
          tenant_id: personWithTeachers.tenant_id,
          name: personWithTeachers.name,
          email: personWithTeachers.email,
          phone: personWithTeachers.phone,
          address: personWithTeachers.address,
          employee_id: teacherData.employee_id,
          specialization: teacherData.specialization,
          hire_date: teacherData.hire_date,
          status: teacherData.status || 'active',
          profile_image_url: teacherData.profile_image_url,
          bio: teacherData.bio,
          notes: teacherData.notes,
          created_at: personWithTeachers.created_at,
          updated_at: personWithTeachers.updated_at,
          created_by: teacherData.created_by,
          updated_by: teacherData.updated_by,
        } as Teacher;
      });

      // 클라이언트 측 필터링 (useStudents Hook과 동일한 패턴)
      if (filter?.status) {
        const statusArray = Array.isArray(filter.status) ? filter.status : [filter.status];
        teachers = teachers.filter((t) => statusArray.includes(t.status));
      }

      if (filter?.search) {
        const searchLower = filter.search.toLowerCase();
        teachers = teachers.filter((t) =>
          t.name?.toLowerCase().includes(searchLower)
        );
      }

      if (filter?.specialization) {
        teachers = teachers.filter((t) =>
          t.specialization?.toLowerCase().includes(filter.specialization!.toLowerCase())
        );
      }

      return teachers;
    },
    enabled: !!tenantId,
  });
}

/**
 * 강사 상세 조회 Hook
 */
export function useTeacher(teacherId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['teacher', tenantId, teacherId],
    queryFn: async () => {
      if (!tenantId || !teacherId) return null;

      interface PersonWithAcademyTeachers extends Person {
        academy_teachers?: Array<Record<string, unknown>>;
      }
      const response = await apiClient.get<PersonWithAcademyTeachers[]>('persons', {
        select: `
          *,
          academy_teachers (
            employee_id,
            specialization,
            hire_date,
            status,
            profile_image_url,
            bio,
            notes,
            created_at,
            updated_at,
            created_by,
            updated_by
          )
        `,
        filters: { id: teacherId, person_type: 'teacher' },
        limit: 1,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const person = response.data?.[0];
      if (!person) return null;

      const personWithTeachers = person as unknown as Person & { academy_teachers?: Array<Record<string, unknown>> };
      const teacherData = personWithTeachers.academy_teachers?.[0] || {};
      return {
        id: personWithTeachers.id,
        tenant_id: personWithTeachers.tenant_id,
        name: personWithTeachers.name,
        email: personWithTeachers.email,
        phone: personWithTeachers.phone,
        address: personWithTeachers.address,
        employee_id: teacherData.employee_id,
        specialization: teacherData.specialization,
        hire_date: teacherData.hire_date,
        status: teacherData.status || 'active',
        profile_image_url: teacherData.profile_image_url,
        bio: teacherData.bio,
        notes: teacherData.notes,
        created_at: personWithTeachers.created_at,
        updated_at: personWithTeachers.updated_at,
        created_by: teacherData.created_by,
        updated_by: teacherData.updated_by,
      } as Teacher;
    },
    enabled: !!tenantId && !!teacherId,
  });
}

/**
 * 강사 생성 Hook
 * [P0-2 수정] DB RPC 함수로 트랜잭션 처리하여 persons + academy_teachers atomic 보장
 */
export function useCreateTeacher() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (input: CreateTeacherInput) => {
      const startTime = Date.now();
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // P0-2: DB RPC 함수 사용 (트랜잭션 보장)
      const response = await apiClient.callRPC<Teacher>('create_teacher', {
        p_tenant_id: tenantId,
        p_name: input.name,
        p_email: input.email,
        p_phone: input.phone,
        p_address: input.address,
        p_employee_id: input.employee_id,
        p_specialization: input.specialization,
        p_hire_date: input.hire_date,
        p_status: input.status || 'active',
        p_profile_image_url: input.profile_image_url,
        p_bio: input.bio,
        p_notes: input.notes,
        p_created_by: session?.user?.id,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      if (session?.user?.id && response.data) {
        const durationMs = Date.now() - startTime;
        await createExecutionAuditRecord(
          {
            operation_type: 'teacher.register',
            status: 'success',
            summary: `${input.name} 강사 등록 완료`,
            details: {
              teacher_id: response.data.id,
            },
            reference: {
              entity_type: 'teacher',
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
      queryClient.invalidateQueries({ queryKey: ['teachers', tenantId] });
    },
  });
}

/**
 * 강사 수정 Hook
 */
export function useUpdateTeacher() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({
      teacherId,
      input,
    }: {
      teacherId: string;
      input: UpdateTeacherInput;
    }) => {
      const startTime = Date.now();
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // 1. persons 테이블 업데이트
      const personUpdate: Partial<{ name?: string; email?: string; phone?: string; address?: string }> = {};
      if (input.name !== undefined) personUpdate.name = input.name;
      if (input.email !== undefined) personUpdate.email = input.email;
      if (input.phone !== undefined) personUpdate.phone = input.phone;
      if (input.address !== undefined) personUpdate.address = input.address;

      if (Object.keys(personUpdate).length > 0) {
        const personResponse = await apiClient.patch('persons', teacherId, personUpdate);
        if (personResponse.error) {
          throw new Error(personResponse.error.message);
        }
      }

      // 2. academy_teachers 테이블 업데이트
      const teacherUpdate: Partial<Teacher> = {};
      if (input.employee_id !== undefined) teacherUpdate.employee_id = input.employee_id;
      if (input.specialization !== undefined) teacherUpdate.specialization = input.specialization;
      if (input.hire_date !== undefined) teacherUpdate.hire_date = input.hire_date;
      if (input.status !== undefined) teacherUpdate.status = input.status;
      if (input.profile_image_url !== undefined) teacherUpdate.profile_image_url = input.profile_image_url;
      if (input.bio !== undefined) teacherUpdate.bio = input.bio;
      if (input.notes !== undefined) teacherUpdate.notes = input.notes;

      if (Object.keys(teacherUpdate).length > 0) {
        // academy_teachers는 person_id를 PK로 사용
        const teacherResponse = await apiClient.get('academy_teachers', {
          filters: { person_id: teacherId },
          limit: 1,
        });

        if (teacherResponse.error) {
          throw new Error(teacherResponse.error.message);
        }

        const academyTeacher = teacherResponse.data?.[0] as { person_id?: string } | undefined;
        if (academyTeacher && academyTeacher.person_id) {
          const updateResponse = await apiClient.patch('academy_teachers', academyTeacher.person_id, teacherUpdate as Record<string, unknown>);
          if (updateResponse.error) {
            throw new Error(updateResponse.error.message);
          }
        }
      }

      // 3. 업데이트된 데이터 조회하여 반환
      interface PersonWithAcademyTeachers extends Person {
        academy_teachers?: Array<Record<string, unknown>>;
      }
      const teacherResponse = await apiClient.get<PersonWithAcademyTeachers[]>('persons', {
        select: `
          *,
          academy_teachers (
            employee_id,
            specialization,
            hire_date,
            status,
            profile_image_url,
            bio,
            notes,
            created_at,
            updated_at,
            created_by,
            updated_by
          )
        `,
        filters: { id: teacherId, person_type: 'teacher' },
        limit: 1,
      });

      if (teacherResponse.error) {
        throw new Error(teacherResponse.error.message);
      }

      const person = teacherResponse.data?.[0];
      if (!person) {
        throw new Error('Teacher not found');
      }

      const personWithTeachers = person as unknown as Person & { academy_teachers?: Array<Record<string, unknown>> };
      const teacherData = personWithTeachers.academy_teachers?.[0] || {};
      const teacher = {
        id: personWithTeachers.id,
        tenant_id: personWithTeachers.tenant_id,
        name: personWithTeachers.name,
        email: personWithTeachers.email,
        phone: personWithTeachers.phone,
        address: personWithTeachers.address,
        employee_id: teacherData.employee_id,
        specialization: teacherData.specialization,
        hire_date: teacherData.hire_date,
        status: teacherData.status || 'active',
        profile_image_url: teacherData.profile_image_url,
        bio: teacherData.bio,
        notes: teacherData.notes,
        created_at: personWithTeachers.created_at,
        updated_at: personWithTeachers.updated_at,
        created_by: teacherData.created_by,
        updated_by: teacherData.updated_by,
      } as Teacher;

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      if (session?.user?.id) {
        const durationMs = Date.now() - startTime;
        const changedFields = Object.keys(input).filter((key) => input[key as keyof UpdateTeacherInput] !== undefined);
        await createExecutionAuditRecord(
          {
            operation_type: 'teacher.update',
            status: 'success',
            summary: `${teacher.name} 강사 정보 수정 완료 (${changedFields.join(', ')})`,
            details: {
              teacher_id: teacherId,
              changed_fields: changedFields,
            },
            reference: {
              entity_type: 'teacher',
              entity_id: teacherId,
            },
            duration_ms: durationMs,
          },
          session.user.id
        );
      }

      return teacher;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['teachers', tenantId] });
      queryClient.invalidateQueries({
        queryKey: ['teacher', tenantId, data.id],
      });
    },
  });
}

/**
 * 강사 삭제 Hook
 * [P1-3 수정] DB RPC 함수로 소프트 삭제 최적화 (2번 쿼리 → 1번)
 */
export function useDeleteTeacher() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (teacherId: string) => {
      const startTime = Date.now();
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // P1-3: DB RPC 함수 사용 (쿼리 횟수 감소)
      const response = await apiClient.callRPC('delete_teacher', {
        p_tenant_id: tenantId,
        p_teacher_id: teacherId,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      if (session?.user?.id) {
        const durationMs = Date.now() - startTime;
        await createExecutionAuditRecord(
          {
            operation_type: 'teacher.delete',
            status: 'success',
            summary: `강사 퇴직 처리 완료`,
            details: {
              teacher_id: teacherId,
              new_status: 'resigned',
            },
            reference: {
              entity_type: 'teacher',
              entity_id: teacherId,
            },
            duration_ms: durationMs,
          },
          session.user.id
        );
      }

      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers', tenantId] });
    },
  });
}

// ==================== 반/강사 연결 관리 =====================

/**
 * 반별 강사 목록 조회 Hook
 */
export function useClassTeachers(classId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['class-teachers', tenantId, classId],
    queryFn: async () => {
      if (!tenantId || !classId) return [];

      const response = await apiClient.get<ClassTeacher>('class_teachers', {
        filters: { class_id: classId, is_active: true },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data || [];
    },
    enabled: !!tenantId && !!classId,
  });
}

/**
 * 강사 배정 Hook
 */
export function useAssignTeacher() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (input: AssignTeacherInput) => {
      const startTime = Date.now();
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // 기술문서 5-2: KST 기준 날짜 처리
      const response = await apiClient.post<ClassTeacher>('class_teachers', {
        ...input,
        assigned_at: input.assigned_at || toKST().format('YYYY-MM-DD'),
        is_active: true,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      if (session?.user?.id && response.data) {
        const durationMs = Date.now() - startTime;
        await createExecutionAuditRecord(
          {
            operation_type: 'class.assign-teacher',
            status: 'success',
            summary: `강사 배정 완료 (class_id: ${input.class_id}, teacher_id: ${input.teacher_id})`,
            details: {
              class_id: input.class_id,
              teacher_id: input.teacher_id,
            },
            reference: {
              entity_type: 'class',
              entity_id: input.class_id,
            },
            duration_ms: durationMs,
          },
          session.user.id
        );
      }

      return response.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['class-teachers', tenantId, data.class_id] });
      queryClient.invalidateQueries({ queryKey: ['classes', tenantId] });
    },
  });
}

/**
 * 강사 배정 제거 Hook
 */
export function useUnassignTeacher() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({
      classId,
      teacherId,
    }: {
      classId: string;
      teacherId: string;
    }) => {
      const startTime = Date.now();
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // class_teachers에서 해당 레코드 찾기
      const findResponse = await apiClient.get('class_teachers', {
        filters: { class_id: classId, teacher_id: teacherId, is_active: true },
        limit: 1,
      });

      if (findResponse.error || !findResponse.data?.[0]) {
        throw new Error('Class teacher assignment not found');
      }

      const assignment = findResponse.data[0] as { id?: string } | undefined;
      if (!assignment || !assignment.id) {
        throw new Error('Assignment not found');
      }

      // 기술문서 5-2: KST 기준 날짜 처리
      const response = await apiClient.patch('class_teachers', assignment.id, {
        is_active: false,
        unassigned_at: toKST().format('YYYY-MM-DD'),
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      if (session?.user?.id) {
        const durationMs = Date.now() - startTime;
        await createExecutionAuditRecord(
          {
            operation_type: 'class.unassign-teacher',
            status: 'success',
            summary: `강사 배정 제거 완료 (class_id: ${classId}, teacher_id: ${teacherId})`,
            details: {
              class_id: classId,
              teacher_id: teacherId,
            },
            reference: {
              entity_type: 'class',
              entity_id: classId,
            },
            duration_ms: durationMs,
          },
          session.user.id
        );
      }

      return response.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['class-teachers', tenantId, variables.classId] });
      queryClient.invalidateQueries({ queryKey: ['classes', tenantId] });
    },
  });
}
