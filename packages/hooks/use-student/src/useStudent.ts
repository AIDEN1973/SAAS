/**
 * useStudent Hook
 * 
 * React Query 기반 학생 관리 Hook
 * [불변 규칙] tenant 변경 시 invalidateQueries() 자동 발생
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
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
 * 학생 목록 조회 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function useStudents(filter?: StudentFilter) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['students', tenantId, filter],
    queryFn: async () => {
      // [불변 규칙] 기술문서 정책: "Core Party 테이블 + 업종별 확장 테이블" 패턴 사용
      // persons + academy_students를 직접 조인하여 조회 (View 대신)
      // PostgREST가 View를 인식하지 못하는 문제를 우회하기 위해 직접 조인 사용
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

      // 데이터 변환: persons + academy_students → Student
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

      // 클라이언트 측 필터링
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
 * 학생 상세 조회 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function useStudent(studentId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['student', tenantId, studentId],
    queryFn: async () => {
      if (!studentId) return null;
      
      // students View를 사용하여 조회 (persons + academy_students 조인)
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
      
      // 데이터 변환: persons + academy_students → Student
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
 * 학생 생성 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 * [불변 규칙] students는 View이므로 persons + academy_students를 각각 생성해야 함
 */
export function useCreateStudent() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const industryType = context.industryType || 'academy';

  return useMutation({
    mutationFn: async (input: CreateStudentInput) => {
      // 1. persons 테이블에 생성 (공통 필드)
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
      
      // 2. academy_students 테이블에 확장 정보 저장
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
        // 롤백: persons 삭제
        await apiClient.delete('persons', person.id);
        throw new Error(academyResponse.error.message);
      }
      
      // 3. 학부모 정보 생성
      if (input.guardians && input.guardians.length > 0) {
        for (const guardian of input.guardians) {
          await apiClient.post('guardians', {
            student_id: person.id,
            ...guardian,
          });
        }
      }
      
      // 4. 태그 연결
      if (input.tag_ids && input.tag_ids.length > 0) {
        for (const tagId of input.tag_ids) {
          await apiClient.post('tag_assignments', {
            entity_id: person.id,
            entity_type: 'student',
            tag_id: tagId,
          });
        }
      }
      
      // 5. 결과 반환 (persons + academy_students 조합)
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
      // 학생 목록 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
    },
  });
}

/**
 * 학생 일괄 등록 Hook (엑셀)
 * [요구사항] 학생 일괄 등록(엑셀)
 */
export function useBulkCreateStudents() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const industryType = context.industryType || 'academy';

  return useMutation({
    mutationFn: async (students: CreateStudentInput[]) => {
      // [불변 규칙] api-sdk를 통해서만 데이터 요청
      // 일괄 등록은 여러 개의 POST 요청으로 처리
      const results: Student[] = [];
      const errors: Array<{ index: number; error: string }> = [];

      for (let i = 0; i < students.length; i++) {
        try {
          // 1. persons 테이블에 생성
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
          
          // 2. academy_students 테이블에 확장 정보 저장
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
            // 롤백: persons 삭제
            await apiClient.delete('persons', person.id);
            throw new Error(academyResponse.error.message);
          }
          
          // 3. 결과 반환
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
        console.warn('일부 학생 등록 실패:', errors);
      }

      return { results, errors };
    },
    onSuccess: () => {
      // 학생 목록 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
    },
  });
}

/**
 * 학생 수정 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 * [불변 규칙] students는 View이므로 persons와 academy_students를 각각 업데이트해야 함
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
      // 1. persons 테이블 업데이트 (공통 필드)
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

      // 2. academy_students 테이블 업데이트 (업종 특화 필드)
      const academyUpdate: any = {};
      if (input.birth_date !== undefined) academyUpdate.birth_date = input.birth_date;
      if (input.gender !== undefined) academyUpdate.gender = input.gender;
      if (input.school_name !== undefined) academyUpdate.school_name = input.school_name;
      if (input.grade !== undefined) academyUpdate.grade = input.grade;
      if (input.status !== undefined) academyUpdate.status = input.status;
      if (input.notes !== undefined) academyUpdate.notes = input.notes;
      if (input.profile_image_url !== undefined) academyUpdate.profile_image_url = input.profile_image_url;

      if (Object.keys(academyUpdate).length > 0) {
        // academy_students는 person_id를 PK로 사용하므로 person_id로 조회 후 업데이트
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

      // 3. 업데이트된 데이터 조회하여 반환
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
      // 학생 목록 및 상세 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
      queryClient.invalidateQueries({
        queryKey: ['student', tenantId, data.id],
      });
    },
  });
}

/**
 * 학생 삭제 Hook (Soft delete: status를 'withdrawn'으로 변경)
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function useDeleteStudent() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async (studentId: string) => {
      // Soft delete: status를 'withdrawn'으로 변경
      const response = await apiClient.patch<Student>('students', studentId, {
        status: 'withdrawn',
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      return response.data!;
    },
    onSuccess: () => {
      // 학생 목록 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
    },
  });
}

/**
 * 학부모 목록 조회 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
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
 * 학생 태그 목록 조회 Hook (core-tags 활용)
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 * TODO: API SDK를 통해 태그 조회 구현 필요
 */
export function useStudentTags() {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['tags', tenantId, 'student'],
    queryFn: async () => {
      // TODO: API SDK를 통해 태그 조회
      // 현재는 빈 배열 반환
      return [];
    },
    enabled: !!tenantId,
  });
}

/**
 * 학생의 태그 조회 Hook (core-tags 활용)
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 * TODO: API SDK를 통해 태그 조회 구현 필요
 */
export function useStudentTagsByStudent(studentId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['tags', tenantId, 'student', studentId],
    queryFn: async () => {
      if (!studentId) return [];
      // TODO: API SDK를 통해 태그 조회
      // 현재는 빈 배열 반환
      return [];
    },
    enabled: !!tenantId && !!studentId,
  });
}

/**
 * 상담일지 목록 조회 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
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
 * 상담일지 생성 Hook
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
 * 상담일지 수정 Hook
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
 * 상담일지 삭제 Hook
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
 * 상담일지 AI 요약 생성 Hook
 * [요구사항] 상담일지 AI 요약 버튼 삽입
 * 
 * [불변 규칙] Phase 1에서는 플레이스홀더로 구현
 * 실제 AI 연동은 Edge Function 또는 외부 AI 서비스를 통해 구현 예정
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
      // [불변 규칙] api-sdk를 통해서만 데이터 요청
      // 1. 상담일지 조회
      const consultationResponse = await apiClient.get<any>('student_consultations', {
        filters: { id: consultationId },
        limit: 1,
      });
      
      if (consultationResponse.error || !consultationResponse.data || consultationResponse.data.length === 0) {
        throw new Error('상담일지를 찾을 수 없습니다.');
      }
      
      const consultation = consultationResponse.data[0];
      
      // 2. AI 요약 생성 (Phase 1: 플레이스홀더)
      // TODO: 실제 AI 서비스 연동 (Edge Function 또는 외부 AI API)
      const placeholderSummary = `[AI 요약] ${consultation.content.substring(0, 100)}... (요약 기능은 곧 제공될 예정입니다.)`;
      
      // 3. ai_summary 업데이트
      const updateResponse = await apiClient.patch('student_consultations', consultationId, {
        ai_summary: placeholderSummary,
      });
      
      if (updateResponse.error) {
        throw new Error(updateResponse.error.message);
      }
      
      return placeholderSummary;
    },
    onSuccess: (_, variables) => {
      // 상담일지 목록 쿼리 무효화하여 AI 요약 반영
      queryClient.invalidateQueries({ queryKey: ['consultations', tenantId, variables.studentId] });
    },
  });
}

/**
 * 학부모 생성 Hook
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
 * 학부모 수정 Hook
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
 * 학부모 삭제 Hook
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
 * 학생 태그 업데이트 Hook
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
      // 기존 태그 할당 제거
      const existingTags = await apiClient.get('tag_assignments', {
        filters: { entity_id: studentId, entity_type: 'student' },
      });
      
      if (existingTags.data) {
        for (const assignment of existingTags.data) {
          await apiClient.delete('tag_assignments', assignment.id);
        }
      }
      
      // 새 태그 할당
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

// ==================== 학생 반 배정 관리 ====================

/**
 * 학생의 반 목록 조회 Hook
 * [요구사항] 다중 반 소속 지원
 * [수정] PostgREST 조인 문법 오류 수정: 두 번의 쿼리로 분리
 */
export function useStudentClasses(studentId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['student-classes', tenantId, studentId],
    queryFn: async () => {
      if (!studentId) return [];

      // 1. student_classes 조회
      const studentClassesResponse = await apiClient.get<any>('student_classes', {
        filters: { student_id: studentId, is_active: true },
        orderBy: { column: 'enrolled_at', ascending: false },
      });

      if (studentClassesResponse.error) {
        throw new Error(studentClassesResponse.error.message);
      }

      const studentClasses = studentClassesResponse.data || [];
      if (studentClasses.length === 0) return [];

      // 2. class_id 배열 추출
      const classIds = studentClasses.map((sc: any) => sc.class_id);

      // 3. academy_classes 조회
      const classesResponse = await apiClient.get<Class>('academy_classes', {
        filters: { id: classIds },
      });

      if (classesResponse.error) {
        throw new Error(classesResponse.error.message);
      }

      const classes = classesResponse.data || [];
      const classMap = new Map(classes.map((c) => [c.id, c]));

      // 4. 조합하여 반환
      return studentClasses.map((sc: any) => ({
        ...sc,
        class: classMap.get(sc.class_id) || null,
      }));
    },
    enabled: !!tenantId && !!studentId,
  });
}

/**
 * 학생 반 배정 Hook
 * [요구사항] 반 배정, 다중 반 소속 지원
 * [수정] current_count 수동 업데이트 제거 (Service Layer에서 처리하도록 변경 필요)
 * [주의] 현재는 apiClient를 통해 직접 호출하지만, 향후 Edge Function으로 이동 권장
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

      // student_classes에 배정
      // [주의] current_count 업데이트는 Industry Service의 enrollStudentToClass에서 처리해야 함
      // 현재는 apiClient를 통해 직접 호출하지만, 향후 Edge Function으로 이동 권장
      const response = await apiClient.post<StudentClass>('student_classes', {
        student_id: studentId,
        class_id: classId,
        enrolled_at: enrolledAt || new Date().toISOString().split('T')[0],
        is_active: true,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // [수정] current_count 수동 업데이트 제거
      // current_count는 Industry Service의 enrollStudentToClass 메서드에서 처리하거나
      // PostgreSQL 트리거로 자동 업데이트되어야 함
      // TODO: Edge Function을 통해 enrollStudentToClass 호출로 변경

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
 * 학생 반 이동/해제 Hook
 * [요구사항] 반 이동, 다중 반 소속 지원
 * [수정] current_count 수동 업데이트 제거 (Service Layer에서 처리하도록 변경 필요)
 * [주의] 현재는 apiClient를 통해 직접 호출하지만, 향후 Edge Function으로 이동 권장
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

      // student_classes에서 해당 배정 찾기
      const findResponse = await apiClient.get('student_classes', {
        filters: { student_id: studentId, class_id: classId, is_active: true },
        limit: 1,
      });

      if (findResponse.error || !findResponse.data?.[0]) {
        throw new Error('Student class assignment not found');
      }

      const assignment = findResponse.data[0];

      // is_active를 false로 변경하고 left_at 설정
      // [주의] current_count 업데이트는 Industry Service의 unenrollStudentFromClass에서 처리해야 함
      // 현재는 apiClient를 통해 직접 호출하지만, 향후 Edge Function으로 이동 권장
      const response = await apiClient.patch('student_classes', assignment.id, {
        is_active: false,
        left_at: leftAt || new Date().toISOString().split('T')[0],
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // [수정] current_count 수동 업데이트 제거
      // current_count는 Industry Service의 unenrollStudentFromClass 메서드에서 처리하거나
      // PostgreSQL 트리거로 자동 업데이트되어야 함
      // TODO: Edge Function을 통해 unenrollStudentFromClass 호출로 변경

      return response.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['student-classes', tenantId, variables.studentId] });
      queryClient.invalidateQueries({ queryKey: ['classes', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
    },
  });
}

