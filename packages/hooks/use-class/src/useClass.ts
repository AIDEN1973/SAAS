/**
 * useClass Hook
 * 
 * React Query ê¸°ë°˜ ë°?ê°•ì‚¬ ê´€ë¦?Hook
 * [ë¶ˆë? ê·œì¹™] tenant ë³€ê²???invalidateQueries() ?ë™ ë°œìƒ
 * [ë¶ˆë? ê·œì¹™] api-sdkë¥??µí•´?œë§Œ ?°ì´???”ì²­
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
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

/**
 * ë°?ëª©ë¡ ì¡°íšŒ Hook
 * [ë¶ˆë? ê·œì¹™] Zero-Trust: tenantId??Context?ì„œ ?ë™?¼ë¡œ ê°€?¸ì˜´
 */
export function useClasses(filter?: ClassFilter) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<Class[]>({
    queryKey: ['classes', tenantId, filter],
    queryFn: async (): Promise<Class[]> => {
      if (!tenantId) return [];

      const response = await apiClient.get<Class>('academy_classes', {
        filters: filter || {},
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data || [];
    },
    enabled: !!tenantId,
  });
}

/**
 * ë°??ì„¸ ì¡°íšŒ Hook
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
 * ë°??ì„± Hook
 */
export function useCreateClass() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async (input: CreateClassInput) => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const response = await apiClient.post<Class>('academy_classes', {
        ...input,
        status: input.status || 'active',
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', tenantId] });
    },
  });
}

/**
 * ë°??˜ì • Hook
 */
export function useUpdateClass() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async ({
      classId,
      input,
    }: {
      classId: string;
      input: UpdateClassInput;
    }) => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const response = await apiClient.patch<Class>('academy_classes', classId, input);

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['classes', tenantId] });
      queryClient.invalidateQueries({
        queryKey: ['class', tenantId, data.id],
      });
    },
  });
}

/**
 * ë°??? œ Hook
 */
export function useDeleteClass() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async (classId: string) => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // ?Œí”„???? œ: statusë¥?'archived'ë¡?ë³€ê²?
      const response = await apiClient.patch<Class>('academy_classes', classId, {
        status: 'archived',
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', tenantId] });
    },
  });
}

/**
 * ë°˜ë³„ ?µê³„ ì¡°íšŒ Hook
 */
export function useClassStatistics(classId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['class-statistics', tenantId, classId],
    queryFn: async () => {
      if (!tenantId || !classId) return null;

      // TODO: ì¶œê²° ?°ì´?°ê? êµ¬í˜„?˜ë©´ ?¤ì œ ?µê³„ ê³„ì‚°
      // ?„ì¬??ê¸°ë³¸ê°?ë°˜í™˜
      const classData = await apiClient.get<Class>('academy_classes', {
        filters: { id: classId },
        limit: 1,
      });

      if (classData.error || !classData.data?.[0]) {
        throw new Error('Class not found');
      }

      const classInfo = classData.data[0];
      return {
        attendance_rate: 0,  // TODO: ì¶œê²° ?°ì´??ê¸°ë°˜ ê³„ì‚°
        capacity_rate: (classInfo.current_count / classInfo.capacity) * 100,
        late_rate: 0,  // TODO: ì¶œê²° ?°ì´??ê¸°ë°˜ ê³„ì‚°
      };
    },
    enabled: !!tenantId && !!classId,
  });
}

// ==================== ê°•ì‚¬(Teacher) ê´€ë¦?====================

/**
 * ê°•ì‚¬ ëª©ë¡ ì¡°íšŒ Hook
 */
export function useTeachers(filter?: TeacherFilter) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['teachers', tenantId, filter],
    queryFn: async () => {
      if (!tenantId) return [];

      // persons + academy_teachers ì¡°ì¸?˜ì—¬ ì¡°íšŒ
      const response = await apiClient.get<any>('persons', {
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

      // ?°ì´??ë³€?? persons + academy_teachers ??Teacher
      return (response.data || []).map((person: any) => {
        const teacherData = person.academy_teachers?.[0] || {};
        return {
          id: person.id,
          tenant_id: person.tenant_id,
          name: person.name,
          email: person.email,
          phone: person.phone,
          address: person.address,
          employee_id: teacherData.employee_id,
          specialization: teacherData.specialization,
          hire_date: teacherData.hire_date,
          status: teacherData.status || 'active',
          profile_image_url: teacherData.profile_image_url,
          bio: teacherData.bio,
          notes: teacherData.notes,
          created_at: person.created_at,
          updated_at: person.updated_at,
          created_by: teacherData.created_by,
          updated_by: teacherData.updated_by,
        } as Teacher;
      });
    },
    enabled: !!tenantId,
  });
}

/**
 * ê°•ì‚¬ ?ì„¸ ì¡°íšŒ Hook
 */
export function useTeacher(teacherId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['teacher', tenantId, teacherId],
    queryFn: async () => {
      if (!tenantId || !teacherId) return null;

      const response = await apiClient.get<any>('persons', {
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

      const teacherData = person.academy_teachers?.[0] || {};
      return {
        id: person.id,
        tenant_id: person.tenant_id,
        name: person.name,
        email: person.email,
        phone: person.phone,
        address: person.address,
        employee_id: teacherData.employee_id,
        specialization: teacherData.specialization,
        hire_date: teacherData.hire_date,
        status: teacherData.status || 'active',
        profile_image_url: teacherData.profile_image_url,
        bio: teacherData.bio,
        notes: teacherData.notes,
        created_at: person.created_at,
        updated_at: person.updated_at,
        created_by: teacherData.created_by,
        updated_by: teacherData.updated_by,
      } as Teacher;
    },
    enabled: !!tenantId && !!teacherId,
  });
}

/**
 * ê°•ì‚¬ ?ì„± Hook
 */
export function useCreateTeacher() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async (input: CreateTeacherInput) => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // 1. persons ?Œì´ë¸”ì— ?ì„±
      const personResponse = await apiClient.post<any>('persons', {
        name: input.name,
        email: input.email,
        phone: input.phone,
        address: input.address,
        person_type: 'teacher',
      });

      if (personResponse.error) {
        throw new Error(personResponse.error.message);
      }

      const person = personResponse.data!;

      // 2. academy_teachers ?Œì´ë¸”ì— ?•ì¥ ?•ë³´ ?€??
      const teacherResponse = await apiClient.post<any>('academy_teachers', {
        person_id: person.id,
        employee_id: input.employee_id,
        specialization: input.specialization,
        hire_date: input.hire_date,
        status: input.status || 'active',
        profile_image_url: input.profile_image_url,
        bio: input.bio,
        notes: input.notes,
      });

      if (teacherResponse.error) {
        // ë¡¤ë°±: persons ?? œ
        await apiClient.delete('persons', person.id);
        throw new Error(teacherResponse.error.message);
      }

      return {
        id: person.id,
        tenant_id: person.tenant_id,
        name: person.name,
        email: person.email,
        phone: person.phone,
        address: person.address,
        employee_id: teacherResponse.data?.employee_id,
        specialization: teacherResponse.data?.specialization,
        hire_date: teacherResponse.data?.hire_date,
        status: teacherResponse.data?.status || 'active',
        profile_image_url: teacherResponse.data?.profile_image_url,
        bio: teacherResponse.data?.bio,
        notes: teacherResponse.data?.notes,
        created_at: person.created_at,
        updated_at: person.updated_at,
        created_by: teacherResponse.data?.created_by,
        updated_by: teacherResponse.data?.updated_by,
      } as Teacher;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers', tenantId] });
    },
  });
}

/**
 * ê°•ì‚¬ ?˜ì • Hook
 */
export function useUpdateTeacher() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async ({
      teacherId,
      input,
    }: {
      teacherId: string;
      input: UpdateTeacherInput;
    }) => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // 1. persons ?Œì´ë¸??…ë°?´íŠ¸
      const personUpdate: any = {};
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

      // 2. academy_teachers ?Œì´ë¸??…ë°?´íŠ¸
      const teacherUpdate: any = {};
      if (input.employee_id !== undefined) teacherUpdate.employee_id = input.employee_id;
      if (input.specialization !== undefined) teacherUpdate.specialization = input.specialization;
      if (input.hire_date !== undefined) teacherUpdate.hire_date = input.hire_date;
      if (input.status !== undefined) teacherUpdate.status = input.status;
      if (input.profile_image_url !== undefined) teacherUpdate.profile_image_url = input.profile_image_url;
      if (input.bio !== undefined) teacherUpdate.bio = input.bio;
      if (input.notes !== undefined) teacherUpdate.notes = input.notes;

      if (Object.keys(teacherUpdate).length > 0) {
        // academy_teachers??person_idë¥?PKë¡??¬ìš©
        const teacherResponse = await apiClient.get('academy_teachers', {
          filters: { person_id: teacherId },
          limit: 1,
        });

        if (teacherResponse.error) {
          throw new Error(teacherResponse.error.message);
        }

        const academyTeacher = teacherResponse.data?.[0];
        if (academyTeacher) {
          const updateResponse = await apiClient.patch('academy_teachers', academyTeacher.person_id, teacherUpdate);
          if (updateResponse.error) {
            throw new Error(updateResponse.error.message);
          }
        }
      }

      // 3. ?…ë°?´íŠ¸???°ì´??ì¡°íšŒ?˜ì—¬ ë°˜í™˜
      const teacherResponse = await apiClient.get<any>('persons', {
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

      const teacherData = person.academy_teachers?.[0] || {};
      return {
        id: person.id,
        tenant_id: person.tenant_id,
        name: person.name,
        email: person.email,
        phone: person.phone,
        address: person.address,
        employee_id: teacherData.employee_id,
        specialization: teacherData.specialization,
        hire_date: teacherData.hire_date,
        status: teacherData.status || 'active',
        profile_image_url: teacherData.profile_image_url,
        bio: teacherData.bio,
        notes: teacherData.notes,
        created_at: person.created_at,
        updated_at: person.updated_at,
        created_by: teacherData.created_by,
        updated_by: teacherData.updated_by,
      } as Teacher;
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
 * ê°•ì‚¬ ?? œ Hook
 */
export function useDeleteTeacher() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async (teacherId: string) => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // ?Œí”„???? œ: statusë¥?'resigned'ë¡?ë³€ê²?
      const teacherResponse = await apiClient.get('academy_teachers', {
        filters: { person_id: teacherId },
        limit: 1,
      });

      if (teacherResponse.error) {
        throw new Error(teacherResponse.error.message);
      }

      const academyTeacher = teacherResponse.data?.[0];
      if (!academyTeacher) {
        throw new Error('Teacher not found');
      }

      const response = await apiClient.patch('academy_teachers', academyTeacher.person_id, {
        status: 'resigned',
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers', tenantId] });
    },
  });
}

// ==================== ë°?ê°•ì‚¬ ?°ê²° ê´€ë¦?====================

/**
 * ë°˜ë³„ ê°•ì‚¬ ëª©ë¡ ì¡°íšŒ Hook
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
 * ê°•ì‚¬ ë°°ì • Hook
 */
export function useAssignTeacher() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async (input: AssignTeacherInput) => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const response = await apiClient.post<ClassTeacher>('class_teachers', {
        ...input,
        assigned_at: input.assigned_at || new Date().toISOString().split('T')[0],
        is_active: true,
      });

      if (response.error) {
        throw new Error(response.error.message);
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
 * ê°•ì‚¬ ë°°ì • ?´ì œ Hook
 */
export function useUnassignTeacher() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async ({
      classId,
      teacherId,
    }: {
      classId: string;
      teacherId: string;
    }) => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // class_teachers?ì„œ ?´ë‹¹ ?ˆì½”??ì°¾ê¸°
      const findResponse = await apiClient.get('class_teachers', {
        filters: { class_id: classId, teacher_id: teacherId, is_active: true },
        limit: 1,
      });

      if (findResponse.error || !findResponse.data?.[0]) {
        throw new Error('Class teacher assignment not found');
      }

      const assignment = findResponse.data[0];

      const response = await apiClient.patch('class_teachers', assignment.id, {
        is_active: false,
        unassigned_at: new Date().toISOString().split('T')[0],
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['class-teachers', tenantId, variables.classId] });
      queryClient.invalidateQueries({ queryKey: ['classes', tenantId] });
    },
  });
}

