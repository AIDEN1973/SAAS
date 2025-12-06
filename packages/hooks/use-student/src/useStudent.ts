/**
 * useStudent Hook
 * 
 * React Query 기반 학생 관리 Hook
 * [불변 규칙] tenant 변경 시 invalidateQueries() 자동 발생
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentService } from '@services/student-service';
import type {
  CreateStudentInput,
  UpdateStudentInput,
  StudentFilter,
} from '@services/student-service';

export interface UseStudentOptions {
  tenantId: string;
  industryType: string;
  userId?: string;
}

/**
 * 학생 목록 조회 Hook
 */
export function useStudents(
  options: UseStudentOptions,
  filter?: StudentFilter
) {
  return useQuery({
    queryKey: ['students', options.tenantId, filter],
    queryFn: () => studentService.getStudents(options.tenantId, filter),
    enabled: !!options.tenantId,
  });
}

/**
 * 학생 상세 조회 Hook
 */
export function useStudent(
  options: UseStudentOptions,
  studentId: string | null
) {
  return useQuery({
    queryKey: ['student', options.tenantId, studentId],
    queryFn: () => {
      if (!studentId) return null;
      return studentService.getStudent(options.tenantId, studentId);
    },
    enabled: !!options.tenantId && !!studentId,
  });
}

/**
 * 학생 생성 Hook
 */
export function useCreateStudent(options: UseStudentOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateStudentInput) =>
      studentService.createStudent(
        options.tenantId,
        options.industryType,
        input,
        options.userId
      ),
    onSuccess: () => {
      // 학생 목록 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['students', options.tenantId] });
    },
  });
}

/**
 * 학생 수정 Hook
 */
export function useUpdateStudent(options: UseStudentOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      studentId,
      input,
    }: {
      studentId: string;
      input: UpdateStudentInput;
    }) =>
      studentService.updateStudent(
        options.tenantId,
        studentId,
        input,
        options.userId
      ),
    onSuccess: (data) => {
      // 학생 목록 및 상세 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['students', options.tenantId] });
      queryClient.invalidateQueries({
        queryKey: ['student', options.tenantId, data.id],
      });
    },
  });
}

/**
 * 학생 삭제 Hook
 */
export function useDeleteStudent(options: UseStudentOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (studentId: string) =>
      studentService.deleteStudent(
        options.tenantId,
        studentId,
        options.userId
      ),
    onSuccess: () => {
      // 학생 목록 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['students', options.tenantId] });
    },
  });
}

/**
 * 학부모 목록 조회 Hook
 */
export function useGuardians(
  options: UseStudentOptions,
  studentId: string | null
) {
  return useQuery({
    queryKey: ['guardians', options.tenantId, studentId],
    queryFn: () => {
      if (!studentId) return [];
      return studentService.getGuardians(options.tenantId, studentId);
    },
    enabled: !!options.tenantId && !!studentId,
  });
}

/**
 * 학생 태그 목록 조회 Hook (core-tags 활용)
 */
export function useStudentTags(options: UseStudentOptions) {
  return useQuery({
    queryKey: ['tags', options.tenantId, 'student'],
    queryFn: () => studentService.getTags(options.tenantId),
    enabled: !!options.tenantId,
  });
}

/**
 * 학생의 태그 조회 Hook (core-tags 활용)
 */
export function useStudentTagsByStudent(
  options: UseStudentOptions,
  studentId: string | null
) {
  return useQuery({
    queryKey: ['tags', options.tenantId, 'student', studentId],
    queryFn: () => {
      if (!studentId) return [];
      return studentService.getStudentTags(options.tenantId, studentId);
    },
    enabled: !!options.tenantId && !!studentId,
  });
}

/**
 * 상담일지 목록 조회 Hook
 */
export function useConsultations(
  options: UseStudentOptions,
  studentId: string | null
) {
  return useQuery({
    queryKey: ['consultations', options.tenantId, studentId],
    queryFn: () => {
      if (!studentId) return [];
      return studentService.getConsultations(options.tenantId, studentId);
    },
    enabled: !!options.tenantId && !!studentId,
  });
}

