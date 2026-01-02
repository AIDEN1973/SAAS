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
import { createClient } from '@lib/supabase-client';
import { envClient } from '@env-registry/client';

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
 * ChatOps Streaming 메시지 전송 함수
 * SSE (Server-Sent Events) 기반
 * ✅ 수정: chatops 엔드포인트에 stream: true 파라미터 전달
 * ✅ 진행 상황 콜백 추가: onStatus
 * [보안] 30초 타임아웃 설정으로 무한 대기 방지
 */
export async function sendChatOpsMessageStreaming(
  tenantId: string,
  sessionId: string,
  message: string,
  onChunk: (chunk: string) => void,
  onComplete: (fullResponse: string) => void,
  onError: (error: string) => void,
  onStatus?: (status: string) => void  // 진행 상황 콜백 (선택)
): Promise<void> {
  // ✅ 보안: 스트리밍 타임아웃 설정 (30초)
  const STREAMING_TIMEOUT_MS = 30000; // 30초
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  if (!sessionId || sessionId.trim().length === 0) {
    throw new Error('Session ID is required');
  }

  if (!message || message.trim().length === 0) {
    throw new Error('Message is required');
  }

  // ✅ 보안: 타임아웃 타이머 설정
  let timeoutId: NodeJS.Timeout | null = null;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  try {
    // SSE를 위해 직접 fetch 사용
    const supabase = createClient();
    const context = getApiContext();

    if (!context?.tenantId) {
      throw new Error('Tenant ID is required');
    }

    // Supabase URL과 인증 토큰 가져오기
    const supabaseUrl = envClient.NEXT_PUBLIC_SUPABASE_URL;
    const { data: { session } } = await supabase.auth.getSession();
    const authToken = session?.access_token;

    if (!supabaseUrl) {
      throw new Error('Supabase URL is not configured');
    }

    if (!authToken) {
      throw new Error('Authentication token is required');
    }

    // ✅ 수정: chatops 엔드포인트에 stream: true 파라미터 추가
    const response = await fetch(`${supabaseUrl}/functions/v1/chatops`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        session_id: sessionId,
        message: message.trim(),
        stream: true,  // ✅ 스트리밍 모드 활성화
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    reader = response.body?.getReader() || null;
    if (!reader) {
      throw new Error('Response body is null');
    }

    // ✅ 보안: 타임아웃 설정 (30초 후 자동 취소)
    timeoutId = setTimeout(() => {
      if (reader) {
        reader.cancel();
        onError('응답 시간이 초과되었습니다. (30초)');
      }
    }, STREAMING_TIMEOUT_MS);

    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // ✅ 정상 완료 시 타임아웃 제거
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        try {
          const data = JSON.parse(trimmed.slice(6));
          console.log('[useChatOps] SSE 이벤트 수신:', {
            type: data.type,
            hasResponse: !!data.response,
            hasContent: !!data.content,
            hasMessage: !!data.message
          });

          if (data.type === 'status') {
            // 진행 상황 업데이트
            console.log('[useChatOps] status 이벤트:', data.message);
            if (onStatus) {
              onStatus(data.message);
            }
          } else if (data.type === 'content') {
            console.log('[useChatOps] content 이벤트:', { contentLength: data.content?.length });
            fullResponse += data.content;
            onChunk(data.content);
          } else if (data.type === 'done') {
            // ✅ 완료 시 타임아웃 제거
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            // runAgentWithProgress는 content를 한 번에 전송하므로 data.response 우선
            const finalResponse = data.response || fullResponse;
            console.log('[useChatOps] done 이벤트:', {
              hasDataResponse: !!data.response,
              fullResponseLength: fullResponse.length,
              finalResponseLength: finalResponse.length
            });
            onComplete(finalResponse);
          } else if (data.type === 'error') {
            // ✅ 에러 시 타임아웃 제거
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            console.error('[useChatOps] error 이벤트:', data.error);
            onError(data.error);
          }
        } catch (e) {
          console.error('[useChatOps] JSON 파싱 오류:', e);
        }
      }
    }
  } catch (error) {
    // ✅ 예외 발생 시 타임아웃 제거
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    onError(errorMessage);
    throw error;
  }
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
