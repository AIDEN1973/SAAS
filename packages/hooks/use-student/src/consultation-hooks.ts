/**
 * Consultation Hooks
 *
 * [SSOT] 상담기록 도메인 쿼리/뮤테이션 훅
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import { useSession } from '@hooks/use-auth';
import { recordMutationAudit } from './audit-mutation';
import type { StudentConsultation } from '@services/student-service';

/**
 * 상담기록 목록 조회 함수 (Hook의 queryFn 로직을 재사용)
 * [불변 규칙] useQuery 내부에서도 이 함수를 사용하여 일관성 유지
 */
export async function fetchConsultations(
  tenantId: string,
  filter?: { student_id?: string; consultation_date?: { gte?: string; lte?: string } }
): Promise<StudentConsultation[]> {
  const filters: Record<string, unknown> = {};
  if (filter?.student_id) {
    filters.student_id = filter.student_id;
  }
  if (filter?.consultation_date) {
    filters.consultation_date = filter.consultation_date;
  }

  // [성능 개선 2026-01-27] limit 축소: 100 → 200 (최근 200건만 조회)
  // TODO: 서버 측 집계 또는 페이지네이션으로 전환 필요
  const response = await apiClient.get<StudentConsultation>('student_consultations', {
    filters,
    orderBy: { column: 'consultation_date', ascending: false },
    limit: 200,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return (response.data || []);
}

/**
 * 상담기록 목록 조회 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function useConsultations(studentId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['consultations', tenantId, studentId],
    queryFn: () => fetchConsultations(tenantId!, studentId ? { student_id: studentId } : undefined),
    enabled: !!tenantId && !!studentId,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * 전체 상담기록 목록 조회 Hook (학생 필터 없음)
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
/**
 * 전체 상담 내역 조회 Hook
 * [성능 개선] enabled 옵션 추가하여 조건부 로딩 지원
 */
export function useAllConsultations(options?: { enabled?: boolean }) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['consultations', tenantId, 'all'],
    queryFn: () => fetchConsultations(tenantId!, undefined),
    enabled: options?.enabled !== undefined ? (!!tenantId && options.enabled) : !!tenantId,
    staleTime: 5 * 60 * 1000,  // 5분 (상담 데이터는 자주 변경되지 않음)
    gcTime: 10 * 60 * 1000,    // 10분
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * 상담기록 생성 Hook
 */
export function useCreateConsultation() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({
      studentId,
      consultation,
      userId,
    }: {
      studentId: string;
      consultation: Omit<StudentConsultation, 'id' | 'tenant_id' | 'student_id' | 'created_at' | 'updated_at'>;
      userId: string;
    }) => {
      const startTime = Date.now();
      const response = await apiClient.post('student_consultations', {
        tenant_id: tenantId,
        student_id: studentId,
        ...consultation,
        created_by: userId,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Execution Audit 기록
      const consultationData = response.data as StudentConsultation;
      const consultationType = (consultation as Record<string, unknown>).consultation_type as string || '일반';
      await recordMutationAudit(startTime, session?.user?.id, {
        operation_type: 'consultation.create',
        status: 'success',
        summary: `상담기록 생성 완료 (${consultationType})`,
        details: { consultation_id: consultationData.id, student_id: studentId, consultation_type: consultationType },
        reference: { entity_type: 'consultation', entity_id: consultationData.id },
      });

      return response.data!;
    },
    onSuccess: (_, variables) => {
      // 특정 학생의 상담 캐시 무효화
      void queryClient.invalidateQueries({ queryKey: ['consultations', tenantId, variables.studentId] });
      // [캐시 동기화] 전체 상담 캐시도 무효화 (SubSidebar 상담관리 탭 갱신)
      void queryClient.invalidateQueries({ queryKey: ['consultations', tenantId, 'all'] });
    },
  });
}

/**
 * 상담기록 수정 Hook
 */
export function useUpdateConsultation() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({
      consultationId,
      consultation,
      studentId,
    }: {
      consultationId: string;
      consultation: Partial<StudentConsultation>;
      studentId: string;
    }) => {
      const startTime = Date.now();
      const response = await apiClient.patch('student_consultations', consultationId, consultation);

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Execution Audit 기록
      const changedFields = Object.keys(consultation);
      await recordMutationAudit(startTime, session?.user?.id, {
        operation_type: 'consultation.update',
        status: 'success',
        summary: `상담기록 수정 완료 (${changedFields.join(', ')})`,
        details: { consultation_id: consultationId, student_id: studentId, changed_fields: changedFields },
        reference: { entity_type: 'consultation', entity_id: consultationId },
      });

      return response.data!;
    },
    onSuccess: (_, variables) => {
      // 특정 학생의 상담 캐시 무효화
      void queryClient.invalidateQueries({ queryKey: ['consultations', tenantId, variables.studentId] });
      // [캐시 동기화] 전체 상담 캐시도 무효화 (SubSidebar 상담관리 탭 갱신)
      void queryClient.invalidateQueries({ queryKey: ['consultations', tenantId, 'all'] });
    },
  });
}

/**
 * 상담기록 삭제 Hook
 */
export function useDeleteConsultation() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({
      consultationId,
      studentId,
    }: {
      consultationId: string;
      studentId: string;
    }) => {
      const startTime = Date.now();
      const response = await apiClient.delete('student_consultations', consultationId);

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Execution Audit 기록
      await recordMutationAudit(startTime, session?.user?.id, {
        operation_type: 'consultation.delete',
        status: 'success',
        summary: `상담기록 삭제 완료`,
        details: { consultation_id: consultationId, student_id: studentId },
        reference: { entity_type: 'consultation', entity_id: consultationId },
      });
    },
    onSuccess: (_, variables) => {
      // 특정 학생의 상담 캐시 무효화
      void queryClient.invalidateQueries({ queryKey: ['consultations', tenantId, variables.studentId] });
      // [캐시 동기화] 전체 상담 캐시도 무효화 (SubSidebar 상담관리 탭 갱신)
      void queryClient.invalidateQueries({ queryKey: ['consultations', tenantId, 'all'] });
    },
  });
}

/**
 * 서버가 상담기록 AI 요약 생성하는 Hook
 * [요구사항] 상담기록 AI 요약 버튼 추가
 *
 * [불변 규칙] Edge Function을 통해 서버가 AI 요약 생성
 * [불변 규칙] Zero-Trust: JWT는 사용자 세션에서 가져옴
 */
export function useGenerateConsultationAISummary() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async (params: {
      consultationId: string;
      studentId: string;
    }) => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // [불변 규칙] Zero-Trust: @api-sdk/core를 통해서만 Edge Function 호출
      // apiClient.invokeFunction()은 자동으로 JWT 토큰을 포함하여 요청
      // Edge Function은 JWT에서 tenant_id를 추출합니다 (요청 본문에서 받지 않음)
      const response = await apiClient.invokeFunction<{ ai_summary: string }>(
        'consultation-ai-summary',
        {
          consultation_id: params.consultationId,
        }
      );

      if (response.error) {
        throw new Error(response.error.message || 'AI 요약 생성에 실패했습니다.');
      }

      if (!response.data?.ai_summary) {
        throw new Error('AI 요약 데이터가 없습니다.');
      }

      return response.data.ai_summary;
    },
    onSuccess: (_, variables) => {
      // 특정 학생의 상담 캐시 무효화 (AI 요약 반영)
      void queryClient.invalidateQueries({ queryKey: ['consultations', tenantId, variables.studentId] });
      // [캐시 동기화] 전체 상담 캐시도 무효화 (SubSidebar 상담관리 탭 갱신)
      void queryClient.invalidateQueries({ queryKey: ['consultations', tenantId, 'all'] });
    },
  });
}

/**
 * 상담 내역 페이지네이션 Hook
 * [성능 개선 2026-01-27] 대량 데이터 로딩 대신 페이지네이션 지원
 */
export function useConsultationsPaged(options: {
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
  consultationType?: string;
  enabled?: boolean;
}) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  const {
    page = 1,
    pageSize = 20,
    dateFrom,
    dateTo,
    consultationType,
    enabled = true,
  } = options;

  return useQuery({
    queryKey: [
      'consultations',
      tenantId,
      'paged',
      page,
      pageSize,
      dateFrom,
      dateTo,
      consultationType,
    ],
    queryFn: async () => {
      if (!tenantId) {
        return { consultations: [], totalCount: 0 };
      }

      // 필터 구성
      const filters: Record<string, unknown> = {};
      if (consultationType && consultationType !== 'all') {
        filters.consultation_type = consultationType;
      }
      if (dateFrom || dateTo) {
        const dateFilter: { gte?: string; lte?: string } = {};
        if (dateFrom) dateFilter.gte = dateFrom;
        if (dateTo) dateFilter.lte = dateTo;
        filters.consultation_date = dateFilter;
      }

      // 페이지네이션 쿼리
      const offset = (page - 1) * pageSize;
      const response = await apiClient.get<StudentConsultation>('student_consultations', {
        filters,
        orderBy: { column: 'consultation_date', ascending: false },
        range: { from: offset, to: offset + pageSize - 1 },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // 전체 개수 조회
      const countResponse = await apiClient.get<StudentConsultation>('student_consultations', {
        filters,
        count: 'exact',
        limit: 1,
      });

      const totalCount = countResponse.count || 0;

      return {
        consultations: response.data || [],
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
