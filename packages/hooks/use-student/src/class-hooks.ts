/**
 * Class Hooks
 *
 * [SSOT] 학생-수업 배정 도메인 쿼리/뮤테이션 훅
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import { toKST } from '@lib/date-utils'; // 기술문서 5-2: KST 변환 필수
import { useSession } from '@hooks/use-auth';
import { recordMutationAudit } from './audit-mutation';
import type { StudentClass } from '@services/student-service';
import type { Class } from '@services/class-service';

// ==================== 학생 수업 배정 관리 ====================

/**
 * 모든 학생의 수업 배정 정보 조회 Hook
 * [요구사항] 수업배정 탭에서 전체 학생별 수업 배정 현황 표시
 */
/**
 * 전체 학생-수업 배정 조회 Hook
 * [성능 개선] enabled 옵션 추가하여 조건부 로딩 지원
 * [주의] limit: 10,000으로 대용량 데이터 조회
 */
export function useAllStudentClasses(options?: { enabled?: boolean }) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['all-student-classes', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      // [성능 개선 2026-01-27] limit 축소: 10000 → 1000 (최근 1000건만 조회)
      // TODO: 서버 측 집계 또는 페이지네이션으로 전환 필요
      // 현실적으로 대부분 학원은 학생 500명 이하이므로 1000건이면 충분
      const response = await apiClient.get<StudentClass>('student_classes', {
        filters: { is_active: true },
        orderBy: { column: 'enrolled_at', ascending: false },
        limit: 1000,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // 학생별로 그룹화
      const studentClassMap = new Map<string, string[]>();
      (response.data || []).forEach((sc: StudentClass) => {
        const existing = studentClassMap.get(sc.student_id) || [];
        existing.push(sc.class_id);
        studentClassMap.set(sc.student_id, existing);
      });

      // 배열로 변환
      return Array.from(studentClassMap.entries()).map(([student_id, class_ids]) => ({
        student_id,
        class_ids,
      }));
    },
    enabled: options?.enabled !== undefined ? (!!tenantId && options.enabled) : !!tenantId,
    staleTime: 5 * 60 * 1000,  // 5분 (수업 배정은 자주 변경되지 않음)
    gcTime: 10 * 60 * 1000,    // 10분
  });
}

/**
 * 학생의 수업 목록 조회 Hook
 * [요구사항] 수강 중인 수업 지속 지원
 * [수정] PostgREST 조인 문법 오류 수정: 두 번의 쿼리로 분리
 */
export function useStudentClasses(studentId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['student-classes', tenantId, studentId],
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    queryFn: async () => {
      if (!studentId) return [];

      // 1. student_classes 조회
      const studentClassesResponse = await apiClient.get<StudentClass>('student_classes', {
        filters: { student_id: studentId, is_active: true },
        orderBy: { column: 'enrolled_at', ascending: false },
      });

      if (studentClassesResponse.error) {
        throw new Error(studentClassesResponse.error.message);
      }

      const studentClasses = studentClassesResponse.data || [];
      if (studentClasses.length === 0) return [];

      // 2. class_id 배열 추출
      const classIds = studentClasses.map((sc: StudentClass) => sc.class_id);

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
      return studentClasses.map((sc: StudentClass) => ({
        ...sc,
        class: classMap.get(sc.class_id) || null,
      }));
    },
    enabled: !!tenantId && !!studentId,
  });
}

/**
 * 학생 반 배정 Hook
 * [요구사항] 반 배정, 수강 중인 반 지속 지원
 * [수정] current_count 자동 업데이트 제거 (Service Layer에서 처리하도록 변경 필요)
 * [주의] 현재는 apiClient를 통해 직접 호출하나, 향후 Edge Function으로 이동 권장
 */
export function useAssignStudentToClass() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

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
      const startTime = Date.now();
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // student_classes에 배정
      // [주의] current_count 업데이트는 Industry Service의 enrollStudentToClass에서 처리해야 함
      // 현재는 apiClient를 통해 직접 호출하나, 향후 Edge Function으로 이동 권장
      const enrolledDate = enrolledAt || toKST().format('YYYY-MM-DD');

      // [성능 최적화] INSERT-first 패턴: 대부분의 경우 새 레코드이므로 INSERT를 먼저 시도
      // 409 Conflict (duplicate key) 오류가 발생하면 UPDATE로 처리
      // 이 방식이 기존 레코드를 먼저 조회하는 방식보다 효율적 (네트워크 요청 1회 감소)
      let response = await apiClient.post<StudentClass>('student_classes', {
        student_id: studentId,
        class_id: classId,
        // 기술문서 5-2: KST 기준 날짜 처리
        enrolled_at: enrolledDate,
        is_active: true,
      });

      // [불변 규칙] 중복 키 오류 처리: unique constraint 위반 시 UPDATE로 전환
      // unique constraint: student_classes_student_id_class_id_enrolled_at_key
      // PostgreSQL 에러 코드: 23505 (unique_violation)
      // [안정성] 에러 코드와 메시지 모두 체크하여 중복 키 오류를 정확히 감지
      const originalErrorMessage = response.error?.message;
      const isDuplicateKeyError = response.error && (
        response.error.code === '23505' ||
        response.error.message?.includes('duplicate key') ||
        response.error.message?.includes('unique constraint')
      );

      if (isDuplicateKeyError) {
        // 중복 키 오류 발생: 기존 레코드를 조회하여 UPDATE
        const existingResponse = await apiClient.get<StudentClass>('student_classes', {
          filters: {
            student_id: studentId,
            class_id: classId,
            enrolled_at: enrolledDate
          },
          limit: 1,
        });

        // [안정성] 에러 처리: 기존 레코드 조회 실패 시 원본 오류를 유지
        if (existingResponse.error || !existingResponse.data || existingResponse.data.length === 0) {
          throw new Error(originalErrorMessage || 'Failed to find existing record for update');
        }

        const existing = existingResponse.data[0];
        response = await apiClient.patch<StudentClass>('student_classes', existing.id, {
          is_active: true,
          // left_at이 있으면 제거 (재등록)
          left_at: null,
        });
      }

      // [안정성] 타입 안정성: response.data가 undefined인 경우 명시적 에러 처리
      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data) {
        throw new Error('Failed to assign student to class: No data returned');
      }

      // [Phase 4 잔여] current_count는 PostgreSQL 트리거 또는 Edge Function에서 처리 필요
      // Zero-Trust 원칙 상 Edge Function을 통한 enrollStudentToClass 호출로 전환 권장

      // Execution Audit 기록
      await recordMutationAudit(startTime, session?.user?.id, {
        operation_type: 'student.assign-class',
        status: 'success',
        summary: `학생 반 배정 완료 (class_id: ${classId})`,
        details: { student_id: studentId, class_id: classId },
        reference: { entity_type: 'student', entity_id: studentId },
      });

      return response.data;
    },
    onSuccess: (_, variables) => {
      // [성능 최적화] 캐시 무효화를 배치로 처리 (React Query v5 최적화)
      void queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            (key[0] === 'student-classes' && key[1] === tenantId && key[2] === variables.studentId) ||
            (key[0] === 'all-student-classes' && key[1] === tenantId) ||
            (key[0] === 'classes' && key[1] === tenantId) ||
            (key[0] === 'students' && key[1] === tenantId)
          );
        }
      });
    },
  });
}

/**
 * 학생 반 이동/제거 Hook
 * [요구사항] 반 이동, 수강 중인 반 지속 지원
 * [수정] current_count 자동 업데이트 제거 (Service Layer에서 처리하도록 변경 필요)
 * [주의] 현재는 apiClient를 통해 직접 호출하나, 향후 Edge Function으로 이동 권장
 */
export function useUnassignStudentFromClass() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

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

      const startTime = Date.now();

      // student_classes에서 해당 배정 찾기
      const findResponse = await apiClient.get<StudentClass>('student_classes', {
        filters: { student_id: studentId, class_id: classId, is_active: true },
        limit: 1,
      });

      if (findResponse.error || !findResponse.data?.[0]) {
        throw new Error('Student class assignment not found');
      }

      const assignment = findResponse.data[0];

      // is_active를 false로 변경하고 left_at 설정
      // [주의] current_count 업데이트는 Industry Service의 unenrollStudentFromClass에서 처리해야 함
      // 현재는 apiClient를 통해 직접 호출하나, 향후 Edge Function으로 이동 권장
      const response = await apiClient.patch('student_classes', assignment.id, {
        is_active: false,
        // 기술문서 5-2: KST 기준 날짜 처리
        left_at: leftAt || toKST().format('YYYY-MM-DD'),
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // [안정성] 타입 안정성: response.data가 undefined인 경우 명시적 에러 처리
      if (!response.data) {
        throw new Error('Failed to unassign student from class: No data returned');
      }

      // [Phase 4 잔여] current_count는 PostgreSQL 트리거 또는 Edge Function에서 처리 필요
      // Zero-Trust 원칙 상 Edge Function을 통한 unenrollStudentFromClass 호출로 전환 권장

      // Execution Audit 기록
      await recordMutationAudit(startTime, session?.user?.id, {
        operation_type: 'student.unassign-class',
        status: 'success',
        summary: `학생 반 배정 제거 완료 (class_id: ${classId})`,
        details: { student_id: studentId, class_id: classId },
        reference: { entity_type: 'student', entity_id: studentId },
      });

      return response.data;
    },
    onSuccess: (_, variables) => {
      // [성능 최적화] 캐시 무효화를 배치로 처리 (React Query v5 최적화)
      void queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            (key[0] === 'student-classes' && key[1] === tenantId && key[2] === variables.studentId) ||
            (key[0] === 'all-student-classes' && key[1] === tenantId) ||
            (key[0] === 'classes' && key[1] === tenantId) ||
            (key[0] === 'students' && key[1] === tenantId)
          );
        }
      });
    },
  });
}

/**
 * 학생 반 배정일(enrolled_at) 업데이트 Hook
 * [P0-2] App Layer 분리 원칙 준수: UI에서 직접 apiClient.patch 호출 제거
 * [요구사항] 같은 반일 때 enrolled_at만 업데이트
 * [주의] 현재는 apiClient를 통해 직접 호출하나, 향후 Edge Function으로 이동 권장
 */
export function useUpdateStudentClassEnrolledAt() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({
      studentClassId,
      enrolledAt,
    }: {
      studentClassId: string;
      enrolledAt: string;
    }) => {
      const startTime = Date.now();
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // student_classes의 enrolled_at만 업데이트
      // [주의] current_count 업데이트는 필요 없음 (같은 수업이므로 학생 수 변화 없음)
      const response = await apiClient.patch<StudentClass>('student_classes', studentClassId, {
        // 기술문서 5-2: KST 기준 날짜 처리
        enrolled_at: enrolledAt,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data) {
        throw new Error('Failed to update student class enrolled_at: No data returned');
      }

      // Execution Audit 기록
      await recordMutationAudit(startTime, session?.user?.id, {
        operation_type: 'student.update-class-enrolled-at',
        status: 'success',
        summary: `학생 반 등록일 수정 완료`,
        details: { student_class_id: studentClassId, new_enrolled_at: enrolledAt },
        reference: { entity_type: 'student_class', entity_id: studentClassId },
      });

      return response.data;
    },
    onSuccess: () => {
      // [성능 최적화] 캐시 무효화를 배치로 처리 (React Query v5 최적화)
      // studentClassId로 student_id를 찾을 수 없으므로, 모든 student-classes 쿼리 무효화
      void queryClient.invalidateQueries({ queryKey: ['student-classes', tenantId] });
      void queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
    },
  });
}

/**
 * 학생-수업 배정 페이지네이션 Hook
 * [성능 개선 2026-01-27] 전체 데이터 로딩 대신 필요한 만큼만 조회
 */
export function useStudentClassesPaged(options: {
  page?: number;
  pageSize?: number;
  isActive?: boolean;
  classId?: string;
  enabled?: boolean;
}) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  const {
    page = 1,
    pageSize = 50,
    isActive = true,
    classId,
    enabled = true,
  } = options;

  return useQuery({
    queryKey: ['student-classes', tenantId, 'paged', page, pageSize, isActive, classId],
    queryFn: async () => {
      if (!tenantId) {
        return { studentClasses: [], totalCount: 0 };
      }

      const filters: Record<string, unknown> = { is_active: isActive };
      if (classId) {
        filters.class_id = classId;
      }

      const offset = (page - 1) * pageSize;
      const response = await apiClient.get<StudentClass>('student_classes', {
        filters,
        orderBy: { column: 'enrolled_at', ascending: false },
        range: { from: offset, to: offset + pageSize - 1 },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // 전체 개수 조회
      const countResponse = await apiClient.get<StudentClass>('student_classes', {
        filters,
        count: 'exact',
        limit: 1,
      });

      const totalCount = countResponse.count || 0;

      return {
        studentClasses: response.data || [],
        totalCount,
      };
    },
    enabled: !!tenantId && enabled,
    staleTime: 2 * 60 * 1000, // 2분
    gcTime: 5 * 60 * 1000, // 5분
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * 서버 측 통계 집계 Hook
 * [성능 개선 2026-01-27] 클라이언트에서 집계하지 않고 서버에서 집계
 */
export function useStudentStatsAggregation(options: {
  aggregationType: 'tag_stats' | 'class_stats' | 'status_stats' | 'consultation_stats';
  filters?: {
    date_from?: string;
    date_to?: string;
    is_active?: boolean;
  };
  enabled?: boolean;
}) {
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { aggregationType, filters, enabled = true } = options;

  return useQuery({
    queryKey: ['student-stats', tenantId, aggregationType, filters],
    queryFn: async () => {
      if (!tenantId) return [];

      // Edge Function 호출
      const response = await apiClient.callEdgeFunction('student-stats-aggregation', {
        aggregationType,
        filters,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data || [];
    },
    enabled: !!tenantId && enabled,
    staleTime: 5 * 60 * 1000, // 5분 (통계는 자주 변경되지 않음)
    gcTime: 10 * 60 * 1000, // 10분
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
