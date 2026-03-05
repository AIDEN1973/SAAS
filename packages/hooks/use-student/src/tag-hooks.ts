/**
 * Tag Hooks
 *
 * [SSOT] 학생 태그 도메인 쿼리/뮤테이션 훅
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import { useSession } from '@hooks/use-auth';
import { recordMutationAudit } from './audit-mutation';
import type { Tag, TagAssignment } from '@core/tags';

/**
 * 학생 태그 목록 조회 Hook (core-tags 사용)
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 * [Phase 4 잔여] API SDK를 통해 태그 조회 구현 필요
 */
export function useStudentTags() {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<Array<{ id: string; name: string; color: string }>>({
    queryKey: ['tags', tenantId, 'student'],
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    queryFn: async (): Promise<Array<{ id: string; name: string; color: string }>> => {
      if (!tenantId) return [];

      const response = await apiClient.get<Tag>('tags', {
        filters: { entity_type: 'student' },
        // 최신 태그가 먼저 보이도록 (요구사항)
        orderBy: { column: 'created_at', ascending: false },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // 안전장치: 서버 정렬이 보장되지 않는 환경에서도 최신이 먼저 오도록 클라이언트에서도 한 번 더 정렬
      const sorted = [...(response.data || [])].sort((a: Tag, b: Tag) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      return sorted.map((tag: Tag) => ({
        id: tag.id,
        name: tag.name,
        // 정본 규칙: 하드코딩 금지, CSS 변수 사용
        // tag.color이 없으면 CSS 변수 문자열을 반환 (런타임에 CSS 변수 값으로 해석됨)
        color: tag.color || 'var(--color-primary)',
      }));
    },
    enabled: !!tenantId,
  });
}

/**
 * 학생의 태그 조회 Hook (core-tags 사용)
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 * [Phase 4 잔여] API SDK를 통해 태그 조회 구현 필요
 */
export function useStudentTagsByStudent(studentId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<Array<{ id: string; name: string; color: string }>>({
    queryKey: ['tags', tenantId, 'student', studentId],
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    queryFn: async (): Promise<Array<{ id: string; name: string; color: string }>> => {
      if (!studentId || !tenantId) return [];

      // tag_assignments를 통해 학생의 태그 조회
      const assignmentsResponse = await apiClient.get<TagAssignment>('tag_assignments', {
        filters: { entity_id: studentId, entity_type: 'student' },
      });

      if (assignmentsResponse.error) {
        throw new Error(assignmentsResponse.error.message);
      }

      const assignments = assignmentsResponse.data || [];
      if (assignments.length === 0) return [];

      // 태그 ID 배열 추출
      const tagIds = assignments.map((a: TagAssignment) => a.tag_id);

      // 태그 상세 정보 조회
      const tagsResponse = await apiClient.get<Tag[]>('tags', {
        filters: { id: tagIds },
      });

      if (tagsResponse.error) {
        throw new Error(tagsResponse.error.message);
      }

      return (tagsResponse.data || []).map((tag) => {
        const tagData = tag as unknown as Tag;
        return {
          id: tagData.id,
          name: tagData.name,
          // 정본 규칙: 하드코딩 금지, CSS 변수 사용
          // tag.color이 없으면 CSS 변수 문자열을 반환 (런타임에 CSS 변수 값으로 해석됨)
          color: tagData.color || 'var(--color-primary)',
        };
      });
    },
    enabled: !!tenantId && !!studentId,
  });
}

/**
 * 전체 학생 태그 할당 정보 조회 Hook (통계용)
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 * [성능 개선 2026-01-27] 조건부 로딩 지원 (options.enabled)
 */
export function useAllStudentTagAssignments(options?: { enabled?: boolean }) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<Array<{ student_id: string; tag_id: string }>>({
    queryKey: ['tag_assignments', tenantId, 'student', 'all'],
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    queryFn: async (): Promise<Array<{ student_id: string; tag_id: string }>> => {
      if (!tenantId) return [];

      // [성능 개선 2026-01-27] limit 축소: 5000 → 1000 (최근 1000건만 조회)
      // [Phase 4 잔여] 서버 측 집계 또는 페이지네이션으로 전환 필요
      // 현실적으로 대부분 학원은 학생 500명 이하이므로 1000건이면 충분
      const assignmentsResponse = await apiClient.get<TagAssignment>('tag_assignments', {
        filters: { entity_type: 'student' },
        orderBy: { column: 'created_at', ascending: false },
        limit: 1000,
      });

      if (assignmentsResponse.error) {
        throw new Error(assignmentsResponse.error.message);
      }

      return (assignmentsResponse.data || []).map((a: TagAssignment) => ({
        student_id: a.entity_id,
        tag_id: a.tag_id,
      }));
    },
    enabled: options?.enabled !== undefined ? (!!tenantId && options.enabled) : !!tenantId,
    staleTime: 5 * 60 * 1000,  // 5분 (태그 할당은 자주 변경되지 않음)
    gcTime: 10 * 60 * 1000,    // 10분
  });
}

/**
 * 학생 태그 업데이트 Hook
 */
export function useUpdateStudentTags() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({
      studentId,
      tagIds,
    }: {
      studentId: string;
      tagIds: string[];
    }) => {
      const startTime = Date.now();

      // [N+1 최적화] 기존 태그 할당 조회
      const existingTags = await apiClient.get<TagAssignment>('tag_assignments', {
        filters: { entity_id: studentId, entity_type: 'student' },
      });

      // [N+1 최적화] 기존 태그 삭제를 병렬로 처리
      if (existingTags.data && existingTags.data.length > 0) {
        await Promise.all(
          existingTags.data.map((assignment) =>
            apiClient.delete('tag_assignments', assignment.id)
          )
        );
      }

      // [N+1 최적화] 새 태그 할당을 병렬로 처리
      if (tagIds.length > 0) {
        await Promise.all(
          tagIds.map((tagId) =>
            apiClient.post('tag_assignments', {
              entity_id: studentId,
              entity_type: 'student',
              tag_id: tagId,
            })
          )
        );
      }

      // Execution Audit 기록
      await recordMutationAudit(startTime, session?.user?.id, {
        operation_type: 'student.update-tags',
        status: 'success',
        summary: `학생 태그 업데이트 완료 (${tagIds.length}개 태그)`,
        details: { student_id: studentId, tag_count: tagIds.length },
        reference: { entity_type: 'student', entity_id: studentId },
      });
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['tags', tenantId, 'student', variables.studentId] });
      void queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
    },
  });
}
