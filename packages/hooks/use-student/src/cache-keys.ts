/**
 * 학생 관련 React Query 캐시 키 SSOT
 *
 * [불변 규칙] 모든 학생 관련 queryKey는 이 파일을 통해 생성
 * [불변 규칙] mutation 후 invalidation은 invalidateStudentRelated 함수 사용
 *
 * @see docu/프론트 자동화.md - React Query 키/파라미터 규칙
 */

import type { QueryClient } from '@tanstack/react-query';

/**
 * 학생 관련 캐시 키 생성 함수 모음
 *
 * 사용 예:
 * ```typescript
 * const queryKey = STUDENT_CACHE_KEYS.consultations(tenantId, studentId);
 * // ['consultations', tenantId, studentId]
 * ```
 */
export const STUDENT_CACHE_KEYS = {
  // ============================================================================
  // 학생 목록
  // ============================================================================

  /** 학생 목록 (필터 없음) */
  students: (tenantId: string) => ['students', tenantId] as const,

  /** 학생 목록 (페이지네이션) */
  studentsPaged: (tenantId: string) => ['students-paged', tenantId] as const,

  /** 학생 상세 */
  student: (tenantId: string, studentId: string) =>
    ['student', tenantId, studentId] as const,

  // ============================================================================
  // 보호자
  // ============================================================================

  /** 보호자 목록 (학생별 또는 전체) */
  guardians: (tenantId: string, studentId?: string) =>
    studentId
      ? (['guardians', tenantId, studentId] as const)
      : (['guardians', tenantId] as const),

  // ============================================================================
  // 상담 - 캐시 동기화 핵심
  // ============================================================================

  /** 특정 학생의 상담 목록 */
  consultations: (tenantId: string, studentId: string) =>
    ['consultations', tenantId, studentId] as const,

  /** 전체 상담 목록 (SubSidebar 상담관리 탭용) */
  consultationsAll: (tenantId: string) =>
    ['consultations', tenantId, 'all'] as const,

  // ============================================================================
  // 태그
  // ============================================================================

  /** 태그 목록 (엔티티 타입별) */
  tags: (tenantId: string, entityType: string = 'student') =>
    ['tags', tenantId, entityType] as const,

  /** 학생별 태그 목록 */
  tagsByStudent: (tenantId: string, studentId: string) =>
    ['tags', tenantId, 'student', studentId] as const,

  // ============================================================================
  // 수업 배정
  // ============================================================================

  /** 학생 수업 배정 목록 */
  studentClasses: (tenantId: string, studentId?: string) =>
    studentId
      ? (['student-classes', tenantId, studentId] as const)
      : (['student-classes', tenantId] as const),
} as const;

// ============================================================================
// 연관 캐시 일괄 무효화 함수
// ============================================================================

/**
 * 상담 관련 캐시 일괄 무효화
 *
 * RightLayerMenu에서 상담 수정 시 SubSidebar 상담관리 탭도 갱신되도록
 * 특정 학생의 상담 캐시와 전체 상담 캐시를 모두 무효화
 *
 * @param queryClient React Query 클라이언트
 * @param tenantId 테넌트 ID
 * @param studentId 학생 ID (선택적)
 */
export function invalidateStudentConsultations(
  queryClient: QueryClient,
  tenantId: string,
  studentId?: string
): void {
  // 특정 학생의 상담 캐시
  if (studentId) {
    queryClient.invalidateQueries({
      queryKey: STUDENT_CACHE_KEYS.consultations(tenantId, studentId),
    });
  }
  // 전체 상담 캐시도 무효화 (SubSidebar 상담관리 탭 갱신)
  queryClient.invalidateQueries({
    queryKey: STUDENT_CACHE_KEYS.consultationsAll(tenantId),
  });
}

/**
 * 학생 데이터 관련 캐시 일괄 무효화
 *
 * @param queryClient React Query 클라이언트
 * @param tenantId 테넌트 ID
 * @param studentId 학생 ID (선택적 - 특정 학생 상세도 무효화)
 */
export function invalidateStudentData(
  queryClient: QueryClient,
  tenantId: string,
  studentId?: string
): void {
  queryClient.invalidateQueries({
    queryKey: STUDENT_CACHE_KEYS.students(tenantId),
  });
  queryClient.invalidateQueries({
    queryKey: STUDENT_CACHE_KEYS.studentsPaged(tenantId),
  });
  if (studentId) {
    queryClient.invalidateQueries({
      queryKey: STUDENT_CACHE_KEYS.student(tenantId, studentId),
    });
  }
}

/**
 * 보호자 관련 캐시 일괄 무효화
 *
 * @param queryClient React Query 클라이언트
 * @param tenantId 테넌트 ID
 * @param studentId 학생 ID
 */
export function invalidateGuardians(
  queryClient: QueryClient,
  tenantId: string,
  studentId: string
): void {
  queryClient.invalidateQueries({
    queryKey: STUDENT_CACHE_KEYS.guardians(tenantId, studentId),
  });
}

/**
 * 태그 관련 캐시 일괄 무효화
 *
 * @param queryClient React Query 클라이언트
 * @param tenantId 테넌트 ID
 * @param studentId 학생 ID
 */
export function invalidateStudentTags(
  queryClient: QueryClient,
  tenantId: string,
  studentId: string
): void {
  queryClient.invalidateQueries({
    queryKey: STUDENT_CACHE_KEYS.tagsByStudent(tenantId, studentId),
  });
  // 학생 목록에서 태그 필터링이 변경될 수 있으므로 학생 데이터도 갱신
  queryClient.invalidateQueries({
    queryKey: STUDENT_CACHE_KEYS.students(tenantId),
  });
}

/**
 * 수업 배정 관련 캐시 일괄 무효화
 *
 * @param queryClient React Query 클라이언트
 * @param tenantId 테넌트 ID
 * @param studentId 학생 ID (선택적)
 */
export function invalidateStudentClasses(
  queryClient: QueryClient,
  tenantId: string,
  studentId?: string
): void {
  queryClient.invalidateQueries({
    queryKey: STUDENT_CACHE_KEYS.studentClasses(tenantId, studentId),
  });
  // 학생 목록에서 수업 필터링이 변경될 수 있으므로 학생 데이터도 갱신
  queryClient.invalidateQueries({
    queryKey: STUDENT_CACHE_KEYS.students(tenantId),
  });
}
