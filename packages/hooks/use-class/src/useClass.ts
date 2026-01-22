/**
 * useClass Hook
 *
 * React Query 기반 수업/강사 관리 Hook
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
  ScheduleConflictResult,
  DayOfWeek,
} from '@services/class-service';
import type { Person } from '@core/party';

/**
 * 수업 목록 조회 함수 (Hook의 queryFn 로직을 재사용)
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
 * 수업 목록 조회 Hook
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
 * 수업 상세 조회 Hook
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
 * 수업 생성 Hook
 * [P0-2 수정] DB RPC 함수로 트랜잭션 처리하여 수업 생성 + 강사 배정 atomic 보장
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
          p_color: null,  // 색상은 RPC 함수에서 자동 할당
          p_room: null,   // room 필드는 CreateClassInput에서 제거됨
          p_notes: input.notes,
          p_status: input.status || 'active',
          p_teacher_ids: input.teacher_ids,
          p_teacher_roles: null,  // 기본값: 모두 'teacher' 역할
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
              summary: `${input.name || '수업'} 등록 완료 (강사 ${input.teacher_ids.length}명 배정)`,
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

      // teacher_ids가 없는 경우에도 RPC 사용 (색상 자동 할당 위해)
      const response = await apiClient.callRPC<Class>('create_class_with_teachers', {
        p_tenant_id: tenantId,
        p_name: input.name,
        p_subject: input.subject,
        p_grade: input.grade,
        p_day_of_week: input.day_of_week || 'monday',
        p_start_time: input.start_time || '14:00:00',
        p_end_time: input.end_time || '15:30:00',
        p_capacity: input.capacity || 20,
        p_color: null,  // 색상은 RPC 함수에서 자동 할당
        p_room: null,   // room 필드는 CreateClassInput에서 제거됨
        p_notes: input.notes,
        p_status: input.status || 'active',
        p_teacher_ids: null,
        p_teacher_roles: null,
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
            summary: `${input.name || '수업'} 등록 완료`,
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
 * 수업 수정 Hook
 * [수정] teacher_ids 지원 추가 - 기존 강사 배정 제거 후 신규 배정
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

      // teacher_ids를 제외한 나머지 필드만 PATCH
      const { teacher_ids, ...classUpdate } = input;

      const response = await apiClient.patch<Class>('academy_classes', classId, classUpdate as Record<string, unknown>);

      if (response.error) {
        throw new Error(response.error.message);
      }

      // teacher_ids가 제공된 경우 강사 배정 업데이트
      if (teacher_ids !== undefined) {
        // RPC 함수 호출로 bulk 업데이트 (N+1 쿼리 방지)
        const rpcResponse = await apiClient.callRPC('update_class_teachers', {
          p_class_id: classId,
          p_teacher_ids: teacher_ids,
        });

        if (!rpcResponse.success) {
          throw new Error(rpcResponse.error?.message || '강사 배정 업데이트에 실패했습니다.');
        }
      }

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      if (session?.user?.id && response.data) {
        const durationMs = Date.now() - startTime;
        const changedFields = Object.keys(input).filter((key) => input[key as keyof UpdateClassInput] !== undefined);
        await createExecutionAuditRecord(
          {
            operation_type: 'class.update',
            status: 'success',
            summary: `${response.data.name || '수업'} 정보 수정 완료 (${changedFields.join(', ')})`,
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
      void queryClient.invalidateQueries({ queryKey: ['class-teachers', tenantId, data.id] });
    },
  });
}

/**
 * 수업 삭제 Hook
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

      // 소프트 삭제: status를 'inactive'로 변경 (ClassStatus 타입: 'active' | 'inactive')
      const response = await apiClient.patch<Class>('academy_classes', classId, {
        status: 'inactive',
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
            summary: `${response.data.name || '수업'} 삭제 완료 (inactive)`,
            details: {
              class_id: classId,
              new_status: 'inactive',
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
 * 수업별 통계 조회 Hook
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
      // [Soft Delete] deleted_at IS NULL 필터를 위해 !inner 조인 사용
      const response = await apiClient.get<PersonWithAcademyTeachers[]>('persons', {
        select: `
          *,
          academy_teachers!inner (
            employee_id,
            specialization,
            hire_date,
            status,
            position,
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
            deleted_at
          )
        `,
        filters: {
          person_type: 'teacher',
          'academy_teachers.deleted_at': null,  // Soft Delete 필터
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // 데이터 변환 persons + academy_teachers -> Teacher
      const personsData = response.data || [];
      let teachers: Teacher[] = personsData.map((person) => {
        const personWithTeachers = person as unknown as Person & { academy_teachers?: Array<Record<string, unknown>> | Record<string, unknown> };
        // academy_teachers가 배열이면 [0], 객체면 그대로 사용
        const academyTeachers = personWithTeachers.academy_teachers;
        const teacherData = Array.isArray(academyTeachers) ? (academyTeachers[0] || {}) : (academyTeachers || {});
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
          position: teacherData.position,
          login_id: teacherData.login_id,
          user_id: teacherData.user_id,
          profile_image_url: teacherData.profile_image_url,
          bio: teacherData.bio,
          notes: teacherData.notes,
          pay_type: teacherData.pay_type,
          base_salary: teacherData.base_salary,
          hourly_rate: teacherData.hourly_rate,
          bank_name: teacherData.bank_name,
          bank_account: teacherData.bank_account,
          salary_notes: teacherData.salary_notes,
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
 * [수정] academy_teachers.id로 조회하도록 변경 (useTeachersWithStats와 일관성 유지)
 */
export function useTeacher(teacherId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['teacher', tenantId, teacherId],
    queryFn: async () => {
      if (!tenantId || !teacherId) return null;

      // academy_teachers 테이블에서 조회 (persons JOIN)
      const response = await apiClient.get<{
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
        deleted_at: string | null;
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
          deleted_at,
          persons (
            id,
            name,
            phone,
            email,
            address
          )
        `,
        filters: {
          id: teacherId,
          deleted_at: null,
        },
        limit: 1,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const teacherData = response.data?.[0];
      if (!teacherData) return null;

      return {
        id: teacherData.id,
        tenant_id: teacherData.tenant_id,
        name: teacherData.persons?.name || '',
        email: teacherData.persons?.email || undefined,
        phone: teacherData.persons?.phone || undefined,
        address: teacherData.persons?.address || undefined,
        employee_id: teacherData.employee_id || undefined,
        specialization: teacherData.specialization || undefined,
        hire_date: teacherData.hire_date || undefined,
        status: teacherData.status || 'active',
        position: teacherData.position || undefined,
        login_id: teacherData.login_id || undefined,
        user_id: teacherData.user_id || undefined,
        profile_image_url: teacherData.profile_image_url || undefined,
        bio: teacherData.bio || undefined,
        notes: teacherData.notes || undefined,
        pay_type: teacherData.pay_type || undefined,
        base_salary: teacherData.base_salary || undefined,
        hourly_rate: teacherData.hourly_rate || undefined,
        bank_name: teacherData.bank_name || undefined,
        bank_account: teacherData.bank_account || undefined,
        salary_notes: teacherData.salary_notes || undefined,
        created_at: teacherData.created_at,
        updated_at: teacherData.updated_at,
        created_by: teacherData.created_by || undefined,
        updated_by: teacherData.updated_by || undefined,
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
      // [요구사항] position, login_id 파라미터 추가
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
        p_position: input.position || 'teacher',
        p_login_id: input.login_id,
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
      // [최적화] teachers와 teachers-with-stats 쿼리 모두 invalidate
      queryClient.invalidateQueries({ queryKey: ['teachers', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['teachers-with-stats', tenantId] });
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
    }): Promise<Teacher> => {
      const startTime = Date.now();
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // name, phone, login_id, password가 있으면 Edge Function 호출
      // (persons, auth.users, academy_teachers 모두 업데이트)
      if (input.name || input.phone || input.login_id || input.password) {
        const response = await apiClient.invokeFunction('update-teacher', {
          teacher_id: teacherId,
          ...input,
        });

        if (!response.success || !response.data) {
          throw new Error(response.error?.message || '정보 수정에 실패했습니다.');
        }

        // Audit log 기록 (비동기 - 응답 대기하지 않음)
        if (session?.user?.id) {
          const changedFields = Object.keys(input);
          apiClient.post('execution_audit_runs', {
            tenant_id: tenantId,
            occurred_at: new Date().toISOString(),
            operation_type: 'teacher.update',
            status: 'success',
            source: 'manual',
            actor_type: 'user',
            actor_id: `user:${session.user.id}`,
            reference: {
              entity_type: 'teacher',
              entity_id: teacherId,
              source_event_id: `manual:teacher.update:${teacherId}:${startTime}`,
            },
            summary: `${input.name || 'teacher'} 정보 수정 완료 (${changedFields.join(', ')})`,
            details: {
              teacher_id: teacherId,
              changed_fields: changedFields,
            },
            duration_ms: Date.now() - startTime,
          }).catch(() => {}); // 실패해도 무시
        }

        return response.data as Teacher;
      }

      // academy_teachers 테이블만 업데이트하는 경우
      const teacherUpdate: Partial<Teacher> = {};
      if (input.employee_id !== undefined) teacherUpdate.employee_id = input.employee_id;
      if (input.specialization !== undefined) teacherUpdate.specialization = input.specialization;
      if (input.hire_date !== undefined) teacherUpdate.hire_date = input.hire_date;
      if (input.status !== undefined) teacherUpdate.status = input.status;
      if (input.position !== undefined) teacherUpdate.position = input.position;
      if (input.profile_image_url !== undefined) teacherUpdate.profile_image_url = input.profile_image_url;
      if (input.bio !== undefined) teacherUpdate.bio = input.bio;
      if (input.notes !== undefined) teacherUpdate.notes = input.notes;
      if (input.pay_type !== undefined) teacherUpdate.pay_type = input.pay_type;
      if (input.base_salary !== undefined) teacherUpdate.base_salary = input.base_salary;
      if (input.hourly_rate !== undefined) teacherUpdate.hourly_rate = input.hourly_rate;
      if (input.bank_name !== undefined) teacherUpdate.bank_name = input.bank_name;
      if (input.bank_account !== undefined) teacherUpdate.bank_account = input.bank_account;
      if (input.salary_notes !== undefined) teacherUpdate.salary_notes = input.salary_notes;

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
            position,
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

      const personWithTeachers = person as unknown as Person & { academy_teachers?: Array<Record<string, unknown>> | Record<string, unknown> };
      // academy_teachers가 배열이면 [0], 객체면 그대로 사용
      const academyTeachers = personWithTeachers.academy_teachers;
      const teacherData = Array.isArray(academyTeachers) ? (academyTeachers[0] || {}) : (academyTeachers || {});
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
        position: teacherData.position,
        login_id: teacherData.login_id,
        user_id: teacherData.user_id,
        profile_image_url: teacherData.profile_image_url,
        bio: teacherData.bio,
        notes: teacherData.notes,
        pay_type: teacherData.pay_type,
        base_salary: teacherData.base_salary,
        hourly_rate: teacherData.hourly_rate,
        bank_name: teacherData.bank_name,
        bank_account: teacherData.bank_account,
        salary_notes: teacherData.salary_notes,
        created_at: personWithTeachers.created_at,
        updated_at: personWithTeachers.updated_at,
        created_by: teacherData.created_by,
        updated_by: teacherData.updated_by,
      } as Teacher;

      // Execution Audit 기록 생성 (비동기 - 응답 대기하지 않음)
      if (session?.user?.id) {
        const durationMs = Date.now() - startTime;
        const changedFields = Object.keys(input).filter((key) => input[key as keyof UpdateTeacherInput] !== undefined);
        createExecutionAuditRecord(
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
        ).catch(() => {}); // 실패해도 무시
      }

      return teacher;
    },
    onSuccess: (data: Teacher) => {
      // [최적화] teachers와 teachers-with-stats 쿼리 모두 invalidate
      queryClient.invalidateQueries({ queryKey: ['teachers', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['teachers-with-stats', tenantId] });
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
            summary: `강사 삭제 완료`,
            details: {
              teacher_id: teacherId,
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
      // [최적화] teachers와 teachers-with-stats 쿼리 모두 invalidate
      queryClient.invalidateQueries({ queryKey: ['teachers', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['teachers-with-stats', tenantId] });
    },
  });
}

/**
 * 강사 퇴직 처리 Hook
 * status를 'resigned'로 변경 (삭제가 아닌 퇴직 상태로 표시)
 */
export function useResignTeacher() {
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

      // academy_teachers는 person_id를 FK로 사용
      // teacherId는 persons.id이므로, person_id로 조회 후 업데이트
      const teacherResponse = await apiClient.get('academy_teachers', {
        filters: { person_id: teacherId },
        limit: 1,
      });

      if (teacherResponse.error) {
        throw new Error(teacherResponse.error.message);
      }

      const academyTeacher = teacherResponse.data?.[0] as { person_id?: string } | undefined;
      if (!academyTeacher || !academyTeacher.person_id) {
        throw new Error('강사 정보를 찾을 수 없습니다.');
      }

      // patch는 id 기반이 아닌 person_id 기반으로 업데이트 필요
      // academy_students처럼 person_id를 사용하므로 직접 Supabase 쿼리 실행
      const response = await apiClient.patch('academy_teachers', academyTeacher.person_id, {
        status: 'resigned',
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Execution Audit 기록 생성
      if (session?.user?.id) {
        const durationMs = Date.now() - startTime;
        await createExecutionAuditRecord(
          {
            operation_type: 'teacher.resign',
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
      // [최적화] teachers와 teachers-with-stats 쿼리 모두 invalidate
      queryClient.invalidateQueries({ queryKey: ['teachers', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['teachers-with-stats', tenantId] });
    },
  });
}

// ==================== 수업/강사 연결 관리 =====================

/**
 * 수업별 강사 목록 조회 Hook
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
 * 일정 충돌 감지 Hook
 * [요구사항] 디어쌤_아키텍처.md 3.2.2: Schedule Conflict Detection
 */
export function useCheckScheduleConflicts() {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation<
    ScheduleConflictResult,
    Error,
    {
      classId?: string;
      dayOfWeek: DayOfWeek | DayOfWeek[];
      startTime: string;
      endTime: string;
      teacherIds?: string[];
      room?: string;
    }
  >({
    mutationFn: async (params) => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // dayOfWeek가 배열이면 첫 번째 값만 사용 (RPC 함수가 단일 값만 지원)
      const dayOfWeek = Array.isArray(params.dayOfWeek) ? params.dayOfWeek[0] : params.dayOfWeek;

      const response = await apiClient.callRPC<ScheduleConflictResult>('check_schedule_conflicts', {
        p_tenant_id: tenantId,
        p_day_of_week: dayOfWeek,
        p_start_time: params.startTime,
        p_end_time: params.endTime,
        p_class_id: params.classId || null,
        p_teacher_ids: params.teacherIds || null,
        p_room: params.room || null,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data!;
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

