// LAYER: EDGE_FUNCTION_SHARED
/**
 * Agent Engine - Streaming Support
 *
 * OpenAI Streaming API를 사용한 실시간 응답 전송
 * SSE (Server-Sent Events) 기반
 */

import { AGENT_TOOLS } from './agent-tools-final.ts';
import { maskPII } from './pii-utils.ts';
import { requireTenantScope } from '../chatops/handlers/auth.ts';
import { AGENT_SYSTEM_PROMPT } from './agent-prompts.ts';

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

export interface AgentContext {
  tenant_id: string;
  user_id: string;
  session_id: string;
  supabase: any;
  openai_api_key: string;
  industry_type?: string; // 업종별 최적화용 (academy, salon, nail 등)
}

/**
 * OpenAI Streaming API 호출
 */
async function* streamOpenAIChat(
  apiKey: string,
  messages: AgentMessage[],
  tools?: any[]
): AsyncGenerator<string, void, unknown> {
  const requestBody: any = {
    model: 'gpt-4o-mini',
    messages: messages,
    temperature: 0.3,
    max_tokens: 800,
    stream: true, // Streaming 활성화
  };

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = 'auto';
  }

  console.log('[AgentEngineStreaming] OpenAI Streaming 요청:', {
    message_count: messages.length,
    has_tools: !!tools,
    tool_count: tools?.length || 0,
  });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API 오류: ${response.status} ${errorText}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;

        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.slice(6));
            const delta = json.choices[0]?.delta;

            if (delta?.content) {
              yield delta.content;
            }
          } catch (e) {
            // P0: PII 마스킹 필수 (체크리스트.md 4. PII 마스킹)
            const maskedError = maskPII(e);
            console.error('[AgentEngineStreaming] JSON 파싱 오류:', maskedError);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Streaming Agent 실행
 *
 * @param userMessage 사용자 메시지
 * @param conversationHistory 대화 히스토리
 * @param context Agent 컨텍스트
 * @param maxIterations 최대 반복 횟수 (현재 스트리밍 모드에서는 Tool 실행 미지원으로 미사용)
 * @returns ReadableStream for SSE
 */
export async function runAgentStreaming(
  userMessage: string,
  conversationHistory: AgentMessage[],
  context: AgentContext,
  maxIterations: number = 3 // ⚠️ 현재 스트리밍 모드에서는 Tool 실행 미지원
): Promise<ReadableStream> {
  // System Prompt (2단계 정보 수집: 필수 → 선택)
  // P2: 공통 상수로 분리 (agent-prompts.ts)
  const systemPrompt = AGENT_SYSTEM_PROMPT;

  const messages: AgentMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-6),
    { role: 'user', content: userMessage },
  ];

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        console.log('[AgentEngineStreaming] Streaming 시작');

        // OpenAI Streaming 호출
        const stream = streamOpenAIChat(
          context.openai_api_key,
          messages,
          AGENT_TOOLS
        );

        let fullResponse = '';

        for await (const chunk of stream) {
          fullResponse += chunk;

          // SSE 형식으로 전송
          const sseData = `data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`;
          controller.enqueue(encoder.encode(sseData));
        }

        // 완료 신호
        const doneData = `data: ${JSON.stringify({ type: 'done', fullResponse })}\n\n`;
        controller.enqueue(encoder.encode(doneData));

        console.log('[AgentEngineStreaming] Streaming 완료:', {
          response_length: fullResponse.length,
        });

        controller.close();
      } catch (error) {
        // P0: PII 마스킹 필수 (체크리스트.md 4. PII 마스킹)
        const maskedError = maskPII(error);
        console.error('[AgentEngineStreaming] 오류:', maskedError);

        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorData = `data: ${JSON.stringify({
          type: 'error',
          error: maskPII(errorMessage) // PII 마스킹 적용
        })}\n\n`;
        controller.enqueue(encoder.encode(errorData));
        controller.close();
      }
    },
  });
}

