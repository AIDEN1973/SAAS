/**
 * Guardian Hooks
 *
 * [SSOT] 보호자 도메인 쿼리/뮤테이션 훅
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import { useSession } from '@hooks/use-auth';
import { recordMutationAudit } from './audit-mutation';
import type { Guardian } from '@services/student-service';

/**
 * 보호자 목록 조회 함수 (Hook의 queryFn 로직을 재사용)
 * [불변 규칙] useQuery 내부에서도 이 함수를 사용하여 일관성 유지
 */
export async function fetchGuardians(
  tenantId: string,
  filter?: { student_id?: string | string[]; is_primary?: boolean }
): Promise<Guardian[]> {
  if (!tenantId) return [];

  const filters: Record<string, unknown> = {};
  if (filter?.student_id) {
    filters.student_id = filter.student_id;
  }
  if (filter?.is_primary !== undefined) {
    filters.is_primary = filter.is_primary;
  }

  const response = await apiClient.get<Guardian>('guardians', {
    filters,
    orderBy: { column: 'is_primary', ascending: false },
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return (response.data || []);
}

/**
 * 보호자 목록 조회 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function useGuardians(studentId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['guardians', tenantId, studentId],
    queryFn: () => fetchGuardians(tenantId!, studentId ? { student_id: studentId } : undefined),
    enabled: !!tenantId && !!studentId,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * 보호자 생성 Hook
 */
export function useCreateGuardian() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({
      studentId,
      guardian,
    }: {
      studentId: string;
      guardian: Omit<Guardian, 'id' | 'tenant_id' | 'student_id' | 'created_at' | 'updated_at'>;
    }) => {
      const startTime = Date.now();

      const response = await apiClient.post<Guardian>('guardians', {
        student_id: studentId,
        ...guardian,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Execution Audit 기록
      await recordMutationAudit(startTime, session?.user?.id, {
        operation_type: 'guardian.register',
        status: 'success',
        summary: `${guardian.name || '보호자'} 등록 완료`,
        details: { guardian_id: response.data!.id, student_id: studentId },
        reference: { entity_type: 'guardian', entity_id: response.data!.id },
      });

      return response.data!;
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['guardians', tenantId, variables.studentId] });
    },
  });
}

/**
 * 보호자 수정 Hook
 */
export function useUpdateGuardian() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({
      guardianId,
      guardian,
      studentId,
    }: {
      guardianId: string;
      guardian: Partial<Guardian>;
      studentId: string;
    }) => {
      const startTime = Date.now();
      const response = await apiClient.patch('guardians', guardianId, guardian);

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Execution Audit 기록
      const changedFields = Object.keys(guardian);
      await recordMutationAudit(startTime, session?.user?.id, {
        operation_type: 'guardian.update',
        status: 'success',
        summary: `보호자 정보 수정 완료 (${changedFields.join(', ')})`,
        details: { guardian_id: guardianId, student_id: studentId, changed_fields: changedFields },
        reference: { entity_type: 'guardian', entity_id: guardianId },
      });

      return response.data!;
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['guardians', tenantId, variables.studentId] });
    },
  });
}

/**
 * 보호자 삭제 Hook
 */
export function useDeleteGuardian() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({
      guardianId,
      studentId,
    }: {
      guardianId: string;
      studentId: string;
    }) => {
      const startTime = Date.now();
      const response = await apiClient.delete('guardians', guardianId);

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Execution Audit 기록
      await recordMutationAudit(startTime, session?.user?.id, {
        operation_type: 'guardian.delete',
        status: 'success',
        summary: `보호자 삭제 완료`,
        details: { guardian_id: guardianId, student_id: studentId },
        reference: { entity_type: 'guardian', entity_id: guardianId },
      });
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['guardians', tenantId, variables.studentId] });
    },
  });
}
