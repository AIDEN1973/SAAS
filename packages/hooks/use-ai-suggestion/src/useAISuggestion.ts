/**
 * useAISuggestion Hook
 *
 * 레거시 (v2.x): 이 Hook은 더 이상 사용하지 않습니다.
 * v3.3 정본 규칙: StudentTaskCard (task_type: 'ai_suggested')로 통합되었습니다.
 *
 * 정본: StudentTaskCard를 사용하세요 (프론트 자동화 문서 2.2 섹션 참조)
 *
 * StudentTaskCard (task_type: 'ai_suggested') 조회 및 승인/거부 처리
 *
 * 아키텍처 문서 요구사항:
 * - Level 2 — StudentTaskCard (task_type: 'ai_suggested') (추천 + 초안 제공)
 * - "안부 문자 초안 준비됨 → 발송하시겠습니까?"
 * - "이번 반 출석률 저조 → 원인을 분석할까요?"
 *
 * 마이그레이션 가이드:
 * - useAISuggestion() → useStudentTaskCards() 사용
 * - AISuggestionCard → StudentTaskCard 사용
 * - ai_suggestions 테이블 → task_cards 테이블 사용 (StudentTaskCard는 학생용 별칭)
 *
 * @deprecated v3.3에서 삭제됨. useStudentTaskCards()를 사용하세요.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';

export interface AISuggestion {
  id: string;
  tenant_id: string;
  suggestion_type: 'message_draft' | 'consultation_recommendation' | 'analysis_request' | 'attendance_followup';
  title: string;
  summary: string;
  suggested_action: {
    type: 'send_message' | 'create_consultation' | 'run_analysis' | 'contact_parent';
    payload: Record<string, unknown>; // 액션별 상세 데이터
  };
  context_data: {
    student_ids?: string[];
    class_id?: string;
    reason: string; // 제안 근거
  };
  priority: number;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  created_at: string;
  executed_at?: string;
  user_feedback?: string;
  dismissed_at?: string;
}

export interface UseAISuggestionReturn {
  suggestions: AISuggestion[];
  isLoading: boolean;
  approveSuggestion: (id: string) => Promise<void>; // 정본: 승인만, 실행은 Edge Function
  rejectSuggestion: (id: string, feedback?: string) => Promise<void>;
  dismissSuggestion: (id: string) => Promise<void>;
  // executeSuggestion 제거: 정본 규칙에 따라 프론트엔드는 실행하지 않음
}

/**
 * StudentTaskCard (task_type: 'ai_suggested') Hook (레거시)
 *
 * 레거시: StudentTaskCard를 사용하세요.
 * StudentTaskCard (task_type: 'ai_suggested')를 조회하고 승인/거부/실행하는 기능 제공
 */
export function useAISuggestion(): UseAISuggestionReturn {
  const context = getApiContext();
  const tenantId = context.tenantId;
  const queryClient = useQueryClient();

  // StudentTaskCard (task_type: 'ai_suggested') 조회 (레거시)
  const { data: suggestions, isLoading } = useQuery<AISuggestion[]>({
    queryKey: ['ai-suggestions', tenantId],
    queryFn: async (): Promise<AISuggestion[]> => {
      if (!tenantId) return [];

      const response = await apiClient.get<AISuggestion>('ai_suggestions', {
        filters: {
          status: 'pending',
        },
        orderBy: { column: 'priority', ascending: false },
        limit: 10,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return (response.data || []) as unknown as AISuggestion[];
    },
    enabled: !!tenantId,
    refetchInterval: 60000, // 1분마다 갱신
  });

  // 승인 Mutation
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.patch('ai_suggestions', id, {
        status: 'approved',
      });

      if (response.error) {
        throw new Error(response.error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions', tenantId] });
    },
  });

  // 거부 Mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, feedback }: { id: string; feedback?: string }) => {
      const response = await apiClient.patch('ai_suggestions', id, {
        status: 'rejected',
        user_feedback: feedback,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions', tenantId] });
    },
  });

  // 정본 규칙: 프론트엔드는 실행하지 않음
  // 승인만 처리하고, 실행은 Edge Function에서 Role 검증 후 처리
  // executeMutation 제거됨

  // 무시 Mutation
  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.patch('ai_suggestions', id, {
        dismissed_at: new Date().toISOString(),
        status: 'rejected', // 무시는 거부로 처리
      });

      if (response.error) {
        throw new Error(response.error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions', tenantId] });
    },
  });

  return {
    suggestions: suggestions || [],
    isLoading,
    approveSuggestion: approveMutation.mutateAsync, // 정본: 승인만 처리, 실행은 Edge Function
    rejectSuggestion: (id, feedback) => rejectMutation.mutateAsync({ id, feedback }),
    dismissSuggestion: dismissMutation.mutateAsync,
    // executeSuggestion 제거: 정본 규칙에 따라 프론트엔드는 실행하지 않음
  };
}

