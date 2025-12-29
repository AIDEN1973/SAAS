/**
 * Agent Engine for ChatOps
 *
 * OpenAI Function Calling 기반 Agent 엔진
 * L0/L1 Intent를 Tool로 실행하고 자연스러운 대화 생성
 */

import { agentTools, type AgentTool } from './agent-tools.ts';
import { maskPII } from './pii-utils.ts';

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string; // tool role일 때 tool 이름
  tool_calls?: ToolCall[];
  tool_call_id?: string; // tool role일 때
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface AgentContext {
  tenant_id: string;
  user_id: string;
  session_id: string;
  supabase: any; // SupabaseClient
  openai_api_key: string;
}

export interface AgentResponse {
  content: string;
  tool_calls?: ToolCall[];
  finish_reason: 'stop' | 'tool_calls' | 'length';
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI Chat Completion API 호출
 */
async function callOpenAIChat(
  apiKey: string,
  messages: AgentMessage[],
  tools?: AgentTool[],
  tool_choice: 'auto' | 'none' | { type: 'function'; function: { name: string } } = 'auto'
): Promise<AgentResponse> {
  const requestBody: any = {
    model: 'gpt-4o-mini',
    messages: messages,
    temperature: 0.3,
    max_tokens: 1000,
  };

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = tool_choice;
  }

  console.log('[AgentEngine] OpenAI 요청:', {
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

  const data = await response.json();
  const choice = data.choices[0];

  return {
    content: choice.message.content || '',
    tool_calls: choice.message.tool_calls,
    finish_reason: choice.finish_reason,
    usage: data.usage,
  };
}

/**
 * Tool 실행 (L0/L1 Intent → Tool 매핑)
 */
async function executeTool(
  toolName: string,
  toolArgs: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  console.log('[AgentEngine] Tool 실행:', {
    tool: toolName,
    args_keys: Object.keys(toolArgs),
  });

  try {
    // Tool → L0/L1 Intent 매핑
    const intentMapping: Record<string, string> = {
      // 조회 Tools
      'search_student': 'student.query.search',
      'get_student_profile': 'student.query.profile',
      'query_attendance': 'attendance.query.{type}', // 동적 매핑
      'query_billing': 'billing.query.{type}',
      'query_class': 'class.query.{type}',
      'query_schedule': 'schedule.query.{type}',
      'query_message_log': 'message.query.{type}_log',
      'get_dashboard_kpi': 'report.query.{type}_summary',

      // AI Tools
      'ai_summarize': 'ai.summarize.{type}',
      'ai_generate': 'ai.generate.{type}',

      // TaskCard Tools
      'create_notification_task': 'attendance.create.notify_guardians_{type}',
      'draft_message': 'message.draft.{type}',
    };

    let intentKey = intentMapping[toolName];

    if (!intentKey) {
      return {
        success: false,
        result: null,
        error: `알 수 없는 Tool: ${toolName}`,
      };
    }

    // 동적 Intent 키 생성 (예: {type} 치환)
    if (intentKey.includes('{type}')) {
      const type = toolArgs.type;
      if (!type) {
        return {
          success: false,
          result: null,
          error: 'type 파라미터가 필요합니다',
        };
      }
      intentKey = intentKey.replace('{type}', type);
    }

    // L0 Handler 실행
    const { getL0Handler, hasL0Handler } = await import('./l0-handlers.ts');

    if (hasL0Handler(intentKey)) {
      const handler = getL0Handler(intentKey);
      if (handler) {
        const result = await handler.execute(toolArgs, {
          tenant_id: context.tenant_id,
          user_id: context.user_id,
          supabase: context.supabase,
        });

        return {
          success: result.success,
          result: result.data || result.message,
          error: result.success ? undefined : result.message,
        };
      }
    }

    // L1 Intent는 Draft 생성 (기존 로직 활용)
    if (intentKey.includes('.create.') || intentKey.includes('.draft.')) {
      return {
        success: true,
        result: {
          message: `${toolName} 작업이 생성되었습니다.`,
          intent_key: intentKey,
          params: toolArgs,
        },
      };
    }

    return {
      success: false,
      result: null,
      error: `Intent ${intentKey}에 대한 핸들러를 찾을 수 없습니다`,
    };

  } catch (error) {
    console.error('[AgentEngine] Tool 실행 오류:', error);
    return {
      success: false,
      result: null,
      error: `Tool 실행 중 오류: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Agent 대화 실행
 *
 * @param userMessage 사용자 메시지
 * @param conversationHistory 대화 히스토리 (최근 10턴)
 * @param context Agent 컨텍스트
 * @param maxIterations 최대 Tool 호출 반복 횟수 (무한 루프 방지)
 * @returns Agent 응답
 */
export async function runAgent(
  userMessage: string,
  conversationHistory: AgentMessage[],
  context: AgentContext,
  maxIterations: number = 5
): Promise<{
  response: string;
  tool_results?: Array<{ tool: string; success: boolean; result: any }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}> {
  // System Prompt
  const systemPrompt = `당신은 학원/교육기관 관리 시스템의 AI 어시스턴트입니다.

**역할**:
- 사용자와 자연스럽게 대화하며 요청을 이해하고 처리합니다
- 필요시 제공된 Tool을 사용하여 정보를 조회하거나 작업을 생성합니다
- 복잡한 요청은 여러 Tool을 조합하여 처리합니다
- 학생, 원생, 회원, 수강생 등 다양한 용어를 이해합니다

**Tool 사용 원칙**:
1. 조회 요청 → 적절한 query Tool 사용
2. 알림/메시지 발송 요청 → create_notification_task 또는 draft_message 사용
3. 학생 등록/퇴원/수정 등 중요 작업 → execute_l2_intent 사용 (사용자 확인 필요)
4. Tool 결과를 기반으로 자연스러운 응답 생성

**응답 스타일**:
- 친절하고 전문적인 톤
- 간결하고 명확한 정보 전달
- 필요시 추가 정보 요청`;

  const messages: AgentMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10), // 최근 10턴만
    { role: 'user', content: userMessage },
  ];

  let iteration = 0;
  let finalResponse = '';
  const toolResults: Array<{ tool: string; success: boolean; result: any }> = [];
  let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  while (iteration < maxIterations) {
    iteration++;

    // LLM 호출
    const response = await callOpenAIChat(
      context.openai_api_key,
      messages,
      agentTools,
      'auto'
    );

    if (response.usage) {
      totalUsage.prompt_tokens += response.usage.prompt_tokens;
      totalUsage.completion_tokens += response.usage.completion_tokens;
      totalUsage.total_tokens += response.usage.total_tokens;
    }

    // Tool 호출이 없으면 종료
    if (!response.tool_calls || response.tool_calls.length === 0) {
      finalResponse = response.content;
      break;
    }

    // Tool 호출 처리
    console.log('[AgentEngine] Tool 호출 감지:', {
      count: response.tool_calls.length,
      tools: response.tool_calls.map(tc => tc.function.name),
    });

    // Assistant 메시지 추가 (tool_calls 포함)
    messages.push({
      role: 'assistant',
      content: response.content || '',
      tool_calls: response.tool_calls,
    });

    // 각 Tool 실행
    for (const toolCall of response.tool_calls) {
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);

      const result = await executeTool(toolName, toolArgs, context);
      toolResults.push({
        tool: toolName,
        success: result.success,
        result: result.result,
      });

      // Tool 결과를 메시지에 추가
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolName,
        content: JSON.stringify(result.success ? result.result : { error: result.error }),
      });
    }

    // 다음 반복에서 LLM이 Tool 결과를 기반으로 응답 생성
  }

  if (iteration >= maxIterations) {
    console.warn('[AgentEngine] 최대 반복 횟수 도달:', { iterations: maxIterations });
    finalResponse = finalResponse || '요청을 처리하는 중 문제가 발생했습니다. 다시 시도해주세요.';
  }

  return {
    response: finalResponse,
    tool_results: toolResults.length > 0 ? toolResults : undefined,
    usage: totalUsage,
  };
}

/**
 * L2 Intent 실행 여부 판단
 * Agent가 execute_l2_intent Tool을 호출했는지 확인
 */
export function isL2IntentExecution(toolResults?: Array<{ tool: string; success: boolean; result: any }>): {
  isL2: boolean;
  intent_key?: string;
  params?: Record<string, any>;
} {
  if (!toolResults) {
    return { isL2: false };
  }

  const l2Tool = toolResults.find(tr => tr.tool === 'execute_l2_intent');
  if (l2Tool && l2Tool.success) {
    return {
      isL2: true,
      intent_key: l2Tool.result?.intent_key,
      params: l2Tool.result?.params,
    };
  }

  return { isL2: false };
}

