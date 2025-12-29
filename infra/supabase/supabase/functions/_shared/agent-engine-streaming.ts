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
            console.error('[AgentEngineStreaming] JSON 파싱 오류:', e);
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
 * @returns ReadableStream for SSE
 */
export async function runAgentStreaming(
  userMessage: string,
  conversationHistory: AgentMessage[],
  context: AgentContext
): Promise<ReadableStream> {
  const systemPrompt = `당신은 학원/교육기관 관리 시스템의 AI 어시스턴트입니다.

**역할**:
- 사용자와 자연스럽게 대화하며 요청을 이해하고 처리합니다
- 필요시 제공된 Tool을 사용하여 정보를 조회하거나 작업을 생성합니다
- 복잡한 요청은 여러 Tool을 조합하여 처리합니다
- 학생, 원생, 회원, 수강생 등 다양한 용어를 이해합니다

**Tool 사용 원칙**:
1. 조회 요청 → 적절한 query Tool 사용
2. 알림/메시지 발송 요청 → send_message 또는 manage_attendance 사용
3. 학생 등록/퇴원/수정 등 중요 작업 → manage_student Tool 사용
4. Tool 결과를 기반으로 자연스러운 응답 생성

**응답 스타일**:
- 친절하고 전문적인 톤
- 간결하고 명확한 정보 전달
- 이전 대화 문맥을 항상 고려`;

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
        console.error('[AgentEngineStreaming] 오류:', error);

        const errorData = `data: ${JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : String(error)
        })}\n\n`;
        controller.enqueue(encoder.encode(errorData));
        controller.close();
      }
    },
  });
}

