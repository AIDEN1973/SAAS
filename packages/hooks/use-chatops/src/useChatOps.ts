// LAYER: SHARED_HOOK
/**
 * useChatOps Hook
 *
 * React Query 기반 ChatOps Hook
 * [SSOT 준수] 챗봇.md 문서 기준 엄격히 준수
 * [불변 규칙] tenant 변경 시 invalidateQueries() 자동 발생
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 */

import { useMutation } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import { maskPII } from '@core/pii-utils';

/**
 * ChatOps 요청 인터페이스
 */
export interface ChatOpsRequest {
  session_id: string;
  message: string;
}

/**
 * ChatOps 응답 인터페이스
 */
export interface ChatOpsResponse {
  response: string;
  intent?: {
    intent_key: string;
    automation_level: 'L0' | 'L1' | 'L2';
    execution_class?: 'A' | 'B'; // L2일 때만 존재
    params?: Record<string, unknown>;
  };
  l0_result?: unknown; // L0 Intent 실행 결과
  task_card_id?: string; // L1/L2 Intent의 경우 생성된 TaskCard ID
  original_message?: string; // 원본 사용자 메시지 (필터링용)
}

/**
 * ChatOps 메시지 전송 함수
 */
async function sendChatOpsMessage(
  tenantId: string,
  sessionId: string,
  message: string
): Promise<ChatOpsResponse> {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  if (!sessionId || sessionId.trim().length === 0) {
    throw new Error('Session ID is required');
  }

  if (!message || message.trim().length === 0) {
    throw new Error('Message is required');
  }

  // Edge Function 호출 (챗봇.md 참조)
  // POST /functions/v1/chatops
  const response = await apiClient.invokeFunction<ChatOpsResponse>(
    'chatops',
    {
      session_id: sessionId,
      message: message.trim(),
    }
  );

  if (response.error) {
    throw new Error(response.error.message);
  }

  if (!response.data) {
    throw new Error('ChatOps 응답이 없습니다.');
  }

  return response.data;
}

/**
 * useChatOps Hook
 *
 * ChatOps 메시지 전송을 위한 React Query Mutation Hook
 */
export function useChatOps() {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: ({ sessionId, message }: { sessionId: string; message: string }) =>
      sendChatOpsMessage(tenantId || '', sessionId, message),
    onError: (error) => {
      // P0: PII 마스킹 필수 (체크리스트.md 4. PII 마스킹)
      // P2: packages/hooks 레벨에서는 로깅 유틸리티가 없으므로 console.error 사용
      // PII 마스킹은 이미 적용되어 있음
      const maskedError = maskPII(error);
      console.error('[useChatOps] Error sending message:', maskedError);
    },
  });
}

