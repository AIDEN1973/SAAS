/**
 * useStudentTaskCard Hook
 *
 * React Query 기반 학생 업무 카드 Hook
 * [불변 규칙] tenant 변경 시 invalidateQueries() 자동 발생
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';

// StudentTaskCard 타입 정의 (임시, 나중에 공통 타입으로 이동)
export interface StudentTaskCard {
  id: string;
  task_type: 'risk' | 'absence' | 'counseling' | 'new_signup';
  student_id: string;
  student_name?: string;
  priority: number;
  title: string;
  description: string;
  action_url: string;
  created_at: string;
  expires_at: string;
  risk_level?: string;
  risk_reason?: string;
  recommended_action?: string;
  absence_days?: number;
  last_attendance_date?: string;
  parent_contact_needed?: boolean;
  counseling_type?: string;
  urgency?: string;
  scheduled_date?: string;
  signup_date?: string;
  welcome_message_sent?: boolean;
  initial_setup_needed?: boolean;
}

/**
 * 학생 업무 카드 목록 조회 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function useStudentTaskCards() {
  const context = getApiContext();
  const tenantId = context.tenantId;

  console.log('[useStudentTaskCards] Hook called:', { tenantId, hasContext: !!context });

  return useQuery<StudentTaskCard[]>({
    queryKey: ['student-task-cards', tenantId],
    queryFn: async (): Promise<StudentTaskCard[]> => {
      console.log('[useStudentTaskCards] Fetching cards for tenant:', tenantId);

      // StudentTaskCard는 배치 작업(06:00) 및 실시간 트리거에서 자동 생성됨
      // (아키텍처 문서 785-794줄: Daily batch at 06:00 + Real-time generation)
      const response = await apiClient.get<StudentTaskCard>('student_task_cards', {
        filters: {},
        orderBy: { column: 'priority', ascending: false },
        limit: 100,
      });

      console.log('[useStudentTaskCards] Response:', {
        error: response.error,
        dataLength: response.data?.length,
        data: response.data,
      });

      if (response.error) {
        console.error('[useStudentTaskCards] Error:', response.error);
        throw new Error(response.error.message);
      }

      // 만료된 카드 필터링 (클라이언트 측)
      const now = new Date();
      const cardsData = (response.data || []) as StudentTaskCard[];
      const cards = cardsData.filter((card: StudentTaskCard) => {
        const expiresAt = new Date(card.expires_at);
        return expiresAt > now;
      });

      console.log('[useStudentTaskCards] Filtered cards (after expiry check):', cards.length);
      return cards;
    },
    enabled: !!tenantId,
    refetchInterval: 60000, // 1분마다 자동 갱신
  });
}

/**
 * 학생 업무 카드 처리 완료 Hook
 */
export function useCompleteStudentTaskCard() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async (cardId: string) => {
      // 카드 처리 완료 시 삭제 (아키텍처 문서 809줄: 사용자가 처리 완료한 카드는 즉시 삭제)
      const response = await apiClient.delete('student_task_cards', cardId);

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    },
    onSuccess: () => {
      // 학생 업무 카드 목록 갱신
      queryClient.invalidateQueries({ queryKey: ['student-task-cards', tenantId] });
    },
  });
}

