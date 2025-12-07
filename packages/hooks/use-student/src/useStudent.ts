/**
 * useStudent Hook
 * 
 * React Query ê¸°ë°˜ ?™ìƒ ê´€ë¦?Hook
 * [ë¶ˆë? ê·œì¹™] tenant ë³€ê²???invalidateQueries() ?ë™ ë°œìƒ
 * [ë¶ˆë? ê·œì¹™] api-sdkë¥??µí•´?œë§Œ ?°ì´???”ì²­
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import type {
  CreateStudentInput,
  UpdateStudentInput,
  StudentFilter,
  Student,
  StudentClass,
} from '@services/student-service';
import type { Class } from '@services/class-service';

/**
 * ?™ìƒ ëª©ë¡ ì¡°íšŒ Hook
 * [ë¶ˆë? ê·œì¹™] Zero-Trust: tenantId??Context?ì„œ ?ë™?¼ë¡œ ê°€?¸ì˜´
 */
export function useStudents(filter?: StudentFilter) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['students', tenantId, filter],
    queryFn: async () => {
      // [ë¶ˆë? ê·œì¹™] ê¸°ìˆ ë¬¸ì„œ ?•ì±…: "Core Party ?Œì´ë¸?+ ?…ì¢…ë³??•ì¥ ?Œì´ë¸? ?¨í„´ ?¬ìš©
      // persons + academy_studentsë¥?ì§ì ‘ ì¡°ì¸?˜ì—¬ ì¡°íšŒ (View ?€??
      // PostgRESTê°€ Viewë¥??¸ì‹?˜ì? ëª»í•˜??ë¬¸ì œë¥??°íšŒ?˜ê¸° ?„í•´ ì§ì ‘ ì¡°ì¸ ?¬ìš©
      const response = await apiClient.get<any>('persons', {
        select: `
          *,
          academy_students (
            birth_date,
            gender,
            school_name,
            grade,
            class_name,
            status,
            notes,
            profile_image_url,
            created_at,
            updated_at,
            created_by,
            updated_by
          )
        `,
        filters: { person_type: 'student' },
        orderBy: { column: 'created_at', ascending: false },
        limit: 100,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const personsData = response.data || [];

      // ?°ì´??ë³€?? persons + academy_students ??Student
      let students: Student[] = personsData.map((person: any) => {
        const academyData = person.academy_students?.[0] || {};
        return {
          id: person.id,
          tenant_id: person.tenant_id,
          industry_type: 'academy',
          name: person.name,
          birth_date: academyData.birth_date,
          gender: academyData.gender,
          phone: person.phone,
          email: person.email,
          address: person.address,
          school_name: academyData.school_name,
          grade: academyData.grade,
          status: academyData.status || 'active',
          notes: academyData.notes,
          profile_image_url: academyData.profile_image_url,
          created_at: person.created_at,
          updated_at: person.updated_at,
          created_by: academyData.created_by,
          updated_by: academyData.updated_by,
        } as Student;
      });

      // ?´ë¼?´ì–¸??ì¸??„í„°ë§?
      if (filter?.status) {
        const statusArray = Array.isArray(filter.status) ? filter.status : [filter.status];
        students = students.filter((s) => statusArray.includes(s.status));
      }

      if (filter?.grade) {
        students = students.filter((s) => s.grade === filter.grade);
      }

      if (filter?.search) {
        const searchLower = filter.search.toLowerCase();
        students = students.filter((s) =>
          s.name?.toLowerCase().includes(searchLower)
        );
      }

      return students;
    },
    enabled: !!tenantId,
  });
}

/**
 * ?™ìƒ ?ì„¸ ì¡°íšŒ Hook
 * [ë¶ˆë? ê·œì¹™] Zero-Trust: tenantId??Context?ì„œ ?ë™?¼ë¡œ ê°€?¸ì˜´
 */
export function useStudent(studentId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['student', tenantId, studentId],
    queryFn: async () => {
      if (!studentId) return null;
      
      // students Viewë¥??¬ìš©?˜ì—¬ ì¡°íšŒ (persons + academy_students ì¡°ì¸)
      const response = await apiClient.get<any>('persons', {
        select: `
          *,
          academy_students (
            birth_date,
            gender,
            school_name,
            grade,
            class_name,
            status,
            notes,
            profile_image_url,
            created_at,
            updated_at,
            created_by,
            updated_by
          )
        `,
        filters: { id: studentId, person_type: 'student' },
        limit: 1,
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      const person = response.data?.[0];
      if (!person) return null;
      
      // ?°ì´??ë³€?? persons + academy_students ??Student
      const academyData = person.academy_students?.[0] || {};
      return {
        id: person.id,
        tenant_id: person.tenant_id,
        industry_type: 'academy',
        name: person.name,
        birth_date: academyData.birth_date,
        gender: academyData.gender,
        phone: person.phone,
        email: person.email,
        address: person.address,
        school_name: academyData.school_name,
        grade: academyData.grade,
        status: academyData.status || 'active',
        notes: academyData.notes,
        profile_image_url: academyData.profile_image_url,
        created_at: person.created_at,
        updated_at: person.updated_at,
        created_by: academyData.created_by,
        updated_by: academyData.updated_by,
      } as Student;
    },
    enabled: !!tenantId && !!studentId,
  });
}

/**
 * ?™ìƒ ?ì„± Hook
 * [ë¶ˆë? ê·œì¹™] Zero-Trust: tenantId??Context?ì„œ ?ë™?¼ë¡œ ê°€?¸ì˜´
 * [ë¶ˆë? ê·œì¹™] students??View?´ë?ë¡?persons + academy_studentsë¥?ê°ê° ?ì„±?´ì•¼ ??
 */
export function useCreateStudent() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const industryType = context.industryType || 'academy';

  return useMutation({
    mutationFn: async (input: CreateStudentInput) => {
      // 1. persons ?Œì´ë¸”ì— ?ì„± (ê³µí†µ ?„ë“œ)
      const personResponse = await apiClient.post<any>('persons', {
        name: input.name,
        email: input.email,
        phone: input.phone,
        address: input.address,
        person_type: 'student',
      });
      
      if (personResponse.error) {
        throw new Error(personResponse.error.message);
      }
      
      const person = personResponse.data!;
      
      // 2. academy_students ?Œì´ë¸”ì— ?•ì¥ ?•ë³´ ?€??
      const academyResponse = await apiClient.post<any>('academy_students', {
        person_id: person.id,
        birth_date: input.birth_date,
        gender: input.gender,
        school_name: input.school_name,
        grade: input.grade,
        status: input.status || 'active',
        notes: input.notes,
        profile_image_url: input.profile_image_url,
      });
      
      if (academyResponse.error) {
        // ë¡¤ë°±: persons ?? œ
        await apiClient.delete('persons', person.id);
        throw new Error(academyResponse.error.message);
      }
      
      // 3. ?™ë?ëª??•ë³´ ?ì„±
      if (input.guardians && input.guardians.length > 0) {
        for (const guardian of input.guardians) {
          await apiClient.post('guardians', {
            student_id: person.id,
            ...guardian,
          });
        }
      }
      
      // 4. ?œê·¸ ?°ê²°
      if (input.tag_ids && input.tag_ids.length > 0) {
        for (const tagId of input.tag_ids) {
          await apiClient.post('tag_assignments', {
            entity_id: person.id,
            entity_type: 'student',
            tag_id: tagId,
          });
        }
      }
      
      // 5. ê²°ê³¼ ë°˜í™˜ (persons + academy_students ì¡°í•©)
      return {
        id: person.id,
        tenant_id: person.tenant_id,
        industry_type: industryType,
        name: person.name,
        birth_date: academyResponse.data?.birth_date,
        gender: academyResponse.data?.gender,
        phone: person.phone,
        email: person.email,
        address: person.address,
        school_name: academyResponse.data?.school_name,
        grade: academyResponse.data?.grade,
        status: academyResponse.data?.status || 'active',
        notes: academyResponse.data?.notes,
        profile_image_url: academyResponse.data?.profile_image_url,
        created_at: person.created_at,
        updated_at: person.updated_at,
        created_by: academyResponse.data?.created_by,
        updated_by: academyResponse.data?.updated_by,
      } as Student;
    },
    onSuccess: () => {
      // ?™ìƒ ëª©ë¡ ì¿¼ë¦¬ ë¬´íš¨??
      queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
    },
  });
}

/**
 * ?™ìƒ ?¼ê´„ ?±ë¡ Hook (?‘ì?)
 * [?”êµ¬?¬í•­] ?™ìƒ ?¼ê´„ ?±ë¡(?‘ì?)
 */
export function useBulkCreateStudents() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const industryType = context.industryType || 'academy';

  return useMutation({
    mutationFn: async (students: CreateStudentInput[]) => {
      // [ë¶ˆë? ê·œì¹™] api-sdkë¥??µí•´?œë§Œ ?°ì´???”ì²­
      // ?¼ê´„ ?±ë¡?€ ?¬ëŸ¬ ê°œì˜ POST ?”ì²­?¼ë¡œ ì²˜ë¦¬
      const results: Student[] = [];
      const errors: Array<{ index: number; error: string }> = [];

      for (let i = 0; i < students.length; i++) {
        try {
          // 1. persons ?Œì´ë¸”ì— ?ì„±
          const personResponse = await apiClient.post<any>('persons', {
            name: students[i].name,
            email: students[i].email,
            phone: students[i].phone,
            address: students[i].address,
            person_type: 'student',
          });
          
          if (personResponse.error) {
            throw new Error(personResponse.error.message);
          }
          
          const person = personResponse.data!;
          
          // 2. academy_students ?Œì´ë¸”ì— ?•ì¥ ?•ë³´ ?€??
          const academyResponse = await apiClient.post<any>('academy_students', {
            person_id: person.id,
            birth_date: students[i].birth_date,
            gender: students[i].gender,
            school_name: students[i].school_name,
            grade: students[i].grade,
            status: students[i].status || 'active',
            notes: students[i].notes,
            profile_image_url: students[i].profile_image_url,
          });
          
          if (academyResponse.error) {
            // ë¡¤ë°±: persons ?? œ
            await apiClient.delete('persons', person.id);
            throw new Error(academyResponse.error.message);
          }
          
          // 3. ê²°ê³¼ ë°˜í™˜
          results.push({
            id: person.id,
            tenant_id: person.tenant_id,
            industry_type: industryType,
            name: person.name,
            birth_date: academyResponse.data?.birth_date,
            gender: academyResponse.data?.gender,
            phone: person.phone,
            email: person.email,
            address: person.address,
            school_name: academyResponse.data?.school_name,
            grade: academyResponse.data?.grade,
            status: academyResponse.data?.status || 'active',
            notes: academyResponse.data?.notes,
            profile_image_url: academyResponse.data?.profile_image_url,
            created_at: person.created_at,
            updated_at: person.updated_at,
            created_by: academyResponse.data?.created_by,
            updated_by: academyResponse.data?.updated_by,
          } as Student);
        } catch (error) {
          errors.push({
            index: i,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      if (errors.length > 0) {
        console.warn('?¼ë? ?™ìƒ ?±ë¡ ?¤íŒ¨:', errors);
      }

      return { results, errors };
    },
    onSuccess: () => {
      // ?™ìƒ ëª©ë¡ ì¿¼ë¦¬ ë¬´íš¨??
      queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
    },
  });
}

/**
 * ?™ìƒ ?˜ì • Hook
 * [ë¶ˆë? ê·œì¹™] Zero-Trust: tenantId??Context?ì„œ ?ë™?¼ë¡œ ê°€?¸ì˜´
 * [ë¶ˆë? ê·œì¹™] students??View?´ë?ë¡?persons?€ academy_studentsë¥?ê°ê° ?…ë°?´íŠ¸?´ì•¼ ??
 */
export function useUpdateStudent() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async ({
      studentId,
      input,
    }: {
      studentId: string;
      input: UpdateStudentInput;
    }) => {
      // 1. persons ?Œì´ë¸??…ë°?´íŠ¸ (ê³µí†µ ?„ë“œ)
      const personUpdate: any = {};
      if (input.name !== undefined) personUpdate.name = input.name;
      if (input.email !== undefined) personUpdate.email = input.email;
      if (input.phone !== undefined) personUpdate.phone = input.phone;
      if (input.address !== undefined) personUpdate.address = input.address;

      if (Object.keys(personUpdate).length > 0) {
        const personResponse = await apiClient.patch('persons', studentId, personUpdate);
        if (personResponse.error) {
          throw new Error(personResponse.error.message);
        }
      }

      // 2. academy_students ?Œì´ë¸??…ë°?´íŠ¸ (?…ì¢… ?¹í™” ?„ë“œ)
      const academyUpdate: any = {};
      if (input.birth_date !== undefined) academyUpdate.birth_date = input.birth_date;
      if (input.gender !== undefined) academyUpdate.gender = input.gender;
      if (input.school_name !== undefined) academyUpdate.school_name = input.school_name;
      if (input.grade !== undefined) academyUpdate.grade = input.grade;
      if (input.status !== undefined) academyUpdate.status = input.status;
      if (input.notes !== undefined) academyUpdate.notes = input.notes;
      if (input.profile_image_url !== undefined) academyUpdate.profile_image_url = input.profile_image_url;

      if (Object.keys(academyUpdate).length > 0) {
        // academy_students??person_idë¥?PKë¡??¬ìš©?˜ë?ë¡?person_idë¡?ì¡°íšŒ ???…ë°?´íŠ¸
        const academyResponse = await apiClient.get('academy_students', {
          filters: { person_id: studentId },
          limit: 1,
        });
        
        if (academyResponse.error) {
          throw new Error(academyResponse.error.message);
        }
        
        const academyStudent = academyResponse.data?.[0];
        if (academyStudent) {
          const updateResponse = await apiClient.patch('academy_students', academyStudent.person_id, academyUpdate);
          if (updateResponse.error) {
            throw new Error(updateResponse.error.message);
          }
        }
      }

      // 3. ?…ë°?´íŠ¸???°ì´??ì¡°íšŒ?˜ì—¬ ë°˜í™˜
      const studentResponse = await apiClient.get<any>('persons', {
        select: `
          *,
          academy_students (
            birth_date,
            gender,
            school_name,
            grade,
            class_name,
            status,
            notes,
            profile_image_url,
            created_at,
            updated_at,
            created_by,
            updated_by
          )
        `,
        filters: { id: studentId, person_type: 'student' },
        limit: 1,
      });
      
      if (studentResponse.error) {
        throw new Error(studentResponse.error.message);
      }
      
      const person = studentResponse.data?.[0];
      if (!person) {
        throw new Error('Student not found');
      }
      
      const academyData = person.academy_students?.[0] || {};
      return {
        id: person.id,
        tenant_id: person.tenant_id,
        industry_type: 'academy',
        name: person.name,
        birth_date: academyData.birth_date,
        gender: academyData.gender,
        phone: person.phone,
        email: person.email,
        address: person.address,
        school_name: academyData.school_name,
        grade: academyData.grade,
        status: academyData.status || 'active',
        notes: academyData.notes,
        profile_image_url: academyData.profile_image_url,
        created_at: person.created_at,
        updated_at: person.updated_at,
        created_by: academyData.created_by,
        updated_by: academyData.updated_by,
      } as Student;
    },
    onSuccess: (data) => {
      // ?™ìƒ ëª©ë¡ ë°??ì„¸ ì¿¼ë¦¬ ë¬´íš¨??
      queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
      queryClient.invalidateQueries({
        queryKey: ['student', tenantId, data.id],
      });
    },
  });
}

/**
 * ?™ìƒ ?? œ Hook (Soft delete: statusë¥?'withdrawn'?¼ë¡œ ë³€ê²?
 * [ë¶ˆë? ê·œì¹™] Zero-Trust: tenantId??Context?ì„œ ?ë™?¼ë¡œ ê°€?¸ì˜´
 */
export function useDeleteStudent() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async (studentId: string) => {
      // Soft delete: statusë¥?'withdrawn'?¼ë¡œ ë³€ê²?
      const response = await apiClient.patch<Student>('students', studentId, {
        status: 'withdrawn',
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      return response.data!;
    },
    onSuccess: () => {
      // ?™ìƒ ëª©ë¡ ì¿¼ë¦¬ ë¬´íš¨??
      queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
    },
  });
}

/**
 * ?™ë?ëª?ëª©ë¡ ì¡°íšŒ Hook
 * [ë¶ˆë? ê·œì¹™] Zero-Trust: tenantId??Context?ì„œ ?ë™?¼ë¡œ ê°€?¸ì˜´
 */
export function useGuardians(studentId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['guardians', tenantId, studentId],
    queryFn: async () => {
      if (!studentId) return [];
      
      const response = await apiClient.get('guardians', {
        filters: { student_id: studentId },
        orderBy: { column: 'is_primary', ascending: false },
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      return response.data || [];
    },
    enabled: !!tenantId && !!studentId,
  });
}

/**
 * ?™ìƒ ?œê·¸ ëª©ë¡ ì¡°íšŒ Hook (core-tags ?œìš©)
 * [ë¶ˆë? ê·œì¹™] Zero-Trust: tenantId??Context?ì„œ ?ë™?¼ë¡œ ê°€?¸ì˜´
 * TODO: API SDKë¥??µí•´ ?œê·¸ ì¡°íšŒ êµ¬í˜„ ?„ìš”
 */
export function useStudentTags() {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<Array<{ id: string; name: string; color: string }>>({
    queryKey: ['tags', tenantId, 'student'],
    queryFn: async (): Promise<Array<{ id: string; name: string; color: string }>> => {
      // TODO: API SDKë¥??µí•´ ?œê·¸ ì¡°íšŒ
      // ?„ì¬??ë¹?ë°°ì—´ ë°˜í™˜
      return [];
    },
    enabled: !!tenantId,
  });
}

/**
 * ?™ìƒ???œê·¸ ì¡°íšŒ Hook (core-tags ?œìš©)
 * [ë¶ˆë? ê·œì¹™] Zero-Trust: tenantId??Context?ì„œ ?ë™?¼ë¡œ ê°€?¸ì˜´
 * TODO: API SDKë¥??µí•´ ?œê·¸ ì¡°íšŒ êµ¬í˜„ ?„ìš”
 */
export function useStudentTagsByStudent(studentId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<Array<{ id: string; name: string; color: string }>>({
    queryKey: ['tags', tenantId, 'student', studentId],
    queryFn: async (): Promise<Array<{ id: string; name: string; color: string }>> => {
      if (!studentId) return [];
      // TODO: API SDKë¥??µí•´ ?œê·¸ ì¡°íšŒ
      // ?„ì¬??ë¹?ë°°ì—´ ë°˜í™˜
      return [];
    },
    enabled: !!tenantId && !!studentId,
  });
}

/**
 * ?ë‹´?¼ì? ëª©ë¡ ì¡°íšŒ Hook
 * [ë¶ˆë? ê·œì¹™] Zero-Trust: tenantId??Context?ì„œ ?ë™?¼ë¡œ ê°€?¸ì˜´
 */
export function useConsultations(studentId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['consultations', tenantId, studentId],
    queryFn: async () => {
      if (!studentId) return [];
      
      const response = await apiClient.get('student_consultations', {
        filters: { student_id: studentId },
        orderBy: { column: 'consultation_date', ascending: false },
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      return response.data || [];
    },
    enabled: !!tenantId && !!studentId,
  });
}

/**
 * ?ë‹´?¼ì? ?ì„± Hook
 */
export function useCreateConsultation() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async ({
      studentId,
      consultation,
      userId,
    }: {
      studentId: string;
      consultation: Omit<any, 'id' | 'tenant_id' | 'student_id' | 'created_at' | 'updated_at'>;
      userId: string;
    }) => {
      const response = await apiClient.post('student_consultations', {
        student_id: studentId,
        ...consultation,
        created_by: userId,
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      return response.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['consultations', tenantId, variables.studentId] });
    },
  });
}

/**
 * ?ë‹´?¼ì? ?˜ì • Hook
 */
export function useUpdateConsultation() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async ({
      consultationId,
      consultation,
      studentId,
    }: {
      consultationId: string;
      consultation: Partial<any>;
      studentId: string;
    }) => {
      const response = await apiClient.patch('student_consultations', consultationId, consultation);
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      return response.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['consultations', tenantId, variables.studentId] });
    },
  });
}

/**
 * ?ë‹´?¼ì? ?? œ Hook
 */
export function useDeleteConsultation() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async ({
      consultationId,
      studentId,
    }: {
      consultationId: string;
      studentId: string;
    }) => {
      const response = await apiClient.delete('student_consultations', consultationId);
      
      if (response.error) {
        throw new Error(response.error.message);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['consultations', tenantId, variables.studentId] });
    },
  });
}

/**
 * ?ë‹´?¼ì? AI ?”ì•½ ?ì„± Hook
 * [?”êµ¬?¬í•­] ?ë‹´?¼ì? AI ?”ì•½ ë²„íŠ¼ ?½ì…
 * 
 * [ë¶ˆë? ê·œì¹™] Phase 1?ì„œ???Œë ˆ?´ìŠ¤?€?”ë¡œ êµ¬í˜„
 * ?¤ì œ AI ?°ë™?€ Edge Function ?ëŠ” ?¸ë? AI ?œë¹„?¤ë? ?µí•´ êµ¬í˜„ ?ˆì •
 */
export function useGenerateConsultationAISummary() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async ({
      consultationId,
      studentId,
    }: {
      consultationId: string;
      studentId: string;
    }) => {
      // [ë¶ˆë? ê·œì¹™] api-sdkë¥??µí•´?œë§Œ ?°ì´???”ì²­
      // 1. ?ë‹´?¼ì? ì¡°íšŒ
      const consultationResponse = await apiClient.get<any>('student_consultations', {
        filters: { id: consultationId },
        limit: 1,
      });
      
      if (consultationResponse.error || !consultationResponse.data || consultationResponse.data.length === 0) {
        throw new Error('?ë‹´?¼ì?ë¥?ì°¾ì„ ???†ìŠµ?ˆë‹¤.');
      }
      
      const consultation = consultationResponse.data[0];
      
      // 2. AI ?”ì•½ ?ì„± (Phase 1: ?Œë ˆ?´ìŠ¤?€??
      // TODO: ?¤ì œ AI ?œë¹„???°ë™ (Edge Function ?ëŠ” ?¸ë? AI API)
      const placeholderSummary = `[AI ?”ì•½] ${consultation.content.substring(0, 100)}... (?”ì•½ ê¸°ëŠ¥?€ ê³??œê³µ???ˆì •?…ë‹ˆ??)`;
      
      // 3. ai_summary ?…ë°?´íŠ¸
      const updateResponse = await apiClient.patch('student_consultations', consultationId, {
        ai_summary: placeholderSummary,
      });
      
      if (updateResponse.error) {
        throw new Error(updateResponse.error.message);
      }
      
      return placeholderSummary;
    },
    onSuccess: (_, variables) => {
      // ?ë‹´?¼ì? ëª©ë¡ ì¿¼ë¦¬ ë¬´íš¨?”í•˜??AI ?”ì•½ ë°˜ì˜
      queryClient.invalidateQueries({ queryKey: ['consultations', tenantId, variables.studentId] });
    },
  });
}

/**
 * ?™ë?ëª??ì„± Hook
 */
export function useCreateGuardian() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async ({
      studentId,
      guardian,
    }: {
      studentId: string;
      guardian: Omit<any, 'id' | 'tenant_id' | 'student_id' | 'created_at' | 'updated_at'>;
    }) => {
      const response = await apiClient.post('guardians', {
        student_id: studentId,
        ...guardian,
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      return response.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['guardians', tenantId, variables.studentId] });
    },
  });
}

/**
 * ?™ë?ëª??˜ì • Hook
 */
export function useUpdateGuardian() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async ({
      guardianId,
      guardian,
      studentId,
    }: {
      guardianId: string;
      guardian: Partial<any>;
      studentId: string;
    }) => {
      const response = await apiClient.patch('guardians', guardianId, guardian);
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      return response.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['guardians', tenantId, variables.studentId] });
    },
  });
}

/**
 * ?™ë?ëª??? œ Hook
 */
export function useDeleteGuardian() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async ({
      guardianId,
      studentId,
    }: {
      guardianId: string;
      studentId: string;
    }) => {
      const response = await apiClient.delete('guardians', guardianId);
      
      if (response.error) {
        throw new Error(response.error.message);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['guardians', tenantId, variables.studentId] });
    },
  });
}

/**
 * ?™ìƒ ?œê·¸ ?…ë°?´íŠ¸ Hook
 */
export function useUpdateStudentTags() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async ({
      studentId,
      tagIds,
    }: {
      studentId: string;
      tagIds: string[];
    }) => {
      // ê¸°ì¡´ ?œê·¸ ? ë‹¹ ?œê±°
      const existingTags = await apiClient.get('tag_assignments', {
        filters: { entity_id: studentId, entity_type: 'student' },
      });
      
      if (existingTags.data) {
        for (const assignment of existingTags.data) {
          await apiClient.delete('tag_assignments', assignment.id);
        }
      }
      
      // ???œê·¸ ? ë‹¹
      if (tagIds.length > 0) {
        for (const tagId of tagIds) {
          await apiClient.post('tag_assignments', {
            entity_id: studentId,
            entity_type: 'student',
            tag_id: tagId,
          });
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tags', tenantId, 'student', variables.studentId] });
      queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
    },
  });
}

// ==================== ?™ìƒ ë°?ë°°ì • ê´€ë¦?====================

/**
 * ?™ìƒ??ë°?ëª©ë¡ ì¡°íšŒ Hook
 * [?”êµ¬?¬í•­] ?¤ì¤‘ ë°??Œì† ì§€??
 * [?˜ì •] PostgREST ì¡°ì¸ ë¬¸ë²• ?¤ë¥˜ ?˜ì •: ??ë²ˆì˜ ì¿¼ë¦¬ë¡?ë¶„ë¦¬
 */
export function useStudentClasses(studentId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['student-classes', tenantId, studentId],
    queryFn: async () => {
      if (!studentId) return [];

      // 1. student_classes ì¡°íšŒ
      const studentClassesResponse = await apiClient.get<any>('student_classes', {
        filters: { student_id: studentId, is_active: true },
        orderBy: { column: 'enrolled_at', ascending: false },
      });

      if (studentClassesResponse.error) {
        throw new Error(studentClassesResponse.error.message);
      }

      const studentClasses = studentClassesResponse.data || [];
      if (studentClasses.length === 0) return [];

      // 2. class_id ë°°ì—´ ì¶”ì¶œ
      const classIds = studentClasses.map((sc: any) => sc.class_id);

      // 3. academy_classes ì¡°íšŒ
      const classesResponse = await apiClient.get<Class>('academy_classes', {
        filters: { id: classIds },
      });

      if (classesResponse.error) {
        throw new Error(classesResponse.error.message);
      }

      const classes = classesResponse.data || [];
      const classMap = new Map(classes.map((c) => [c.id, c]));

      // 4. ì¡°í•©?˜ì—¬ ë°˜í™˜
      return studentClasses.map((sc: any) => ({
        ...sc,
        class: classMap.get(sc.class_id) || null,
      }));
    },
    enabled: !!tenantId && !!studentId,
  });
}

/**
 * ?™ìƒ ë°?ë°°ì • Hook
 * [?”êµ¬?¬í•­] ë°?ë°°ì •, ?¤ì¤‘ ë°??Œì† ì§€??
 * [?˜ì •] current_count ?˜ë™ ?…ë°?´íŠ¸ ?œê±° (Service Layer?ì„œ ì²˜ë¦¬?˜ë„ë¡?ë³€ê²??„ìš”)
 * [ì£¼ì˜] ?„ì¬??apiClientë¥??µí•´ ì§ì ‘ ?¸ì¶œ?˜ì?ë§? ?¥í›„ Edge Function?¼ë¡œ ?´ë™ ê¶Œì¥
 */
export function useAssignStudentToClass() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async ({
      studentId,
      classId,
      enrolledAt,
    }: {
      studentId: string;
      classId: string;
      enrolledAt?: string;
    }) => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // student_classes??ë°°ì •
      // [ì£¼ì˜] current_count ?…ë°?´íŠ¸??Industry Service??enrollStudentToClass?ì„œ ì²˜ë¦¬?´ì•¼ ??
      // ?„ì¬??apiClientë¥??µí•´ ì§ì ‘ ?¸ì¶œ?˜ì?ë§? ?¥í›„ Edge Function?¼ë¡œ ?´ë™ ê¶Œì¥
      const response = await apiClient.post<StudentClass>('student_classes', {
        student_id: studentId,
        class_id: classId,
        enrolled_at: enrolledAt || new Date().toISOString().split('T')[0],
        is_active: true,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // [?˜ì •] current_count ?˜ë™ ?…ë°?´íŠ¸ ?œê±°
      // current_count??Industry Service??enrollStudentToClass ë©”ì„œ?œì—??ì²˜ë¦¬?˜ê±°??
      // PostgreSQL ?¸ë¦¬ê±°ë¡œ ?ë™ ?…ë°?´íŠ¸?˜ì–´????
      // TODO: Edge Function???µí•´ enrollStudentToClass ?¸ì¶œë¡?ë³€ê²?

      return response.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['student-classes', tenantId, variables.studentId] });
      queryClient.invalidateQueries({ queryKey: ['classes', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
    },
  });
}

/**
 * ?™ìƒ ë°??´ë™/?´ì œ Hook
 * [?”êµ¬?¬í•­] ë°??´ë™, ?¤ì¤‘ ë°??Œì† ì§€??
 * [?˜ì •] current_count ?˜ë™ ?…ë°?´íŠ¸ ?œê±° (Service Layer?ì„œ ì²˜ë¦¬?˜ë„ë¡?ë³€ê²??„ìš”)
 * [ì£¼ì˜] ?„ì¬??apiClientë¥??µí•´ ì§ì ‘ ?¸ì¶œ?˜ì?ë§? ?¥í›„ Edge Function?¼ë¡œ ?´ë™ ê¶Œì¥
 */
export function useUnassignStudentFromClass() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async ({
      studentId,
      classId,
      leftAt,
    }: {
      studentId: string;
      classId: string;
      leftAt?: string;
    }) => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // student_classes?ì„œ ?´ë‹¹ ë°°ì • ì°¾ê¸°
      const findResponse = await apiClient.get('student_classes', {
        filters: { student_id: studentId, class_id: classId, is_active: true },
        limit: 1,
      });

      if (findResponse.error || !findResponse.data?.[0]) {
        throw new Error('Student class assignment not found');
      }

      const assignment = findResponse.data[0];

      // is_activeë¥?falseë¡?ë³€ê²½í•˜ê³?left_at ?¤ì •
      // [ì£¼ì˜] current_count ?…ë°?´íŠ¸??Industry Service??unenrollStudentFromClass?ì„œ ì²˜ë¦¬?´ì•¼ ??
      // ?„ì¬??apiClientë¥??µí•´ ì§ì ‘ ?¸ì¶œ?˜ì?ë§? ?¥í›„ Edge Function?¼ë¡œ ?´ë™ ê¶Œì¥
      const response = await apiClient.patch('student_classes', assignment.id, {
        is_active: false,
        left_at: leftAt || new Date().toISOString().split('T')[0],
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // [?˜ì •] current_count ?˜ë™ ?…ë°?´íŠ¸ ?œê±°
      // current_count??Industry Service??unenrollStudentFromClass ë©”ì„œ?œì—??ì²˜ë¦¬?˜ê±°??
      // PostgreSQL ?¸ë¦¬ê±°ë¡œ ?ë™ ?…ë°?´íŠ¸?˜ì–´????
      // TODO: Edge Function???µí•´ unenrollStudentFromClass ?¸ì¶œë¡?ë³€ê²?

      return response.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['student-classes', tenantId, variables.studentId] });
      queryClient.invalidateQueries({ queryKey: ['classes', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
    },
  });
}

