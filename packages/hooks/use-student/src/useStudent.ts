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
} from '@services/student-service';

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
      
      const response = await apiClient.get<Student>('students', {
        filters: { id: studentId },
        limit: 1,
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      return response.data?.[0] || null;
    },
    enabled: !!tenantId && !!studentId,
  });
}

/**
 * 학생 생성 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function useCreateStudent() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async (input: CreateStudentInput) => {
      const response = await apiClient.post<Student>('students', {
        ...input,
        status: input.status || 'active',
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
 * 학생 수정 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
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
      const response = await apiClient.patch<Student>('students', studentId, input);
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      return response.data!;
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

