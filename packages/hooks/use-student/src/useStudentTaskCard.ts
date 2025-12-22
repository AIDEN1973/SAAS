/**
 * useStudentTaskCard Hook
 *
 * React Query 기반 학생 업무 카드 Hook
 * [불변 규칙] tenant 변경 시 invalidateQueries() 자동 발생
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import { toKST } from '@lib/date-utils'; // 기술문서 5-2: KST 변환 필수

// TaskCard 타입 정의 (정본, 업종 중립)
// 프론트 자동화 문서 2.2 섹션 참조
export interface TaskCard {
  id: string;
  tenant_id: string;
  entity_id: string;      // 업종 중립 엔티티 ID (정본)
  entity_type: string;    // 업종 중립 엔티티 타입 (정본, 예: 'student', 'client', 'customer')
  student_id?: string;    // 레거시 필드 (하위 호환성, entity_type='student'인 경우 entity_id와 동일)
  task_type: 'ai_suggested' | 'risk' | 'absence' | 'counseling' | 'new_signup'; // v3.3: ai_suggested 추가
  source?: 'attendance' | 'billing' | 'behavior' | 'weather' | 'proactive_analysis'; // TaskCard (task_type: 'ai_suggested') 근거 (선택적)
  priority: number; // 0-100 스케일 (정본)
  title: string;
  description: string;
  action_url: string;
  suggested_action?: {
    type: string;
    payload?: Record<string, unknown>;
  }; // 액션 정의 (메시지 초안, 분석 요청 등, 선택적)
  dedup_key?: string; // 정본 포맷: "{tenantId}:{trigger}:{entityType}:{entityId}:{window}"
  status?: 'pending' | 'approved' | 'executed' | 'expired'; // 승인 상태 (선택적, 기본값: 'pending')
  expires_at: string; // TTL 만료 시점
  created_at: string;
  created_by?: string;
  metadata?: Record<string, unknown>; // TaskCard (task_type: 'ai_suggested') 관련 추가 데이터 (선택적)

  // 레거시 필드 (하위 호환성 유지)
  student_name?: string;
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

// StudentTaskCard는 학생용 별칭 (하위 호환성)
export type StudentTaskCard = TaskCard & { entity_type: 'student' };

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

      // TaskCard는 서버가 배치 작업(06:00) 및 실시간 트리거에서 생성함 (정본)
      // (아키텍처 문서 785-794줄: Daily batch at 06:00 + Real-time generation)
      // StudentTaskCard는 학생용 별칭 (= TaskCard where entity_type='student')
      const response = await apiClient.get<TaskCard>('task_cards', {
        filters: { entity_type: 'student' }, // 학생용 필터
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

      // 기술문서 5-2: KST 기준 날짜 처리 - 만료된 카드 필터링 (클라이언트 측)
      // 오늘 발생한 업무는 계속 출력되어야 함: 오늘 생성된 카드는 만료되지 않았어도 표시
      const now = toKST().toDate();
      const today = toKST().startOf('day').toDate();
      const cardsData = (response.data || []) as TaskCard[];
      // StudentTaskCard는 학생용 별칭 (= TaskCard where entity_type='student')
      const cards = cardsData.filter((card: TaskCard) => {
        // status가 'executed'인 카드는 제외 (이미 처리 완료된 카드)
        if (card.status === 'executed') {
          return false;
        }

        const expiresAt = new Date(card.expires_at);
        const cardCreatedAt = new Date(card.created_at);

        // 오늘 생성된 카드는 만료되지 않았어도 표시
        const isCreatedToday = cardCreatedAt >= today;
        // 만료되지 않은 카드
        const isNotExpired = expiresAt > now;

        return isCreatedToday || isNotExpired;
      });

      console.log('[useStudentTaskCards] Filtered cards (after expiry check):', cards.length);
      return cards as StudentTaskCard[];
    },
    enabled: !!tenantId,
    refetchInterval: 60000, // 1분마다 자동 갱신
  });
}

/**
 * 학생 업무 카드 처리 완료 Hook
 *
 * @param deleteImmediately - true: 즉시 삭제, false: status를 'executed'로 업데이트 (기본값: false)
 * 실제 작업 완료 시에만 true로 설정하여 삭제
 */
export function useCompleteStudentTaskCard(deleteImmediately: boolean = false) {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async (cardId: string) => {
      if (deleteImmediately) {
      // 카드 처리 완료 시 삭제 (아키텍처 문서 809줄: 사용자가 처리 완료한 카드는 즉시 삭제)
        const response = await apiClient.delete('task_cards', cardId); // 정본

        if (response.error) {
          throw new Error(response.error.message);
        }

        return response.data;
      } else {
        // status를 'executed'로 업데이트 (실제 작업 완료 시에만 삭제)
        const response = await apiClient.patch('task_cards', cardId, { // 정본
          status: 'executed',
        });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
      }
    },
    onSuccess: () => {
      // 학생 업무 카드 목록 갱신
      queryClient.invalidateQueries({ queryKey: ['student-task-cards', tenantId] });
    },
  });
}

/**
 * StudentTaskCard 승인 요청 Hook (Teacher 역할)
 *
 * 프론트 자동화 문서 2.4 섹션 참조
 * - Teacher: request-approval만 가능
 * - Admin/Owner: approve-and-execute 가능 (SSOT)
 */
export function useRequestApprovalStudentTaskCard() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async (taskId: string) => {
      // Edge Function 호출: request-approval
      // 프론트 자동화 문서 2.4: Teacher는 승인 요청만 가능, 실행은 서버 사이드(Edge Function/DB Trigger/Scheduler)가 처리
      // Edge Function은 body로 action과 task_id를 받음
      const response = await apiClient.invokeFunction<{ status: string; message: string }>(
        'execute-student-task',
        {
          action: 'request-approval',
          task_id: taskId,
        }
      );

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

/**
 * StudentTaskCard 승인 및 실행 Hook (Admin/Owner 역할, SSOT)
 *
 * 프론트 자동화 문서 2.4 섹션 참조
 * - Admin/Owner만 approve-and-execute 가능
 * - 서버 사이드(Edge Function/DB Trigger/Scheduler)가 Role 검증 후 실행 (SSOT)
 */
export function useApproveAndExecuteStudentTaskCard() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async (taskId: string) => {
      // Edge Function 호출: approve-and-execute
      // 프론트 자동화 문서 2.4: Admin/Owner는 승인 및 실행 가능, 서버 사이드(Edge Function/DB Trigger/Scheduler)가 SSOT
      // Edge Function은 body로 action과 task_id를 받음
      const response = await apiClient.invokeFunction<{ status: string; message: string }>(
        'execute-student-task',
        {
          action: 'approve-and-execute',
          task_id: taskId,
        }
      );

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

