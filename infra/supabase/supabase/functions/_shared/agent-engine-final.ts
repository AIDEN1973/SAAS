// LAYER: EDGE_FUNCTION_SHARED
/**
 * Agent Engine - Final Implementation
 *
 * OpenAI Function Calling 기반 Agent 엔진
 * Intent 147개 → Tool 15개로 통합
 */

import { AGENT_TOOLS, type AgentTool } from './agent-tools-final.ts';
import { maskPII } from './pii-utils.ts';
import { toKSTDate, toKSTISOString, kstDateToUTC, nextKSTDateToUTC, nextKSTMonthToUTC } from './date-utils.ts';
import { requireTenantScope } from '../chatops/handlers/auth.ts';
import { getTenantTableName } from './industry-adapter.ts';
import { getTenantSettingByPath, getAutomationEventPolicyPath } from './policy-utils.ts';

/**
 * P0-10: tenant_id 사용 패턴 가이드
 *
 * requireTenantScope()는 검증 후 값을 그대로 반환하지만,
 * 의도를 명확히 하기 위해 다음 패턴을 권장합니다:
 *
 * ✅ 권장:
 * requireTenantScope(context.tenant_id);  // 검증
 * .eq('tenant_id', context.tenant_id)     // 사용
 *
 * ⚠️ 기존 (작동하지만 의도 불명확):
 * .eq('tenant_id', requireTenantScope(context.tenant_id))
 *
 * 현재 코드는 기존 패턴을 유지하되, 점진적으로 권장 패턴으로 전환합니다.
 */

/**
 * 상수 정의 (P2 이슈 해결)
 */
const STUDENT_STATUS = {
  ACTIVE: 'active',
  ON_LEAVE: 'on_leave',
  WITHDRAWN: 'withdrawn',
  GRADUATED: 'graduated',
} as const;

/**
 * P2-10: Draft 상태 상수 (SSOT)
 *
 * [불변 규칙] chatops_drafts 테이블의 status 컬럼과 일치
 *
 * - collecting: 필수 정보 수집 중 (missing_required 필드 참조)
 * - ready: 실행 준비 완료 (confirm_action 대기)
 * - executed: 실행 완료
 * - cancelled: 취소됨
 * - failed: 실행 실패
 */
const DRAFT_STATUS = {
  COLLECTING: 'collecting',
  READY: 'ready',
  EXECUTED: 'executed',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
} as const;

/**
 * P2-10: Draft 필드 가이드
 *
 * [SSOT] chatops_drafts 테이블 필드:
 * - id: UUID (PK)
 * - tenant_id: UUID (FK)
 * - user_id: UUID (FK)
 * - session_id: TEXT
 * - intent_key: TEXT (예: 'student.exec.register')
 * - event_type: TEXT (예: 'student_registration', automation-event-catalog.ts와 일치)
 * - draft_params: JSONB (Tool arguments)
 * - status: TEXT (DRAFT_STATUS 참조)
 * - missing_required: TEXT[] (collecting 상태일 때 누락된 필수 파라미터)
 * - created_at: TIMESTAMPTZ
 * - updated_at: TIMESTAMPTZ
 * - executed_at: TIMESTAMPTZ (nullable)
 *
 * [Deprecated] confirm_required: 이 필드는 사용하지 않습니다. status='ready'로 대체됨.
 */

/**
 * P2-11: OpenAI 모델 가격 정보 (참고용, 정산/제한 로직에 사용 금지)
 *
 * ⚠️ 중요 경고:
 * 1. 이 가격은 OpenAI 공식 가격표 기준 추정치이며, 실제 청구 금액과 다를 수 있습니다.
 * 2. OpenAI는 가격을 예고 없이 변경할 수 있습니다.
 * 3. 이 값은 사용자에게 대략적인 비용을 안내하기 위한 표시 목적으로만 사용하세요.
 * 4. 실제 정산/청구/사용량 제한은 OpenAI Dashboard 또는 별도 정산 시스템을 사용하세요.
 *
 * [업데이트 이력]
 * - 2025-12-30: gpt-4o-mini 가격 기준 설정
 *
 * @see https://openai.com/api/pricing/
 */
const MODEL_PRICING = {
  'gpt-4o-mini': {
    input: 0.00000015,   // $0.15 per 1M tokens
    output: 0.0000006,   // $0.60 per 1M tokens
  },
  // 향후 다른 모델 추가 시:
  // 'gpt-4o': { input: 0.0000025, output: 0.00001 },
} as const;

/**
 * P2-11: 환율 (참고용)
 *
 * ⚠️ 이 환율은 고정된 참고 값이며, 실시간 환율이 아닙니다.
 */
const EXCHANGE_RATE_USD_TO_KRW = 1500;

/**
 * P0-37: 메시지 상태 상수 (SSOT)
 *
 * [불변 규칙] message_logs 테이블의 status 컬럼과 일치
 *
 * - pending: 발송 대기 중
 * - scheduled: 예약됨 (워커가 scheduled_at 시각에 처리)
 * - sent: 발송 완료
 * - failed: 발송 실패
 */
const MESSAGE_STATUS = {
  PENDING: 'pending',
  SCHEDULED: 'scheduled',  // P0-37: 예약 상태 추가
  SENT: 'sent',
  FAILED: 'failed',
} as const;

/**
 * Intent Key → Event Type 매핑 테이블 (SSOT)
 *
 * [불변 규칙] 이 매핑은 automation-event-catalog.ts의 event_type과 일치해야 합니다.
 * 새로운 intent가 추가되면 해당하는 event_type을 카탈로그에 등록하고 여기에 매핑을 추가하세요.
 */
const INTENT_TO_EVENT_TYPE_MAP: Record<string, string> = {
  // 학생 관리
  'student.exec.register': 'student_registration',
  'student.exec.discharge': 'student_discharge',
  'student.exec.pause': 'student_pause',
  'student.exec.resume': 'student_resume',
  'student.exec.update': 'student_update',
  'student.exec.update_contact': 'student_update_contact',
  'student.exec.change_class': 'class_change_or_cancel',  // 이미 카탈로그에 있음
  'student.exec.merge': 'student_merge',

  // 메시지 발송
  'message.exec.send_single': 'message_send',
  'message.exec.send_bulk': 'message_send',
  'message.exec.send_scheduled': 'message_send',
  'message.exec.resend_failed': 'message_resend',
  'message.exec.cancel_scheduled': 'message_cancel',

  // 출결 관리
  'attendance.exec.notify_absent': 'absence_first_day',  // 이미 카탈로그에 있음
  'attendance.exec.notify_late': 'attendance_late_notification',
  'attendance.exec.request_reason': 'attendance_reason_request',
  'attendance.exec.correct': 'attendance_correct',
  'attendance.exec.bulk_update': 'attendance_bulk_update',
  'attendance.exec.mark_excused': 'attendance_mark_excused',

  // 수납 관리
  'billing.exec.issue_invoice': 'invoice_issue',
  'billing.exec.send_payment_link': 'payment_link_send',
  'billing.exec.schedule_notice': 'overdue_outstanding_over_limit',  // 이미 카탈로그에 있음
  'billing.exec.record_payment': 'payment_record',
};

/**
 * Intent Key를 Event Type으로 매핑
 *
 * @param intentKey Intent Key (예: 'student.exec.register')
 * @returns Event Type 또는 null (매핑이 없으면 null)
 */
function mapIntentToEventType(intentKey: string): string | null {
  return INTENT_TO_EVENT_TYPE_MAP[intentKey] || null;
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface AgentContext {
  tenant_id: string;
  user_id: string;
  session_id: string;
  supabase: any;
  openai_api_key: string;
  _tableCache?: Map<string, string>;  // P2-8: 테이블명 캐시
  industry_type?: string;  // 성능 최적화: industry_type 캐시 (DB 조회 감소)
}

export interface AgentResponse {
  response: string;
  tool_results?: Array<{ tool: string; success: boolean; result: any }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    // P0-23: 비용 정보는 서버 로그/메트릭 전용 (UI 표시 시 주의 필요)
    cost_estimate_usd?: string;  // 추정치 (정산용 아님)
    cost_estimate_krw?: string;  // 추정치 (정산용 아님)
    model?: string;               // 사용된 모델명
    pricing_note?: string;        // 경고 메시지
  };
}

/**
 * OpenAI Chat Completion API 호출
 */
async function callOpenAIChat(
  apiKey: string,
  messages: AgentMessage[],
  tools?: AgentTool[],
  tool_choice: 'auto' | 'none' = 'auto'
): Promise<{
  content: string;
  tool_calls?: ToolCall[];
  finish_reason: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}> {
  const requestBody: any = {
    model: 'gpt-4o-mini',
    messages: messages,
    temperature: 0.3,
    max_tokens: 800, // 1500→800 감소: 응답 시간 최적화
  };

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = tool_choice;
  }

  // 프로덕션 최적화: 상세 로깅 제거

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
 * OpenAI Streaming Chat Completion API 호출
 */
async function* callOpenAIChatStreaming(
  apiKey: string,
  messages: AgentMessage[],
  tools?: AgentTool[],
  tool_choice: 'auto' | 'none' = 'auto'
): AsyncGenerator<{ type: 'content' | 'tool_calls' | 'done'; content?: string; tool_calls?: ToolCall[]; usage?: any }, void, unknown> {
  const requestBody: any = {
    model: 'gpt-4o-mini',
    messages: messages,
    temperature: 0.3,
    max_tokens: 800,
    stream: true, // 스트리밍 활성화
  };

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = tool_choice;
  }

  // P0-33: 스트리밍에서 usage 정보 포함 옵션 추가
  // OpenAI API는 stream_options.include_usage를 통해 usage 정보를 스트림에 포함
  requestBody.stream_options = { include_usage: true };

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
  let toolCallsBuffer: any[] = [];
  let toolCallsFlushed = false;  // P0-2: 중복 방지 플래그
  let lastUsage: any = null;     // P0-2: usage 누적

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // P0-22: 스트림 종료 전 flush (hole 방어 + JSON 파싱 검증)
        if (toolCallsBuffer.length > 0 && !toolCallsFlushed) {
          // P0-17: hole 방어 - undefined 항목 제외하고 정의된 엔트리만 검증
          const validToolCalls = toolCallsBuffer.filter((tc) => {
            if (!tc || !tc.id || !tc.function?.name || tc.function?.arguments === undefined) {
              return false;
            }

            // P0-22: JSON 파싱 가능 여부 검증 (닫히지 않은 JSON 방어)
            try {
              JSON.parse(tc.function.arguments);
              return true;
            } catch {
              console.warn('[callOpenAIChatStreaming] tool_call arguments JSON 파싱 실패:', {
                id: tc.id,
                name: tc.function.name,
                arguments_preview: tc.function.arguments.substring(0, 50),
              });
              return false;
            }
          });

          if (validToolCalls.length > 0) {
            yield { type: 'tool_calls', tool_calls: validToolCalls as ToolCall[] };
            toolCallsFlushed = true;
          } else {
            console.warn('[callOpenAIChatStreaming] tool_calls 버퍼에 유효한 항목 없음');
          }
        }

        // P0-2: 최종 usage 방출
        if (lastUsage) {
          yield { type: 'done', usage: lastUsage };
        }

        break;
      }

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
            const finishReason = json.choices[0]?.finish_reason;

            // P0-2: usage 누적 (마지막 청크에만 있음)
            if (json.usage) {
              lastUsage = json.usage;
            }

            // 텍스트 콘텐츠 스트리밍
            if (delta?.content) {
              yield { type: 'content', content: delta.content };
            }

            // Tool calls 수집
            if (delta?.tool_calls) {
              for (const toolCall of delta.tool_calls) {
                const idx = toolCall.index;
                if (!toolCallsBuffer[idx]) {
                  toolCallsBuffer[idx] = {
                    id: toolCall.id || '',
                    type: 'function',
                    function: { name: '', arguments: '' }
                  };
                }
                if (toolCall.id) {
                  toolCallsBuffer[idx].id = toolCall.id;
                }
                // P0-39: function.name은 보통 완전 값으로 오므로 할당 (중복 방지)
                if (toolCall.function?.name) {
                  // 이미 값이 있고 동일하면 무시 (중복 방지)
                  if (!toolCallsBuffer[idx].function.name || toolCallsBuffer[idx].function.name !== toolCall.function.name) {
                    toolCallsBuffer[idx].function.name = toolCall.function.name;
                  }
                }
                // P0-39: arguments는 조각으로 올 수 있으므로 무조건 append
                // OpenAI는 중복 전송하지 않으므로 endsWith 체크 제거 (overlap 문제 방지)
                if (toolCall.function?.arguments) {
                  toolCallsBuffer[idx].function.arguments += toolCall.function.arguments;
                }
              }
            }

            // P0-22: finish_reason이 있고 tool_calls가 완성되었으면 방출 (JSON 파싱 검증)
            if (finishReason && toolCallsBuffer.length > 0 && !toolCallsFlushed) {
              // P0-17: hole 방어 - 정의된 엔트리만 검증
              const definedToolCalls = toolCallsBuffer.filter(Boolean);

              // P0-22: JSON 파싱 가능 여부 검증
              const validToolCalls = definedToolCalls.filter(tc => {
                if (!tc.id || !tc.function?.name || tc.function?.arguments === undefined) {
                  return false;
                }
                try {
                  JSON.parse(tc.function.arguments);
                  return true;
                } catch {
                  return false;
                }
              });

              if (validToolCalls.length > 0 && validToolCalls.length === definedToolCalls.length) {
                // 모든 tool_call이 유효하면 flush
                yield { type: 'tool_calls', tool_calls: validToolCalls as ToolCall[] };
                toolCallsFlushed = true;
              }
              // 일부만 유효하거나 미완성이면 스트림 종료까지 기다림 (done 시점에서 flush)
            }

            // P0-2: stop으로 끝나면 done은 while 종료 후 방출됨
          } catch (e) {
            console.error('[callOpenAIChatStreaming] JSON 파싱 오류:', e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * P0-4: 입력 파라미터 정규화 (서버 측 강제)
 *
 * LLM이 항상 정규화된 형식을 보낸다는 가정은 위험하므로,
 * 서버에서 명시적으로 정규화를 수행합니다.
 */
function normalizeToolArgs(args: Record<string, any>): Record<string, any> {
  const normalized = { ...args };

  // 날짜 필드 정규화: . / → -
  const dateFields = ['date', 'birth_date', 'due_date', 'effective_date'];
  for (const field of dateFields) {
    if (normalized[field] && typeof normalized[field] === 'string') {
      normalized[field] = normalized[field]
        .replace(/\./g, '-')
        .replace(/\//g, '-')
        .trim();
    }
  }

  // 전화번호 필드 정규화: 숫자만 추출
  const phoneFields = ['phone', 'guardian_phone', 'phone_hint'];
  for (const field of phoneFields) {
    if (normalized[field] && typeof normalized[field] === 'string') {
      const digits = normalized[field].replace(/\D/g, '');
      if (digits.length >= 4) {
        normalized[field] = digits;
      }
    }
  }

  // 문자열 필드 trim
  for (const [key, value] of Object.entries(normalized)) {
    if (typeof value === 'string') {
      normalized[key] = value.trim();
    }
  }

  return normalized;
}

/**
 * Tool 실행
 */
async function executeTool(
  toolName: string,
  toolArgs: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  try {
    // P0-4: 서버 측 필드 정규화 강제
    const normalizedArgs = normalizeToolArgs(toolArgs);

    // Tool별 실행 로직
    switch (toolName) {
      case 'manage_student':
        return await executeManageStudent(normalizedArgs, context);

      case 'query_attendance':
        return await executeQueryAttendance(normalizedArgs, context);

      case 'manage_attendance':
        return await executeManageAttendance(normalizedArgs, context);

      case 'query_message':
        return await executeQueryMessage(normalizedArgs, context);

      case 'send_message':
        return await executeSendMessage(normalizedArgs, context);

      case 'draft_message':
        return await executeDraftMessage(normalizedArgs, context);

      case 'query_billing':
        return await executeQueryBilling(normalizedArgs, context);

      case 'manage_billing':
        return await executeManageBilling(normalizedArgs, context);

      case 'query_class':
        return await executeQueryClass(normalizedArgs, context);

      case 'get_report':
        return await executeGetReport(normalizedArgs, context);

      case 'confirm_action':
        return await executeConfirmAction(normalizedArgs, context);

      case 'cancel_action':
        return await executeCancelAction(normalizedArgs, context);

      default:
        return {
          success: false,
          result: null,
          error: `알 수 없는 Tool: ${toolName}`,
        };
    }
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
 * ========================================
 * 공통 헬퍼 함수 (P2 이슈 해결 - DRY)
 * ========================================
 */

/**
 * P2-8: 캐시된 테이블명 조회 헬퍼 (성능 최적화)
 *
 * 성능 개선: context.industry_type이 있으면 DB 조회 없이 바로 매핑
 */
async function getCachedTableName(
  context: AgentContext,
  entityType: 'student' | 'class'
): Promise<string | null> {
  // 캐시 초기화
  if (!context._tableCache) {
    context._tableCache = new Map();
  }

  // 캐시 확인
  const cacheKey = `${context.tenant_id}:${entityType}`;
  if (context._tableCache.has(cacheKey)) {
    return context._tableCache.get(cacheKey)!;
  }

  // 성능 최적화: industry_type이 context에 있으면 DB 조회 생략
  let tableName: string | null = null;

  if (context.industry_type) {
    // industry_type이 있으면 직접 매핑 (DB 조회 불필요)
    const { getIndustryTableName } = await import('./industry-adapter.ts');
    tableName = getIndustryTableName(context.industry_type, entityType);
  } else {
    // fallback: 기존 방식 (DB 조회)
    tableName = await getTenantTableName(
      context.supabase,
      context.tenant_id,
      entityType
    );
  }

  // 캐시 저장
  if (tableName) {
    context._tableCache.set(cacheKey, tableName);
  }

  return tableName;
}

/**
 * 학생 이름 또는 ID로 person_id 조회
 * P0-2: 동명이인 자동 disambiguation 구현
 * Industry Adapter 적용 완료
 */
async function resolvePersonId(
  student_name: string | undefined,
  student_id: string | undefined,
  context: AgentContext,
  phone_hint?: string,         // P0-2: 전화번호 힌트 (뒷자리 4자리)
  birth_date_hint?: string     // P0-2: 생년월일 힌트 (YYYY-MM-DD)
): Promise<{ success: boolean; person_id?: string; error?: string; candidates?: any[] }> {
  // P1-5: student_id가 있으면 UUID 형식 검증 + persons 테이블 존재 확인
  if (student_id) {
    // UUID 형식 검증
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(student_id)) {
      return {
        success: false,
        error: `잘못된 학생 ID 형식입니다: ${maskPII(student_id)}`,
      };
    }

    // persons 테이블 존재 확인
    const { data: person, error } = await context.supabase
      .from('persons')
      .select('id')
      .eq('id', student_id)
      .eq('tenant_id', requireTenantScope(context.tenant_id))
      .eq('person_type', 'student')
      .maybeSingle();

    if (error || !person) {
      return {
        success: false,
        error: `학생 ID를 찾을 수 없습니다: ${maskPII(student_id)}`,
      };
    }

    return { success: true, person_id: student_id };
  }

  if (!student_name) {
    return { success: false, error: '학생 이름 또는 ID가 필요합니다.' };
  }

  // P2-8: 캐시된 테이블명 조회
  const studentTable = await getCachedTableName(context, 'student');
  if (!studentTable) {
    console.error('[resolvePersonId] 업종별 테이블 매핑 실패');
    return { success: false, error: '업종별 학생 테이블을 찾을 수 없습니다.' };
  }

  // P0-41: industry_type 캐싱 (context에서 우선 사용, 없으면 조회 후 캐싱)
  const { getTenantIndustryType, getFKRelationName } = await import('./industry-adapter.ts');

  let industryType: string | undefined = context.industry_type;
  if (!industryType) {
    const fetchedType = await getTenantIndustryType(context.supabase, context.tenant_id);
    if (fetchedType) {
      // P0-41: 조회 성공 시 context에 캐싱 (이후 호출에서 재사용)
      industryType = fetchedType;
      context.industry_type = fetchedType;
    }
  }

  if (!industryType) {
    console.error('[resolvePersonId] industry_type 조회 실패');
    return { success: false, error: '테넌트 업종 정보를 찾을 수 없습니다.' };
  }

  // P1-10: FK 관계명 동적 생성 (SSOT 준수)
  const fkRelationName = getFKRelationName('student_person_id', industryType);

  if (!fkRelationName) {
    console.error('[resolvePersonId] FK 관계명 생성 실패:', { industryType, studentTable });
    return { success: false, error: '학생 테이블 FK 관계명을 찾을 수 없습니다.' };
  }

  // P0-20: FK 관계명 형식 검증 (persons!xxx 형태 보장)
  if (!fkRelationName.includes('!')) {
    console.error('[resolvePersonId] FK 관계명 형식 오류:', { fkRelationName });
    return { success: false, error: '학생 테이블 FK 관계명 형식이 올바르지 않습니다.' };
  }

  // P0-20: 고정 alias 사용으로 select와 filter 일관성 보장
  // PostgREST embedded filter는 select의 관계명과 filter 경로가 정확히 일치해야 함
  const FIXED_ALIAS = 'p'; // 고정 alias로 스키마 변화에 안전
  const relationTable = fkRelationName.split('!')[0]; // 'persons' 추출

  // 형식 검증: relationTable이 'persons'인지 확인
  if (relationTable !== 'persons') {
    console.error('[resolvePersonId] 예상치 않은 relation table:', { relationTable, fkRelationName });
    return { success: false, error: '학생-persons 관계 테이블이 올바르지 않습니다.' };
  }

  // P0-20: 고정 alias를 사용한 select (p:persons!xxx)
  let query = context.supabase
    .from(studentTable)
    .select(`person_id, ${FIXED_ALIAS}:${fkRelationName}(name, phone, birth_date)`)
    .eq('tenant_id', requireTenantScope(context.tenant_id))
    .ilike(`${FIXED_ALIAS}.name`, `%${student_name}%`);

  // P0-2: phone_hint나 birth_date_hint로 자동 필터링 (고정 alias 사용)
  if (phone_hint) {
    // 전화번호 숫자만 추출하여 마지막 4자리 매칭
    const phoneDigits = phone_hint.replace(/\D/g, '');
    if (phoneDigits.length >= 4) {
      const last4 = phoneDigits.slice(-4);
      query = query.ilike(`${FIXED_ALIAS}.phone`, `%${last4}`);
    }
  }

  if (birth_date_hint) {
    // 생년월일 정확 매칭 (YYYY-MM-DD 또는 YYYY.MM.DD 형식 지원)
    const normalizedDate = birth_date_hint.replace(/\./g, '-');
    query = query.eq(`${FIXED_ALIAS}.birth_date`, normalizedDate);
  }

  const { data: students, error } = await query;

  if (error) {
    console.error('[resolvePersonId] DB 오류:', maskPII(error.message));
    return { success: false, error: error.message };
  }

  if (!students || students.length === 0) {
    return {
      success: false,
      error: phone_hint || birth_date_hint
        ? `조건에 맞는 학생을 찾을 수 없습니다. 전화번호나 생년월일을 다시 확인해주세요.`
        : `학생을 찾을 수 없습니다. (입력: ${maskPII(student_name)})`,
    };
  }

  // P0-2: 동명이인 처리 - 2명 이상이면 disambiguation 요청
  if (students.length > 1) {
    // P0-20: 고정 alias 'p'를 통해 persons 데이터 접근
    const candidates = students.map((s: any) => {
      const personData = s[FIXED_ALIAS]; // 고정 alias 사용
      return {
        person_id: maskPII(s.person_id),
        name: personData?.name || '',
        phone: maskPII(personData?.phone || ''),
        birth_date: personData?.birth_date ? maskPII(personData.birth_date) : '',
      };
    });

    return {
      success: false,
      error: `동일한 이름의 학생이 ${students.length}명 있습니다. 전화번호 뒷자리 4자리나 생년월일(YYYY-MM-DD)을 함께 입력해주세요.`,
      candidates: candidates,
    };
  }

  return { success: true, person_id: students[0].person_id };
}

/**
 * ========================================
 * Tool 실행 함수들
 * ========================================
 */

async function executeManageStudent(
  args: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  const {
    action,
    student_name,
    student_id,
    phone,
    birth_date,
    guardian_phone,
    address,
    email,
    grade,
    school_name,
    class_name,
    reason,
    date
  } = args;

  // 프로덕션 최적화: 로깅 최소화

  try {
    // 학생 검색 또는 프로필 조회 (action이 없거나 search/get_profile일 때)
    if (!action || action === 'search' || action === 'get_profile') {
      if (!student_name && !student_id) {
        return {
          success: false,
          result: null,
          error: '학생 이름 또는 ID가 필요합니다',
        };
      }

      // 캐시 확인 (student_id로 조회할 때만)
      if (student_id) {
        const { memoryCache, createCacheKey } = await import('./memory-cache.ts');
        const cacheKey = createCacheKey('student', context.tenant_id, 'profile', student_id);
        const cached = memoryCache.get(cacheKey);
        if (cached) {
          return { success: true, result: cached };
        }
      }

      // P2-8: 캐시된 테이블명 조회
      const studentTable = await getCachedTableName(context, 'student');
      if (!studentTable) {
        return {
          success: false,
          result: null,
          error: '업종별 학생 테이블을 찾을 수 없습니다.',
        };
      }

      // persons 테이블과 업종별 학생 테이블 JOIN
      // 성능 최적화: 단순 조회는 필수 필드만 SELECT
      const isSimpleQuery = action === 'search' && !email && !address;
      const selectFields = isSimpleQuery
        ? `person_id, status, class_name, persons!inner (id, name, phone)`
        : `person_id, status, class_name, grade, school_name, persons!inner (id, name, phone, email, address)`;

      let query = context.supabase
        .from(studentTable)
        .select(selectFields)
        .eq('tenant_id', requireTenantScope(context.tenant_id));

      if (student_id) {
        query = query.eq('person_id', student_id);
      } else if (student_name) {
        query = query.ilike('persons.name', `%${student_name}%`);
      }

      const { data, error } = await query;

      // 프로덕션 최적화: 로깅 제거

      if (error) {
        console.error('[executeManageStudent] DB 오류:', maskPII(error.message));
        return { success: false, result: null, error: error.message };
      }

      if (!data || data.length === 0) {
        // P1 이슈 해결: 에러 메시지 PII 마스킹
        return {
          success: false,
          result: null,
          error: `학생을 찾을 수 없습니다. (입력: ${maskPII(student_name || student_id)})`,
        };
      }

      // 데이터 평탄화 (persons 정보를 최상위로)
      const flattenedData = data.map((item: any) => ({
        id: item.persons.id,
        person_id: item.person_id,
        name: item.persons.name,
        phone: item.persons.phone,
        email: item.persons.email,
        address: item.persons.address,
        status: item.status,
        class_name: item.class_name,
        grade: item.grade,
        school_name: item.school_name,
      }));

      // 단일 결과면 프로필, 여러 결과면 목록
      if (flattenedData.length === 1) {
        const student = flattenedData[0];
        const result = {
          student: student,
          message: `${student.name} 학생의 정보입니다.\n전화번호: ${student.phone || '없음'}\n반: ${student.class_name || '없음'}\n상태: ${student.status}`,
        };

        // 캐시 저장 (student_id로 조회한 경우만, 5분)
        if (student_id) {
          const { memoryCache, createCacheKey } = await import('./memory-cache.ts');
          const cacheKey = createCacheKey('student', context.tenant_id, 'profile', student_id);
          memoryCache.set(cacheKey, result, 5 * 60 * 1000);
        }

        return {
          success: true,
          result: result,
        };
      } else {
        return {
          success: true,
          result: {
            students: flattenedData,
            count: flattenedData.length,
            message: `${flattenedData.length}명의 학생을 찾았습니다.`,
          },
        };
      }
    }

    // L2 실행은 Draft 생성
    if (['register', 'update', 'update_contact', 'pause', 'resume', 'discharge', 'change_class', 'merge'].includes(action)) {
      const intentKey = `student.exec.${action}`;

      // P0-1: Automation Config First 정책 게이트 (Fail-Closed 엄격 적용, SSOT 경로 사용)
      const eventType = mapIntentToEventType(intentKey);

      if (!eventType) {
        return {
          success: false,
          result: null,
          error: `지원하지 않는 작업입니다: ${action}`,
        };
      }

      // SSOT 경로 생성 (자동으로 event_type 검증됨)
      const policyPath = getAutomationEventPolicyPath(eventType, 'enabled');
      const policyEnabled = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        policyPath
      );

      // Fail-Closed: 명시적으로 true가 아니면 차단 (boolean 명시적 검증)
      if (policyEnabled !== true) {
        return {
          success: false,
          result: null,
          error: policyEnabled === false
            ? `${action} 작업이 정책에 의해 비활성화되어 있습니다.`
            : `${action} 작업 정책이 설정되지 않았습니다. 관리자에게 문의하세요.`,
        };
      }

      // ✅ 액션별 필수 파라미터 정의
      const requiredParamsByAction: Record<string, string[]> = {
        register: ['student_name', 'phone', 'birth_date'],  // 필수: 이름, 전화번호, 생년월일
        discharge: ['student_name', 'date'],                // 필수: 이름, 날짜
        pause: ['student_name', 'date'],                    // 필수: 이름, 날짜
        resume: ['student_name'],                           // 필수: 이름
        update: ['student_name'],                           // 필수: 이름
        update_contact: ['student_name', 'phone'],          // 필수: 이름, 전화번호
        change_class: ['student_name', 'class_name'],       // 필수: 이름, 반 이름
        merge: ['student_name'],                            // 필수: 이름
      };

      const requiredParams = requiredParamsByAction[action] || [];

      // P0-3: 기존 COLLECTING draft 확인 (동일 session + intent_key)
      const { data: existingDraft, error: existingError } = await context.supabase
        .from('chatops_drafts')
        .select('*')
        .eq('tenant_id', requireTenantScope(context.tenant_id))
        .eq('session_id', context.session_id)
        .eq('intent_key', intentKey)
        .eq('status', DRAFT_STATUS.COLLECTING)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingError && existingError.code !== 'PGRST116') {
        console.error('[executeManageStudent] Draft 조회 오류:', maskPII(existingError.message));
      }

      // P0-3: 기존 COLLECTING draft가 있으면 업데이트
      if (existingDraft) {
        // P1-11: draft_params 병합 (빈 값은 덮어쓰지 않음)
        const mergedParams = { ...existingDraft.draft_params };

        // args의 각 필드를 검사하여 유효한 값만 병합
        for (const [key, value] of Object.entries(args)) {
          // 빈 문자열, null, undefined는 기존 값을 유지
          if (value !== null && value !== undefined && value !== '') {
            // 문자열이면 trim 후 빈 문자열 체크
            if (typeof value === 'string') {
              const trimmed = value.trim();
              if (trimmed !== '') {
                mergedParams[key] = trimmed;
              }
            } else {
              mergedParams[key] = value;
            }
          }
        }

        // 병합된 파라미터로 필수 항목 재확인
        const missingParams = requiredParams.filter(param => {
          if (param === 'student_name') {
            const value = mergedParams.student_name || mergedParams.name;
            return !value || (typeof value === 'string' && value.trim() === '');
          }
          const value = mergedParams[param];
          return !value || (typeof value === 'string' && value.trim() === '');
        });

        const draftStatus = missingParams.length === 0 ? DRAFT_STATUS.READY : DRAFT_STATUS.COLLECTING;

        // P0-36: Draft 업데이트 (updated_at은 DB 기본값 사용 - UTC timestamptz)
        const { data: updatedDraft, error: updateError } = await context.supabase
          .from('chatops_drafts')
          .update({
            draft_params: mergedParams,
            status: draftStatus,
            missing_required: missingParams,
            // updated_at은 DB의 now() 트리거/기본값 사용 (UTC)
          })
          .eq('id', existingDraft.id)
          .select()
          .single();

        if (updateError) {
          console.error('[executeManageStudent] Draft 업데이트 오류:', maskPII(updateError.message));
          return {
            success: false,
            result: null,
            error: `Draft 업데이트 실패: ${updateError.message}`,
          };
        }

        // 상태에 따라 메시지 반환
        const studentNameForMessage = mergedParams.name || mergedParams.student_name || '학생';

        if (draftStatus === DRAFT_STATUS.COLLECTING) {
          const paramNameMap: Record<string, string> = {
            student_name: '학생 이름',
            name: '학생 이름',
            phone: '전화번호',
            birth_date: '생년월일 (예: 1973.10.16)',
            date: '날짜 (예: 2025.12.29)',
            class_name: '반 이름',
            reason: '사유',
          };

          const missingList = missingParams
            .map(p => paramNameMap[p] || p)
            .join(', ');

          return {
            success: true,
            result: {
              message: `${studentNameForMessage} ${action === 'register' ? '등록' : action}을 위해 다음 정보가 필요합니다:\n\n${missingList}\n\n정보를 입력해주세요.`,
              draft_id: updatedDraft.id,
              status: 'collecting',
              missing_params: missingParams,
            },
          };
        }

        // ready 상태 - 실행 확인 요청
        const actionMessages: Record<string, string> = {
          register: `${studentNameForMessage} 학생 등록을 준비했습니다`,
          discharge: `${studentNameForMessage} 학생 퇴원 처리를 준비했습니다`,
          pause: `${studentNameForMessage} 학생 휴원 처리를 준비했습니다`,
          resume: `${studentNameForMessage} 학생 복귀 처리를 준비했습니다`,
          update: `${studentNameForMessage} 학생 정보 수정을 준비했습니다`,
          update_contact: `${studentNameForMessage} 학생 연락처 수정을 준비했습니다`,
          change_class: `${studentNameForMessage} 학생 반 변경을 준비했습니다`,
          merge: `학생 중복 병합을 준비했습니다`,
        };

      return {
        success: true,
        result: {
          message: `${actionMessages[action] || `${action} 작업을 준비했습니다`}. 실행하시겠습니까?\n\n(draft_id: ${updatedDraft.id})`,
          draft_id: updatedDraft.id,
          requires_confirmation: true,
        },
      };
      }

      // P0-3: 기존 draft가 없으면 새로 생성
      // ✅ 누락된 필수 파라미터 확인 (name과 student_name 둘 다 허용)
      const missingParams = requiredParams.filter(param => {
        if (param === 'student_name') {
          const value = args.student_name || args.name;
          return !value || (typeof value === 'string' && value.trim() === '');
        }
        const value = args[param];
        return !value || (typeof value === 'string' && value.trim() === '');
      });

      // ✅ 상태 결정: 필수 정보가 모두 있으면 ready, 없으면 collecting
      const draftStatus = missingParams.length === 0 ? DRAFT_STATUS.READY : DRAFT_STATUS.COLLECTING;

      // P0 이슈 해결: requireTenantScope 사용
      // Draft 생성
      const { data: draft, error: draftError } = await context.supabase
        .from('chatops_drafts')
        .insert({
          tenant_id: requireTenantScope(context.tenant_id),
          user_id: context.user_id,
          session_id: context.session_id,
          intent_key: intentKey,
          event_type: eventType,  // P0-16: event_type 명시적 저장
          draft_params: args,
          status: draftStatus,
          missing_required: missingParams,
        })
        .select()
        .single();

      if (draftError) {
        console.error('[executeManageStudent] Draft 생성 오류:', maskPII(draftError.message));
        return {
          success: false,
          result: null,
          error: `Draft 생성 실패: ${draftError.message}`,
        };
      }

      // 프로덕션 최적화: 로깅 제거

      // ✅ 상태에 따라 다른 메시지 반환
      if (draftStatus === DRAFT_STATUS.COLLECTING) {
        // 필수 정보가 부족한 경우
        const paramNameMap: Record<string, string> = {
          student_name: '학생 이름',
          name: '학생 이름',
          phone: '전화번호',
          birth_date: '생년월일 (예: 1973.10.16)',
          date: '날짜 (예: 2025.12.29)',
          class_name: '반 이름',
          reason: '사유',
        };

        const missingList = missingParams
          .map(p => paramNameMap[p] || p)
          .join(', ');

        const studentNameForMessage = args.name || args.student_name || '학생';

      return {
        success: true,
        result: {
          message: `${studentNameForMessage} ${action === 'register' ? '등록' : action}을 위해 다음 정보가 필요합니다:\n\n${missingList}\n\n정보를 입력해주세요.\n\n(draft_id: ${draft.id})`,
          draft_id: draft.id,
          status: 'collecting',
          missing_params: missingParams,
        },
      };
      }

      // ready 상태 - 실행 확인 요청
      const studentNameForMessage = args.name || args.student_name || '학생';
      const actionMessages: Record<string, string> = {
        register: `${studentNameForMessage} 학생 등록을 준비했습니다`,
        discharge: `${studentNameForMessage} 학생 퇴원 처리를 준비했습니다`,
        pause: `${studentNameForMessage} 학생 휴원 처리를 준비했습니다`,
        resume: `${studentNameForMessage} 학생 복귀 처리를 준비했습니다`,
        update: `${studentNameForMessage} 학생 정보 수정을 준비했습니다`,
        update_contact: `${studentNameForMessage} 학생 연락처 수정을 준비했습니다`,
        change_class: `${studentNameForMessage} 학생 반 변경을 준비했습니다`,
        merge: `학생 중복 병합을 준비했습니다`,
      };

    return {
      success: true,
      result: {
        message: `${actionMessages[action] || `${action} 작업을 준비했습니다`}. 실행하시겠습니까?\n\n(draft_id: ${draft.id})`,
        draft_id: draft.id,
        requires_confirmation: true,
      },
    };
    }

    return {
      success: false,
      result: null,
      error: `지원하지 않는 action: ${action}`,
    };
  } catch (error: any) {
    console.error('[executeManageStudent] 오류:', error);
    return {
      success: false,
      result: null,
      error: error.message || '학생 조회 중 오류가 발생했습니다',
    };
  }
}

async function executeQueryAttendance(
  args: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  const { type, date, class_name, student_name } = args;

  try {
    // P0-3: toKSTDate 사용
    const targetDate = date || toKSTDate();

    // 캐시 확인 (학생 이름 필터가 없을 때만)
    if (!student_name) {
      const { memoryCache, createCacheKey } = await import('./memory-cache.ts');
      const cacheKey = createCacheKey('attendance', context.tenant_id, type, targetDate);
      const cached = memoryCache.get(cacheKey);
      if (cached) {
        return { success: true, result: cached };
      }
    }

    // P0-3: date 컬럼 사용으로 KST 안전성 확보
    // attendance_logs 테이블 조회 (persons 테이블과 JOIN)
    let query = context.supabase
      .from('attendance_logs')
      .select(`
        id,
        date,
        status,
        check_in_time,
        check_out_time,
        notes,
        persons!inner (
          id,
          name
        )
      `)
      .eq('tenant_id', requireTenantScope(context.tenant_id))
      .eq('date', targetDate);  // P0-3: date 컬럼 직접 비교 (KST 안전)

    // 타입별 필터링
    if (type === 'late') {
      query = query.eq('status', 'late');
    } else if (type === 'absent') {
      query = query.eq('status', 'absent');
    } else if (type === 'unchecked') {
      query = query.is('status', null);
    }

    // 학생 이름 필터
    if (student_name) {
      query = query.ilike('persons.name', `%${student_name}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[executeQueryAttendance] DB 오류:', maskPII(error.message));
      return { success: false, result: null, error: error.message };
    }

    // 데이터 평탄화
    const flattenedData = (data || []).map((item: any) => ({
      id: item.id,
      date: item.date,
      status: item.status,
      student_name: item.persons.name,
      check_in_time: item.check_in_time,
      check_out_time: item.check_out_time,
      notes: item.notes,
    }));

    const result = {
      records: flattenedData,
      count: flattenedData.length,
      date: targetDate,
      type: type,
      message: `${targetDate} ${type} 출결: ${flattenedData.length}건`,
    };

    // 캐시 저장 (학생 이름 필터가 없을 때만, 2분)
    if (!student_name) {
      const { memoryCache, createCacheKey } = await import('./memory-cache.ts');
      const cacheKey = createCacheKey('attendance', context.tenant_id, type, targetDate);
      memoryCache.set(cacheKey, result, 2 * 60 * 1000);
    }

    return {
      success: true,
      result: result,
    };
  } catch (error: any) {
    console.error('[executeQueryAttendance] 오류:', error);
    return {
      success: false,
      result: null,
      error: error.message || '출결 조회 중 오류가 발생했습니다',
    };
  }
}

async function executeManageAttendance(
  args: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  const { action } = args;
  const intentKey = `attendance.exec.${action}`;

  // P0-12: Automation Config First 정책 게이트 (Fail-Closed 엄격 적용)
  const eventType = mapIntentToEventType(intentKey);

  if (!eventType) {
    return {
      success: false,
      result: null,
      error: `지원하지 않는 출결 관리 작업입니다: ${action}`,
    };
  }

  // SSOT 경로 생성 (자동으로 event_type 검증됨)
  const policyPath = getAutomationEventPolicyPath(eventType, 'enabled');
  const policyEnabled = await getTenantSettingByPath(
    context.supabase,
    context.tenant_id,
    policyPath
  );

  // Fail-Closed: 명시적으로 true가 아니면 차단 (boolean 명시적 검증)
  if (policyEnabled !== true) {
    return {
      success: false,
      result: null,
      error: policyEnabled === false
        ? `${action} 작업이 정책에 의해 비활성화되어 있습니다.`
        : `${action} 작업 정책이 설정되지 않았습니다. 관리자에게 문의하세요.`,
    };
  }

  // Draft 생성
  const { data: draft, error: draftError } = await context.supabase
    .from('chatops_drafts')
    .insert({
      tenant_id: requireTenantScope(context.tenant_id),
      user_id: context.user_id,
      session_id: context.session_id,
      intent_key: intentKey,
      event_type: eventType,  // P2-10: event_type 명시적 저장
      draft_params: args,
      status: DRAFT_STATUS.READY,
      missing_required: [],  // P2-10: ready 상태는 빈 배열
    })
    .select()
    .single();

  if (draftError) {
    console.error('[executeManageAttendance] Draft 생성 오류:', maskPII(draftError.message));
    return {
      success: false,
      result: null,
      error: `Draft 생성 실패: ${draftError.message}`,
    };
  }

  return {
    success: true,
    result: {
      message: `${action} 작업을 준비했습니다. 실행하시겠습니까?\n\n(draft_id: ${draft.id})`,
      draft_id: draft.id,
      requires_confirmation: true,
    },
  };
}

async function executeQueryMessage(
  args: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  const { type, date, student_name } = args;

  try {
    // 캐시 확인 (날짜 필터가 없을 때만)
    if (!date) {
      const { memoryCache, createCacheKey } = await import('./memory-cache.ts');
      const cacheKey = createCacheKey('message' as any, context.tenant_id, type);
      const cached = memoryCache.get(cacheKey);
      if (cached) {
        return { success: true, result: cached };
      }
    }

    // message_logs 테이블 조회
    let query = context.supabase
      .from('message_logs')
      .select('*')
      .eq('tenant_id', requireTenantScope(context.tenant_id))
      .order('created_at', { ascending: false })
      .limit(50);

    // 타입별 필터링 (상수 사용)
    if (type === 'failed_log') {
      query = query.eq('status', MESSAGE_STATUS.FAILED);
    } else if (type === 'sent_log') {
      query = query.eq('status', MESSAGE_STATUS.SENT);
    }

    // P0-3: 날짜 필터 수정 (다음날 00:00:00를 upper bound로)
    // P0-13: KST 날짜 범위를 UTC로 변환하여 필터링
    if (date) {
      const startUTC = kstDateToUTC(date);
      const endUTC = nextKSTDateToUTC(date);

      query = query.gte('created_at', startUTC)
                   .lt('created_at', endUTC);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[executeQueryMessage] DB 오류:', maskPII(error.message));
      return { success: false, result: null, error: error.message };
    }

    const result = {
      messages: data || [],
      count: data?.length || 0,
      type: type,
      message: `${type} 메시지: ${data?.length || 0}건`,
    };

    // 캐시 저장 (날짜 필터가 없을 때만, 1분)
    if (!date) {
      const { memoryCache, createCacheKey } = await import('./memory-cache.ts');
      const cacheKey = createCacheKey('message' as any, context.tenant_id, type);
      memoryCache.set(cacheKey, result, 1 * 60 * 1000);
    }

    return {
      success: true,
      result: result,
    };
  } catch (error: any) {
    console.error('[executeQueryMessage] 오류:', error);
    return {
      success: false,
      result: null,
      error: error.message || '메시지 조회 중 오류가 발생했습니다',
    };
  }
}

async function executeSendMessage(
  args: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  const { type, recipient, recipients, message } = args;

  // Intent Key 매핑 (type에 따라)
  const intentKeyMap: Record<string, string> = {
    'single': 'message.exec.send_single',
    'bulk': 'message.exec.send_bulk',
    'scheduled': 'message.exec.send_scheduled',
    'resend_failed': 'message.exec.resend_failed',
    'cancel_scheduled': 'message.exec.cancel_scheduled',
  };
  const intentKey = intentKeyMap[type] || `message.exec.send_${type}`;

  // P0-1: Automation Config First 정책 게이트 (Fail-Closed 엄격 적용, SSOT 경로 사용)
  const eventType = mapIntentToEventType(intentKey);

  if (!eventType) {
    return {
      success: false,
      result: null,
      error: `지원하지 않는 메시지 발송 유형입니다: ${type}`,
    };
  }

  // SSOT 경로 생성 (자동으로 event_type 검증됨)
  const policyPath = getAutomationEventPolicyPath(eventType, 'enabled');
  const policyEnabled = await getTenantSettingByPath(
    context.supabase,
    context.tenant_id,
    policyPath
  );

  // Fail-Closed: 명시적으로 true가 아니면 차단 (boolean 명시적 검증)
  if (policyEnabled !== true) {
    return {
      success: false,
      result: null,
      error: policyEnabled === false
        ? '메시지 발송이 정책에 의해 비활성화되어 있습니다.'
        : `메시지 발송 정책이 설정되지 않았습니다. 관리자에게 문의하세요.`,
    };
  }

  // P0-35: 필수값 검증 (message, recipient/recipients)
  if (!message || typeof message !== 'string' || message.trim() === '') {
    return {
      success: false,
      result: null,
      error: '메시지 내용은 필수입니다.',
    };
  }

  // P0-35: 수신자 검증 (recipient 또는 recipients 중 하나는 필수)
  const hasRecipient = recipient && typeof recipient === 'string' && recipient.trim() !== '';
  const hasRecipients = Array.isArray(recipients) && recipients.length > 0;

  if (!hasRecipient && !hasRecipients) {
    return {
      success: false,
      result: null,
      error: '수신자 정보는 필수입니다. (recipient 또는 recipients)',
    };
  }

  // Draft 생성 (eventType은 위에서 이미 선언됨)
  const { data: draft, error: draftError } = await context.supabase
    .from('chatops_drafts')
    .insert({
      tenant_id: requireTenantScope(context.tenant_id),
      user_id: context.user_id,
      session_id: context.session_id,
      intent_key: intentKey,
      event_type: eventType,  // P0-29: null 제거 (위에서 이미 검증됨)
      draft_params: args,
      status: DRAFT_STATUS.READY,
      missing_required: [],  // P0-15: confirm_required 제거, status='ready'로 대체
    })
    .select()
    .single();

  if (draftError) {
    console.error('[executeSendMessage] Draft 생성 오류:', draftError);
    return {
      success: false,
      result: null,
      error: `Draft 생성 실패: ${draftError.message}`,
    };
  }

  const recipientText = recipient || `${recipients?.length || 0}명`;

  return {
    success: true,
    result: {
      message: `${recipientText}에게 메시지 발송을 준비했습니다. 실행하시겠습니까?\n\n내용: ${message?.substring(0, 50)}${message?.length > 50 ? '...' : ''}\n\n(draft_id: ${draft.id})`,
      draft_id: draft.id,
      requires_confirmation: true,
    },
  };
}

async function executeDraftMessage(
  args: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  const { type, target, content } = args;

  // P0-38: 초안은 실행 대상이 아님 - COLLECTING 상태로 저장
  // message.draft.*는 "초안 전용(실행 금지)"
  const intentKey = `message.draft.${type}`;

  // P2-10: event_type 매핑
  const eventType = mapIntentToEventType(intentKey);

  // P0-38: chatops_drafts에 COLLECTING 상태로 저장 (실행 불가)
  const { data: draft, error: draftError } = await context.supabase
    .from('chatops_drafts')
    .insert({
      tenant_id: requireTenantScope(context.tenant_id),
      user_id: context.user_id,
      session_id: context.session_id,
      intent_key: intentKey,
      event_type: eventType || null,  // P2-10: event_type 명시적 저장 (매핑 없으면 null)
      draft_params: args,
      status: DRAFT_STATUS.COLLECTING,  // P0-38: 초안은 COLLECTING (실행 불가)
      missing_required: ['confirm_send'],  // P0-38: 발송 확인 필요
    })
    .select()
    .single();

  if (draftError) {
    console.error('[executeDraftMessage] Draft 생성 오류:', maskPII(draftError.message));
    return {
      success: false,
      result: null,
      error: `Draft 생성 실패: ${draftError.message}`,
    };
  }

  // P0-38: 초안은 "발송으로 전환" 유도 (confirm_action이 아닌 send_message 호출)
  return {
    success: true,
    result: {
      message: `${type} 메시지 초안을 작성했습니다.\n\n발송하려면 "send_message" 도구를 사용하여 메시지를 발송하세요.\n\n초안 내용:\n- 대상: ${target}\n- 내용: ${content}\n\n(draft_id: ${draft.id})`,
      draft_id: draft.id,
      requires_send_conversion: true,  // P0-38: 발송 전환 필요 (confirm이 아님)
    },
  };
}

async function executeQueryBilling(
  args: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  const { type, month, student_name } = args;

  try {
    // 캐시 확인 (학생 이름 필터가 없을 때만)
    if (!student_name) {
      const { memoryCache, createCacheKey } = await import('./memory-cache.ts');
      const cacheKey = createCacheKey('billing', context.tenant_id, type, month || 'current');
      const cached = memoryCache.get(cacheKey);
      if (cached) {
        return { success: true, result: cached };
      }
    }

    // invoices 테이블 조회 (persons 테이블과 JOIN)
    let query = context.supabase
      .from('invoices')
      .select(`
        id,
        invoice_number,
        amount,
        paid_amount,
        status,
        due_date,
        created_at,
        persons!inner (
          id,
          name
        )
      `)
      .eq('tenant_id', requireTenantScope(context.tenant_id))
      .order('created_at', { ascending: false })
      .limit(50);

    // 타입별 필터링
    if (type === 'overdue_list') {
      query = query.eq('status', 'overdue');
    } else if (type === 'unissued') {
      query = query.eq('status', 'draft');
    }

    // P0-3: 월 필터 수정 (다음달 01일 00:00:00를 upper bound로)
    if (month) {
      const [year, monthNum] = month.split('-').map(Number);
      // P0-13: KST 월 범위를 UTC로 변환하여 필터링
      const startUTC = kstDateToUTC(`${month}-01`);
      const endUTC = nextKSTMonthToUTC(month);

      query = query.gte('created_at', startUTC)
                   .lt('created_at', endUTC);
    }

    // 학생 이름 필터
    if (student_name) {
      query = query.ilike('persons.name', `%${student_name}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[executeQueryBilling] DB 오류:', maskPII(error.message));
      return { success: false, result: null, error: error.message };
    }

    // 데이터 평탄화
    const flattenedData = (data || []).map((item: any) => ({
      id: item.id,
      invoice_number: item.invoice_number,
      student_name: item.persons.name,
      amount: item.amount,
      paid_amount: item.paid_amount,
      status: item.status,
      due_date: item.due_date,
      created_at: item.created_at,
    }));

    const totalAmount = flattenedData.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalPaid = flattenedData.reduce((sum, item) => sum + (item.paid_amount || 0), 0);

    const result = {
      invoices: flattenedData,
      count: flattenedData.length,
      total_amount: totalAmount,
      total_paid: totalPaid,
      total_unpaid: totalAmount - totalPaid,
      type: type,
      message: `${type} 수납: ${flattenedData.length}건, 미수금: ${totalAmount - totalPaid}원`,
    };

    // 캐시 저장 (학생 이름 필터가 없을 때만, 3분)
    if (!student_name) {
      const { memoryCache, createCacheKey } = await import('./memory-cache.ts');
      const cacheKey = createCacheKey('billing', context.tenant_id, type, month || 'current');
      memoryCache.set(cacheKey, result, 3 * 60 * 1000);
    }

    return {
      success: true,
      result: result,
    };
  } catch (error: any) {
    console.error('[executeQueryBilling] 오류:', error);
    return {
      success: false,
      result: null,
      error: error.message || '수납 조회 중 오류가 발생했습니다',
    };
  }
}

async function executeManageBilling(
  args: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  const { action } = args;
  const intentKey = `billing.exec.${action}`;

  // P0-12: Automation Config First 정책 게이트 (Fail-Closed 엄격 적용)
  const eventType = mapIntentToEventType(intentKey);

  if (!eventType) {
    return {
      success: false,
      result: null,
      error: `지원하지 않는 수납 관리 작업입니다: ${action}`,
    };
  }

  // SSOT 경로 생성 (자동으로 event_type 검증됨)
  const policyPath = getAutomationEventPolicyPath(eventType, 'enabled');
  const policyEnabled = await getTenantSettingByPath(
    context.supabase,
    context.tenant_id,
    policyPath
  );

  // Fail-Closed: 명시적으로 true가 아니면 차단 (boolean 명시적 검증)
  if (policyEnabled !== true) {
    return {
      success: false,
      result: null,
      error: policyEnabled === false
        ? `${action} 작업이 정책에 의해 비활성화되어 있습니다.`
        : `${action} 작업 정책이 설정되지 않았습니다. 관리자에게 문의하세요.`,
    };
  }

  // Draft 생성
  const { data: draft, error: draftError } = await context.supabase
    .from('chatops_drafts')
    .insert({
      tenant_id: requireTenantScope(context.tenant_id),
      user_id: context.user_id,
      session_id: context.session_id,
      intent_key: intentKey,
      event_type: eventType,  // P2-10: event_type 명시적 저장
      draft_params: args,
      status: DRAFT_STATUS.READY,
      missing_required: [],  // P2-10: ready 상태는 빈 배열
    })
    .select()
    .single();

  if (draftError) {
    console.error('[executeManageBilling] Draft 생성 오류:', maskPII(draftError.message));
    return {
      success: false,
      result: null,
      error: `Draft 생성 실패: ${draftError.message}`,
    };
  }

  return {
    success: true,
    result: {
      message: `${action} 작업을 준비했습니다. 실행하시겠습니까?\n\n(draft_id: ${draft.id})`,
      draft_id: draft.id,
      requires_confirmation: true,
    },
  };
}

async function executeQueryClass(
  args: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  const { type, class_name } = args;

  // 캐싱 import
  const { memoryCache, createCacheKey } = await import('./memory-cache.ts');

  try {
    if (type === 'list') {
      // 캐시 확인
      const cacheKey = createCacheKey('class', context.tenant_id, 'list');
      const cached = memoryCache.get(cacheKey);
      if (cached) {
        return {
          success: true,
          result: cached,
        };
      }

      // P2-8: 캐시된 테이블명 조회
      const classTable = await getCachedTableName(context, 'class');
      if (!classTable) {
        return { success: false, result: null, error: '업종별 반 테이블을 찾을 수 없습니다.' };
      }

      // 반 목록 조회
      const { data, error } = await context.supabase
        .from(classTable)
        .select('id, name, instructor_name, schedule, student_count, status')
        .eq('tenant_id', requireTenantScope(context.tenant_id))
        .order('name', { ascending: true });

      if (error) {
        return { success: false, result: null, error: error.message };
      }

      const result = {
        classes: data || [],
        count: data?.length || 0,
        message: `반 목록: ${data?.length || 0}개`,
      };

      // 캐시 저장 (5분)
      memoryCache.set(cacheKey, result, 5 * 60 * 1000);

      return {
        success: true,
        result: result,
      };
    } else if (type === 'roster' && class_name) {
      // 캐시 확인
      const cacheKey = createCacheKey('class', context.tenant_id, 'roster', class_name);
      const cached = memoryCache.get(cacheKey);
      if (cached) {
        return {
          success: true,
          result: cached,
        };
      }

      // P2-8: 캐시된 테이블명 조회
      const studentTable = await getCachedTableName(context, 'student');
      if (!studentTable) {
        return { success: false, result: null, error: '업종별 학생 테이블을 찾을 수 없습니다.' };
      }

      // 반 명단 조회 (업종별 학생 테이블과 persons JOIN)
      const { data, error } = await context.supabase
        .from(studentTable)
        .select(`
          person_id,
          status,
          persons!inner (
            id,
            name,
            phone
          )
        `)
        .eq('tenant_id', requireTenantScope(context.tenant_id))
        .eq('class_name', class_name)
        .eq('status', STUDENT_STATUS.ACTIVE);

      if (error) {
        return { success: false, result: null, error: error.message };
      }

      // 데이터 평탄화
      const students = (data || []).map((item: any) => ({
        id: item.persons.id,
        name: item.persons.name,
        phone: item.persons.phone,
        status: item.status,
      }));

      const result = {
        class_name: class_name,
        students: students,
        count: students.length,
        message: `${class_name} 반 명단: ${students.length}명`,
      };

      // 캐시 저장 (3분)
      memoryCache.set(cacheKey, result, 3 * 60 * 1000);

      return {
        success: true,
        result: result,
      };
    }

    return {
      success: false,
      result: null,
      error: '지원하지 않는 조회 유형입니다',
    };
  } catch (error: any) {
    return {
      success: false,
      result: null,
      error: error.message || '반 조회 중 오류가 발생했습니다',
    };
  }
}

async function executeGetReport(
  args: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  const { type, period = 'today' } = args;

  // 프로덕션 최적화: 로깅 제거

  try {
    // P0-42: KST 날짜 사용 (UTC 날짜는 한국 운영 시 하루 밀림)
    const { toKSTDate } = await import('./date-utils.ts');
    const today = toKSTDate(new Date());

    if (type === 'dashboard') {
      // 캐시 확인
      const { memoryCache, createCacheKey } = await import('./memory-cache.ts');
      const cacheKey = createCacheKey('dashboard' as any, context.tenant_id, today);
      const cached = memoryCache.get(cacheKey);
      if (cached) {
        return { success: true, result: cached };
      }

      // P0-42: 대시보드 KPI 조회 (병렬 처리로 최적화)
      // thisMonth도 KST 기준으로 계산
      const kstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
      const thisMonth = `${kstNow.getFullYear()}-${String(kstNow.getMonth() + 1).padStart(2, '0')}`;

      // P2-8: 캐시된 테이블명 조회
      const studentTable = await getCachedTableName(context, 'student');
      if (!studentTable) {
        return { success: false, result: null, error: '업종별 학생 테이블을 찾을 수 없습니다.' };
      }

      // 병렬 실행 (4개 쿼리 동시 실행)
      const [
        { data: attendanceData },
        { data: billingData },
        { count: studentCount }
      ] = await Promise.all([
        // 1. 오늘 출결 통계
        context.supabase
          .from('attendance_logs')
          .select('status')
          .eq('tenant_id', requireTenantScope(context.tenant_id))
          .eq('date', today),

        // 2. 이번 달 수납 통계
        context.supabase
          .from('invoices')
          .select('amount, paid_amount, status')
          .eq('tenant_id', requireTenantScope(context.tenant_id))
          .gte('created_at', kstDateToUTC(`${thisMonth}-01`)),  // P0-13: KST → UTC

        // 3. 전체 학생 수
        context.supabase
          .from(studentTable)
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', requireTenantScope(context.tenant_id))
          .eq('status', 'active')
      ]);

      const attendanceStats = {
        total: attendanceData?.length || 0,
        present: attendanceData?.filter(r => r.status === 'present').length || 0,
        late: attendanceData?.filter(r => r.status === 'late').length || 0,
        absent: attendanceData?.filter(r => r.status === 'absent').length || 0,
      };

      const billingStats = {
        total_invoices: billingData?.length || 0,
        total_amount: billingData?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0,
        total_paid: billingData?.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0) || 0,
        overdue: billingData?.filter(inv => inv.status === 'overdue').length || 0,
      };

      const result = {
        attendance: attendanceStats,
        billing: billingStats,
        students: { total: studentCount || 0 },
        date: today,
        message: `대시보드 KPI: 학생 ${studentCount}명, 출석 ${attendanceStats.present}명, 연체 ${billingStats.overdue}건`,
      };

      // 캐시 저장 (5분)
      memoryCache.set(cacheKey, result, 5 * 60 * 1000);

      return {
        success: true,
        result: result,
      };
    } else if (type === 'attendance') {
      // 출결 요약
      const { data, error } = await context.supabase
        .from('attendance_logs')
        .select('status, occurred_at, date')
        .eq('tenant_id', requireTenantScope(context.tenant_id))
        .eq('date', today)
        .order('occurred_at', { ascending: false })
        .limit(100);

      if (error) {
        return { success: false, result: null, error: error.message };
      }

      const summary = {
        total: data?.length || 0,
        present: data?.filter(r => r.status === 'present').length || 0,
        late: data?.filter(r => r.status === 'late').length || 0,
        absent: data?.filter(r => r.status === 'absent').length || 0,
      };

      return {
        success: true,
        result: {
          summary: summary,
          period: period,
          message: `출결 요약: 출석 ${summary.present}, 지각 ${summary.late}, 결석 ${summary.absent}`,
        },
      };
    } else if (type === 'billing') {
      // 수납 요약
      const thisMonth = new Date().toISOString().substring(0, 7);
      const { data, error } = await context.supabase
        .from('invoices')
        .select('amount, paid_amount, status')
        .eq('tenant_id', requireTenantScope(context.tenant_id))
        .gte('created_at', kstDateToUTC(`${thisMonth}-01`));  // P0-13: KST → UTC

      if (error) {
        return { success: false, result: null, error: error.message };
      }

      const summary = {
        total_invoices: data?.length || 0,
        total_amount: data?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0,
        total_paid: data?.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0) || 0,
        pending: data?.filter(inv => inv.status === 'pending').length || 0,
        overdue: data?.filter(inv => inv.status === 'overdue').length || 0,
      };

      return {
        success: true,
        result: {
          summary: summary,
          period: period,
          message: `수납 요약: 청구 ${summary.total_invoices}건, 수납 ${summary.total_paid}원, 연체 ${summary.overdue}건`,
        },
      };
    }

    return {
      success: false,
      result: null,
      error: '지원하지 않는 리포트 유형입니다',
    };
  } catch (error: any) {
    console.error('[executeGetReport] 오류:', error);
    return {
      success: false,
      result: null,
      error: error.message || '리포트 조회 중 오류가 발생했습니다',
    };
  }
}

/**
 * Agent 대화 실행 (스트리밍 버전)
 */
export async function runAgentStreaming(
  userMessage: string,
  conversationHistory: AgentMessage[],
  context: AgentContext,
  maxIterations: number = 5
): Promise<ReadableStream> {
  const systemPrompt = `학원 관리 AI 어시스턴트. 반드시 Tool을 사용해 처리한다. (Tool-first)

**[상태머신]**
- manage_* Tool은 실행이 아니라 Draft를 만든다.
- Draft status:
  - collecting: 필수정보 누락 → 누락 항목만 물어보고, 사용자가 값만 보내면 같은 intent의 Draft를 업데이트한다.
  - ready: 필수정보 충족 → "요약 + 실행할까요?"로 확인을 받는다. **draft_id를 응답에 포함한다.**
- 사용자가 "실행/진행/확인/응/네/예" 등 동의 표현 → confirm_action 호출 (draft_id 포함)
- 사용자가 "취소/아니/중단" → cancel_action 호출 (draft_id 포함)
- 동의/취소가 아닌 추가 정보 제공(날짜/전화/생년월일) → 해당 manage_* 재호출로 Draft 업데이트

**[Tool 선택 규칙 - 우선순위 순서]**
1. 이름만 언급 (예: "마이콜", "김철수") → **무조건 manage_student** (학생 이름으로 간주)
2. "이름 + 전화번호/정보/프로필" → manage_student (action: 'search' 또는 'get_profile')
3. "~반 목록", "~반 명단", "초등 1반" 등 "반"이 명시 → query_class
4. "지각", "결석", "출석", "출결" → query_attendance 또는 manage_attendance
5. "메시지", "문자", "알림", "공지" → query_message / send_message / draft_message
6. "수납", "청구", "연체", "미수금", "입금" → query_billing 또는 manage_billing
7. "통계", "현황", "요약", "대시보드" → get_report

**중요: 이름과 반 구분 규칙**
- 사용자가 단순히 이름만 언급 → 학생 이름으로 간주 (manage_student)
- "~반", "반 목록", "반 명단" 등 "반" 키워드 명시 → 반 조회 (query_class)
- 불확실하면 학생 이름 우선

**[학생 관련 규칙]**
- 필수(등록): 이름, 전화번호, 생년월일
- 동명이인/식별 불가 시: 전화번호 뒷자리 4자리 또는 생년월일(YYYY-MM-DD) 중 하나를 요청한다.

**[형식/정규화]**
- 날짜 입력이 YYYY.MM.DD 또는 YYYY/MM/DD이면 YYYY-MM-DD로 변환해 Tool args에 넣는다.
- phone_hint는 숫자만 또는 뒷자리 4자리도 허용.
- Tool args는 가능한 한 명시적으로 채우고, 모르면 생략(임의값 금지).

**[안전/정책/PII]**
- 정책에 의해 차단되면 실행을 계속 유도하지 말고, "관리자 설정 필요"로 안내한다.
- 응답에 주민번호/전체 전화번호/내부 UUID를 과도하게 노출하지 않는다.
- Tool 결과를 근거로만 말하고, 확인되지 않은 실행 완료를 단정하지 않는다.

**[응답 스타일]**
짧고 친절하게. 직전 대화 맥락(최근 3턴) 고려.`;

  // P2-8: 동의/취소 패턴 감지 및 draft_id 자동 주입
  const consentPattern = /^(네|예|응|확인|실행|진행|좋아|ok|yes)$/i;
  const cancelPattern = /^(아니|취소|중단|그만|안해|no)$/i;
  const trimmedMessage = userMessage.trim();

  let enhancedUserMessage = userMessage;
  if (consentPattern.test(trimmedMessage)) {
    // 동의 패턴: draft_id가 없으면 자동 추출
    const draftId = extractLastDraftId(conversationHistory);
    if (draftId) {
      enhancedUserMessage = `${userMessage}\n\n(draft_id: ${draftId})`;
    }
  } else if (cancelPattern.test(trimmedMessage)) {
    // 취소 패턴: draft_id가 없으면 자동 추출
    const draftId = extractLastDraftId(conversationHistory);
    if (draftId) {
      enhancedUserMessage = `${userMessage}\n\n(draft_id: ${draftId})`;
    }
  }

  const messages: AgentMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-6),
    { role: 'user', content: enhancedUserMessage },
  ];

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        let iteration = 0;
        let fullResponse = '';
        const toolResults: Array<{ tool: string; success: boolean; result: any }> = [];
        let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

        while (iteration < maxIterations) {
          iteration++;

          const stream = callOpenAIChatStreaming(
            context.openai_api_key,
            messages,
            AGENT_TOOLS,
            'auto'
          );

          let currentContent = '';
          let currentToolCalls: ToolCall[] | undefined;
          let streamUsage: any;

          for await (const chunk of stream) {
            if (chunk.type === 'content' && chunk.content) {
              currentContent += chunk.content;
              fullResponse += chunk.content;

              // 실시간 스트리밍 전송
              const sseData = `data: ${JSON.stringify({ type: 'content', content: chunk.content })}\n\n`;
              controller.enqueue(encoder.encode(sseData));
            } else if (chunk.type === 'tool_calls' && chunk.tool_calls) {
              currentToolCalls = chunk.tool_calls;
            } else if (chunk.type === 'done') {
              streamUsage = chunk.usage;
            }
          }

          if (streamUsage) {
            totalUsage.prompt_tokens += streamUsage.prompt_tokens || 0;
            totalUsage.completion_tokens += streamUsage.completion_tokens || 0;
            totalUsage.total_tokens += streamUsage.total_tokens || 0;
          }

          // Tool 호출이 없으면 종료
          if (!currentToolCalls || currentToolCalls.length === 0) {
            break;
          }

          // Tool 실행
          messages.push({
            role: 'assistant',
            content: currentContent || '',
            tool_calls: currentToolCalls,
          });

          for (const toolCall of currentToolCalls) {
            const toolName = toolCall.function.name;
            let toolArgs: Record<string, any>;

            try {
              toolArgs = JSON.parse(toolCall.function.arguments);
            } catch (parseError) {
              const errorResult = {
                success: false,
                error: `Tool 인자 파싱 실패: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
              };

              toolResults.push({
                tool: toolName,
                success: false,
                result: null,
              });

              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                name: toolName,
                content: JSON.stringify({ error: errorResult.error }),
              });
              continue;
            }

            const result = await executeTool(toolName, toolArgs, context);
            toolResults.push({
              tool: toolName,
              success: result.success,
              result: result.result,
            });

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolName,
              content: JSON.stringify(result.success ? result.result : { error: result.error }),
            });
          }
        }

        // P2-11: 비용 계산 (표시용 추정치, MODEL_PRICING 상수 사용)
        const pricing = MODEL_PRICING['gpt-4o-mini'];
        const costUsd = (totalUsage.prompt_tokens * pricing.input + totalUsage.completion_tokens * pricing.output);
        const costKrw = costUsd * EXCHANGE_RATE_USD_TO_KRW;

        // 완료 신호
        const doneData = `data: ${JSON.stringify({
          type: 'done',
          fullResponse,
          tool_results: toolResults.length > 0 ? toolResults : undefined,
          usage: {
            ...totalUsage,
            // P0-23: 비용은 추정치로 명시 (UI 표시 시 경고 필요)
            cost_estimate_usd: `$${costUsd.toFixed(6)}`,
            cost_estimate_krw: `₩${costKrw.toFixed(2)}`,
            model: 'gpt-4o-mini',
            pricing_note: '추정치 (정산용 아님)',
          }
        })}\n\n`;
        controller.enqueue(encoder.encode(doneData));

        controller.close();
      } catch (error) {
        console.error('[runAgentStreaming] 오류:', error);

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

/**
 * Agent 대화 실행
 */
/**
 * 최근 대화에서 draft_id 추출 (draft_id 추적 메커니즘)
 */
/**
 * P1-12: 최근 대화에서 draft_id 추출
 *
 * assistant 메시지의 content뿐만 아니라 tool 메시지의 content도 검사합니다.
 * 스트리밍 응답에서는 tool_result JSON에 draft_id가 포함될 수 있습니다.
 *
 * @param conversationHistory 대화 히스토리
 * @returns draft_id 또는 null
 */
function extractLastDraftId(conversationHistory: AgentMessage[]): string | null {
  // 최근 10개 메시지에서 draft_id 패턴 검색 (역순)
  for (let i = conversationHistory.length - 1; i >= Math.max(0, conversationHistory.length - 10); i--) {
    const msg = conversationHistory[i];

    // P1-12: assistant 메시지와 tool 메시지 모두 검사
    if ((msg.role === 'assistant' || msg.role === 'tool') && msg.content) {
      // draft_id 패턴: draft_id: uuid 또는 "draft_id": "uuid"
      const match = msg.content.match(/draft_id["\s:]+([a-f0-9-]{36})/i);
      if (match) {
        return match[1];
      }
    }

    // P1-12: tool_calls의 arguments에서도 검색 (OpenAI 응답 형식)
    if (msg.role === 'assistant' && (msg as any).tool_calls) {
      const toolCalls = (msg as any).tool_calls;
      for (const tc of toolCalls) {
        if (tc.function?.arguments) {
          try {
            const args = typeof tc.function.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments;

            if (args.draft_id && /^[a-f0-9-]{36}$/i.test(args.draft_id)) {
              return args.draft_id;
            }
          } catch {
            // JSON 파싱 실패는 무시
          }
        }
      }
    }
  }
  return null;
}

export async function runAgent(
  userMessage: string,
  conversationHistory: AgentMessage[],
  context: AgentContext,
  maxIterations: number = 5
): Promise<AgentResponse> {

  // System Prompt (최적화: 가드레일 강화, 550 토큰급)
  const systemPrompt = `학원 관리 AI 어시스턴트. 반드시 Tool을 사용해 처리한다. (Tool-first)

**[상태머신]**
- manage_* Tool은 실행이 아니라 Draft를 만든다.
- Draft status:
  - collecting: 필수정보 누락 → 누락 항목만 물어보고, 사용자가 값만 보내면 같은 intent의 Draft를 업데이트한다.
  - ready: 필수정보 충족 → "요약 + 실행할까요?"로 확인을 받는다. **draft_id를 응답에 포함한다.**
- 사용자가 "실행/진행/확인/응/네/예" 등 동의 표현 → confirm_action 호출 (draft_id 포함)
- 사용자가 "취소/아니/중단" → cancel_action 호출 (draft_id 포함)
- 동의/취소가 아닌 추가 정보 제공(날짜/전화/생년월일) → 해당 manage_* 재호출로 Draft 업데이트

**[Tool 선택 규칙 - 우선순위 순서]**
1. 이름만 언급 (예: "마이콜", "김철수") → **무조건 manage_student** (학생 이름으로 간주)
2. "이름 + 전화번호/정보/프로필" → manage_student (action: 'search' 또는 'get_profile')
3. "~반 목록", "~반 명단", "초등 1반" 등 "반"이 명시 → query_class
4. "지각", "결석", "출석", "출결" → query_attendance 또는 manage_attendance
5. "메시지", "문자", "알림", "공지" → query_message / send_message / draft_message
6. "수납", "청구", "연체", "미수금", "입금" → query_billing 또는 manage_billing
7. "통계", "현황", "요약", "대시보드" → get_report

**중요: 이름과 반 구분 규칙**
- 사용자가 단순히 이름만 언급 → 학생 이름으로 간주 (manage_student)
- "~반", "반 목록", "반 명단" 등 "반" 키워드 명시 → 반 조회 (query_class)
- 불확실하면 학생 이름 우선

**[학생 관련 규칙]**
- 필수(등록): 이름, 전화번호, 생년월일
- 동명이인/식별 불가 시: 전화번호 뒷자리 4자리 또는 생년월일(YYYY-MM-DD) 중 하나를 요청한다.

**[출결 관련 규칙]**
- "오늘 지각", "결석자" → query_attendance (type: 'late' 또는 'absent')
- "마이콜 출석" → query_attendance (type: 'by_student', student_name: '마이콜')
- "결석자에게 알림" → manage_attendance (action: 'notify_absent')

**[메시지 관련 규칙]**
- "어제 보낸 메시지" → query_message (type: 'sent_log', date: 어제)
- "마이콜에게 메시지" → send_message (type: 'single', recipient: '마이콜')
- "공지 초안" → draft_message (type: 'general')

**[수납 관련 규칙]**
- "연체자", "연체 목록" → query_billing (type: 'overdue_list')
- "마이콜 수납 내역" → query_billing (type: 'by_student', student_name: '마이콜')
- "청구서 발행" → manage_billing (action: 'issue_invoice')

**[형식/정규화]**
- 날짜 입력이 YYYY.MM.DD 또는 YYYY/MM/DD이면 YYYY-MM-DD로 변환해 Tool args에 넣는다.
- phone_hint는 숫자만 또는 뒷자리 4자리도 허용.
- Tool args는 가능한 한 명시적으로 채우고, 모르면 생략(임의값 금지).

**[안전/정책/PII]**
- 정책에 의해 차단되면 실행을 계속 유도하지 말고, "관리자 설정 필요"로 안내한다.
- 응답에 주민번호/전체 전화번호/내부 UUID를 과도하게 노출하지 않는다.
- Tool 결과를 근거로만 말하고, 확인되지 않은 실행 완료를 단정하지 않는다.

**[응답 스타일]**
짧고 친절하게. 직전 대화 맥락(최근 3턴) 고려.`;

  // P2-8: 동의/취소 패턴 감지 및 draft_id 자동 주입
  const consentPattern = /^(네|예|응|확인|실행|진행|좋아|ok|yes)$/i;
  const cancelPattern = /^(아니|취소|중단|그만|안해|no)$/i;
  const trimmedMessage = userMessage.trim();

  let enhancedUserMessage = userMessage;
  if (consentPattern.test(trimmedMessage)) {
    // 동의 패턴: draft_id가 없으면 자동 추출
    const draftId = extractLastDraftId(conversationHistory);
    if (draftId) {
      enhancedUserMessage = `${userMessage}\n\n(draft_id: ${draftId})`;
    }
  } else if (cancelPattern.test(trimmedMessage)) {
    // 취소 패턴: draft_id가 없으면 자동 추출
    const draftId = extractLastDraftId(conversationHistory);
    if (draftId) {
      enhancedUserMessage = `${userMessage}\n\n(draft_id: ${draftId})`;
    }
  }

  const messages: AgentMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-6), // -10→-6 감소: 최근 3턴만 (응답 시간 최적화)
    { role: 'user', content: enhancedUserMessage },
  ];

  let iteration = 0;
  let finalResponse = '';
  const toolResults: Array<{ tool: string; success: boolean; result: any }> = [];
  let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  while (iteration < maxIterations) {
    iteration++;

    const response = await callOpenAIChat(
      context.openai_api_key,
      messages,
      AGENT_TOOLS,
      'auto'
    );

    if (response.usage) {
      totalUsage.prompt_tokens += response.usage.prompt_tokens;
      totalUsage.completion_tokens += response.usage.completion_tokens;
      totalUsage.total_tokens += response.usage.total_tokens;
    }

    if (!response.tool_calls || response.tool_calls.length === 0) {
      finalResponse = response.content;
      break;
    }

    // 프로덕션 최적화: 로깅 제거

    messages.push({
      role: 'assistant',
      content: response.content || '',
      tool_calls: response.tool_calls,
    });

    for (const toolCall of response.tool_calls) {
      const toolName = toolCall.function.name;
      let toolArgs: Record<string, any>;

      // P1-8: Tool args 파싱 오류 처리
      try {
        toolArgs = JSON.parse(toolCall.function.arguments);
      } catch (parseError) {
        console.error('[AgentEngine] Tool args 파싱 실패:', parseError);
        const errorResult = {
          success: false,
          error: `Tool 인자 파싱 실패: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        };

        toolResults.push({
          tool: toolName,
          success: false,
          result: null,
        });

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolName,
          content: JSON.stringify({ error: errorResult.error }),
        });
        continue;
      }

      const result = await executeTool(toolName, toolArgs, context);
      toolResults.push({
        tool: toolName,
        success: result.success,
        result: result.result,
      });

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolName,
        content: JSON.stringify(result.success ? result.result : { error: result.error }),
      });
    }
  }

  if (iteration >= maxIterations) {
    console.warn('[AgentEngine] 최대 반복 횟수 도달:', { iterations: maxIterations });
    finalResponse = finalResponse || '요청을 처리하는 중 문제가 발생했습니다. 다시 시도해주세요.';
  }

  // P2-11: 비용 계산 (표시용 추정치, MODEL_PRICING 상수 사용)
  const pricing = MODEL_PRICING['gpt-4o-mini'];
  const costUsd = (totalUsage.prompt_tokens * pricing.input + totalUsage.completion_tokens * pricing.output);
  const costKrw = costUsd * EXCHANGE_RATE_USD_TO_KRW;

  return {
    response: finalResponse,
    tool_results: toolResults.length > 0 ? toolResults : undefined,
    usage: {
      ...totalUsage,
      // P0-23: 비용은 추정치로 명시 (UI 표시 시 경고 필요)
      cost_estimate_usd: `$${costUsd.toFixed(6)}`,
      cost_estimate_krw: `₩${costKrw.toFixed(2)}`,
      model: 'gpt-4o-mini',
      pricing_note: '추정치 (정산용 아님)',
    },
  };
}

/**
 * ========================================
 * L2 실행 함수들
 * ========================================
 */

/**
 * confirm_action: 대기 중인 Draft 실행
 */
async function executeConfirmAction(
  args: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  const { draft_id } = args;

  try {
    // P0-1: draft_id 명시적 처리 + maybeSingle 안전성 개선
    let draft;
    let draftError;

    if (draft_id) {
      // draft_id가 있으면 maybeSingle() 사용 (0 or 1행 확정)
      const result = await context.supabase
        .from('chatops_drafts')
        .select('*')
        .eq('id', draft_id)
        .eq('tenant_id', requireTenantScope(context.tenant_id))
        .eq('session_id', context.session_id)
        .eq('status', DRAFT_STATUS.READY)
        .maybeSingle();

      draft = result.data;
      draftError = result.error;
    } else {
      // P0-21: draft_id가 없으면 Fail-Closed 강화 (최근 N분 이내만 허용)
      const RECENT_MINUTES = 5; // 최근 5분 이내 draft만 허용
      const recentThreshold = new Date(Date.now() - RECENT_MINUTES * 60 * 1000).toISOString();

      const result = await context.supabase
        .from('chatops_drafts')
        .select('*')
        .eq('tenant_id', requireTenantScope(context.tenant_id))
        .eq('session_id', context.session_id)
        .eq('status', DRAFT_STATUS.READY)
        .gte('updated_at', recentThreshold) // P0-21: 최근 N분 이내만
        .order('updated_at', { ascending: false })
        .limit(2); // P0-21: 2개 조회하여 중복 확인

      // P0-21: READY draft가 2개 이상이면 명시적 선택 요구
      if (Array.isArray(result.data) && result.data.length > 1) {
        const draftList = result.data.map((d: any) => ({
          draft_id: d.id,
          intent_key: d.intent_key,
          updated_at: d.updated_at,
        }));

        return {
          success: false,
          result: null,
          error: `실행 가능한 작업이 ${result.data.length}개 있습니다. draft_id를 명시해주세요.\n\n${draftList.map((d: any) => `- ${d.intent_key} (${d.draft_id})`).join('\n')}`,
        };
      }

      draft = Array.isArray(result.data) && result.data.length > 0 ? result.data[0] : null;
      draftError = result.error;
    }

    if (draftError) {
      console.error('[executeConfirmAction] Draft 조회 오류:', maskPII(draftError.message));
      return { success: false, result: null, error: draftError.message };
    }

    if (!draft) {
      return {
        success: false,
        result: null,
        error: draft_id
          ? `Draft ID를 찾을 수 없거나 실행 가능한 상태가 아닙니다.`
          : '실행할 작업이 없습니다. 먼저 작업을 요청해주세요.',
      };
    }

    // 프로덕션 최적화: 로깅 제거

    // Intent에 따라 실제 실행
    let executionResult;

    // P2-11: L2 실행 커버리지 완성
    if (draft.intent_key === 'student.exec.discharge') {
      executionResult = await executeDischarge(draft.draft_params, context);
    } else if (draft.intent_key === 'student.exec.register') {
      executionResult = await executeRegister(draft.draft_params, context);
    } else if (draft.intent_key === 'student.exec.pause') {
      executionResult = await executePause(draft.draft_params, context);
    } else if (draft.intent_key === 'student.exec.resume') {
      executionResult = await executeResume(draft.draft_params, context);
    } else if (draft.intent_key === 'student.exec.update') {
      executionResult = await executeUpdate(draft.draft_params, context);
    } else if (draft.intent_key === 'student.exec.update_contact') {
      executionResult = await executeUpdateContact(draft.draft_params, context);
    } else if (draft.intent_key === 'student.exec.change_class') {
      executionResult = await executeChangeClass(draft.draft_params, context);
    } else if (draft.intent_key === 'student.exec.merge') {
      executionResult = await executeMerge(draft.draft_params, context);
    } else if (draft.intent_key.startsWith('message.draft.')) {
      // P0-31: 초안(message.draft.*)은 실행 금지
      executionResult = {
        success: false,
        result: null,
        error: '초안은 실행할 수 없습니다. 먼저 메시지 발송으로 변환해주세요.',
      };
    } else if (draft.intent_key.startsWith('message.exec.')) {
      executionResult = await executeSendMessageAction(draft.draft_params, context);
    } else if (draft.intent_key.startsWith('attendance.exec.')) {
      executionResult = await executeAttendanceAction(draft.draft_params, context);
    } else if (draft.intent_key.startsWith('billing.exec.')) {
      executionResult = await executeBillingAction(draft.draft_params, context);
    } else {
      executionResult = {
        success: false,
        error: `지원하지 않는 Intent: ${draft.intent_key}`,
      };
    }

    // Draft 상태 업데이트
    if (executionResult.success) {
      // P0-26: Draft 업데이트 시 tenant 조건 추가 (방어적 코딩)
      await context.supabase
        .from('chatops_drafts')
        .update({ status: DRAFT_STATUS.EXECUTED })
        .eq('id', draft.id)
        .eq('tenant_id', requireTenantScope(context.tenant_id));
    } else {
      // P0-30: 실패 분기에도 tenant 조건 추가 (크로스 테넌트 오염 방지)
      await context.supabase
        .from('chatops_drafts')
        .update({ status: DRAFT_STATUS.FAILED })
        .eq('id', draft.id)
        .eq('tenant_id', requireTenantScope(context.tenant_id));
    }

    return executionResult;
  } catch (error: any) {
    console.error('[executeConfirmAction] 오류:', error);
    return {
      success: false,
      result: null,
      error: error.message || '작업 실행 중 오류가 발생했습니다',
    };
  }
}

/**
 * cancel_action: 대기 중인 Draft 취소
 */
async function executeCancelAction(
  args: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  const { draft_id } = args;

  try {
    // P0-1: draft_id 명시적 처리 + maybeSingle 안전성 개선
    let draft;
    let draftError;

    if (draft_id) {
      // draft_id가 있으면 maybeSingle() 사용 (0 or 1행 확정)
      const result = await context.supabase
        .from('chatops_drafts')
        .select('*')
        .eq('id', draft_id)
        .eq('tenant_id', requireTenantScope(context.tenant_id))
        .eq('session_id', context.session_id)
        .eq('status', DRAFT_STATUS.READY)
        .maybeSingle();

      draft = result.data;
      draftError = result.error;
    } else {
      // P0-21: draft_id가 없으면 Fail-Closed 강화 (최근 N분 이내만 허용)
      const RECENT_MINUTES = 5; // 최근 5분 이내 draft만 허용
      const recentThreshold = new Date(Date.now() - RECENT_MINUTES * 60 * 1000).toISOString();

      const result = await context.supabase
        .from('chatops_drafts')
        .select('*')
        .eq('tenant_id', requireTenantScope(context.tenant_id))
        .eq('session_id', context.session_id)
        .eq('status', DRAFT_STATUS.READY)
        .gte('updated_at', recentThreshold) // P0-21: 최근 N분 이내만
        .order('updated_at', { ascending: false })
        .limit(2); // P0-21: 2개 조회하여 중복 확인

      // P0-21: READY draft가 2개 이상이면 명시적 선택 요구
      if (Array.isArray(result.data) && result.data.length > 1) {
        const draftList = result.data.map((d: any) => ({
          draft_id: d.id,
          intent_key: d.intent_key,
          updated_at: d.updated_at,
        }));

        return {
          success: false,
          result: null,
          error: `취소 가능한 작업이 ${result.data.length}개 있습니다. draft_id를 명시해주세요.\n\n${draftList.map((d: any) => `- ${d.intent_key} (${d.draft_id})`).join('\n')}`,
        };
      }

      draft = Array.isArray(result.data) && result.data.length > 0 ? result.data[0] : null;
      draftError = result.error;
    }

    if (draftError) {
      console.error('[executeCancelAction] Draft 조회 오류:', maskPII(draftError.message));
      return { success: false, result: null, error: draftError.message };
    }

    if (!draft) {
      return {
        success: false,
        result: null,
        error: draft_id
          ? `Draft ID를 찾을 수 없거나 취소 가능한 상태가 아닙니다.`
          : '취소할 작업이 없습니다.',
      };
    }

    // P0-26: Draft 취소 시 tenant 조건 추가 (방어적 코딩)
    await context.supabase
      .from('chatops_drafts')
      .update({ status: DRAFT_STATUS.CANCELLED })
      .eq('id', draft.id)
      .eq('tenant_id', requireTenantScope(context.tenant_id));

    return {
      success: true,
      result: {
        message: '작업이 취소되었습니다.',
        cancelled_intent: draft.intent_key,
      },
    };
  } catch (error: any) {
    console.error('[executeCancelAction] 오류:', error);
    return {
      success: false,
      result: null,
      error: error.message || '작업 취소 중 오류가 발생했습니다',
    };
  }
}

/**
 * 학생 퇴원 처리
 */
async function executeDischarge(
  params: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  const { student_name, student_id, date, reason } = params;

  // P0-25: L2 실행 함수 필수값 재검증 (Fail-Closed)
  if (!student_name && !student_id) {
    return {
      success: false,
      result: null,
      error: '학생 이름 또는 ID는 필수입니다.',
    };
  }

  if (!date || typeof date !== 'string' || date.trim() === '') {
    return {
      success: false,
      result: null,
      error: '퇴원 날짜는 필수입니다.',
    };
  }

  // 프로덕션 최적화: 로깅 제거

  try {
    // P2 이슈 해결: 공통 헬퍼 함수 사용
    const resolveResult = await resolvePersonId(student_name, student_id, context);
    if (!resolveResult.success) {
      return {
        success: false,
        result: null,
        error: resolveResult.error,
      };
    }
    const personId = resolveResult.person_id!;

    // P1 이슈 해결: toKSTDate 사용
    const effectiveDate = date || toKSTDate();

    // P2-8: 캐시된 테이블명 조회
    const studentTable = await getCachedTableName(context, 'student');
    if (!studentTable) {
      return { success: false, result: null, error: '업종별 학생 테이블을 찾을 수 없습니다.' };
    }

    // 상태 변경
    const { error: updateError } = await context.supabase
      .from(studentTable)
      .update({
        status: STUDENT_STATUS.WITHDRAWN,
        updated_at: toKSTISOString(),
        updated_by: context.user_id,
      })
      .eq('person_id', personId)
      .eq('tenant_id', requireTenantScope(context.tenant_id));

    if (updateError) {
      console.error('[executeDischarge] 상태 변경 오류:', maskPII(updateError.message));
      return { success: false, result: null, error: updateError.message };
    }

    // 퇴원 기록 저장 (student_status_history 테이블이 있다면)
    try {
      await context.supabase
        .from('student_status_history')
        .insert({
          tenant_id: requireTenantScope(context.tenant_id),
          person_id: personId,
          status: STUDENT_STATUS.WITHDRAWN,
          reason: reason || '퇴원',
          effective_date: effectiveDate,
          created_by: context.user_id,
        });
    } catch (historyError) {
      // 히스토리 테이블이 없어도 계속 진행
      console.warn('[executeDischarge] 히스토리 저장 실패 (테이블 없음?):', historyError);
    }

    // P1 이슈 해결: 에러 메시지 PII 제거
    return {
      success: true,
      result: {
        message: `퇴원 처리가 완료되었습니다.`,
        person_id: maskPII(personId),
        date: effectiveDate,
      },
    };
  } catch (error: any) {
    console.error('[executeDischarge] 오류:', maskPII(error.message));
    return {
      success: false,
      result: null,
      error: error.message || '퇴원 처리 중 오류가 발생했습니다',
    };
  }
}

/**
 * 학생 등록 (P0-14: DB RPC 트랜잭션 사용)
 *
 * [트랜잭션 보장]
 * - DB RPC 함수 `register_student` 사용으로 원자성 보장
 * - 수동 롤백 제거 (persons + academy_students 동시 커밋/롤백)
 *
 * [검증]
 * - P0-25: 필수값 재검증 (Fail-Closed)
 * - P0-24: 중복 체크는 RPC 내부에서 수행
 */
async function executeRegister(
  params: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  const {
    name,
    student_name,  // name 또는 student_name 둘 다 허용
    phone,
    guardian_phone,
    class_name,
    birth_date,
    address,
    email,
    grade,
    school_name,
  } = params;

  // name과 student_name 둘 다 허용 (Tool에서 student_name으로 전달될 수 있음)
  const finalName = name || student_name;

  // P0-25: L2 실행 함수 필수값 재검증 (Fail-Closed)
  // Draft는 UX용, Execution은 항상 서버에서 재검증
  if (!finalName || typeof finalName !== 'string' || finalName.trim() === '') {
    return {
      success: false,
      result: null,
      error: '학생 이름은 필수입니다.',
    };
  }

  if (!phone || typeof phone !== 'string' || phone.trim() === '') {
    return {
      success: false,
      result: null,
      error: '전화번호는 필수입니다.',
    };
  }

  if (!birth_date || typeof birth_date !== 'string' || birth_date.trim() === '') {
    return {
      success: false,
      result: null,
      error: '생년월일은 필수입니다.',
    };
  }

  try {
    // P0-14: DB RPC 함수 호출로 트랜잭션 보장 (수동 롤백 제거)
    const { data, error: rpcError } = await context.supabase
      .rpc('register_student', {
        p_tenant_id: requireTenantScope(context.tenant_id),
        p_name: finalName,
        p_phone: phone,
        p_birth_date: birth_date,
        p_email: email || null,
        p_address: address || null,
        p_class_name: class_name || null,
        p_grade: grade || null,
        p_school_name: school_name || null,
        p_created_by: context.user_id,
      })
      .single();

    if (rpcError) {
      console.error('[executeRegister] RPC 오류:', maskPII(rpcError.message));
      return { success: false, result: null, error: rpcError.message };
    }

    // RPC 결과 검증
    if (!data || !data.success) {
      return {
        success: false,
        result: null,
        error: data?.error_message || '학생 등록에 실패했습니다.',
      };
    }

    const personId = data.person_id;

    // 보호자 정보가 있으면 저장 (병렬 처리 - 실패해도 계속 진행)
    if (guardian_phone) {
      // 보호자 정보 저장은 비동기로 처리하되 결과를 기다리지 않음 (성능 최적화)
      context.supabase
        .from('guardians')
        .insert({
          tenant_id: requireTenantScope(context.tenant_id),
          student_id: personId,
          phone: guardian_phone,
          relationship: 'parent',
        })
        .then(({ error }) => {
          if (error) {
            console.warn('[executeRegister] 보호자 정보 저장 실패:', error);
          }
        })
        .catch((guardianError) => {
          console.warn('[executeRegister] 보호자 정보 저장 실패:', guardianError);
        });
    }

    return {
      success: true,
      result: {
        message: `학생이 등록되었습니다.`,
        student_id: maskPII(personId),
        class_name: maskPII(class_name),
      },
    };
  } catch (error: any) {
    console.error('[executeRegister] 오류:', maskPII(error.message));
    return {
      success: false,
      result: null,
      error: error.message || '학생 등록 중 오류가 발생했습니다',
    };
  }
}

/**
 * 학생 휴원 처리
 */
async function executePause(
  params: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  const { student_name, student_id, date, reason } = params;

  // P0-25: L2 실행 함수 필수값 재검증 (Fail-Closed)
  if (!student_name && !student_id) {
    return {
      success: false,
      result: null,
      error: '학생 이름 또는 ID는 필수입니다.',
    };
  }

  if (!date || typeof date !== 'string' || date.trim() === '') {
    return {
      success: false,
      result: null,
      error: '휴원 날짜는 필수입니다.',
    };
  }

  // 프로덕션 최적화: 로깅 제거

  try {
    // P0-2: resolvePersonId에 phone/birth_date 힌트 전달
    const resolveResult = await resolvePersonId(
      student_name,
      student_id,
      context,
      params.phone,        // 전화번호 힌트
      params.birth_date    // 생년월일 힌트
    );
    if (!resolveResult.success) {
      return {
        success: false,
        result: null,
        error: resolveResult.error,
      };
    }
    const personId = resolveResult.person_id!;

    // P2-8: 캐시된 테이블명 조회
    const studentTable = await getCachedTableName(context, 'student');
    if (!studentTable) {
      return { success: false, result: null, error: '업종별 학생 테이블을 찾을 수 없습니다.' };
    }

    // 상태 변경
    const { error } = await context.supabase
      .from(studentTable)
      .update({
        status: STUDENT_STATUS.ON_LEAVE,
        updated_at: toKSTISOString(),
        updated_by: context.user_id,
      })
      .eq('person_id', personId)
      .eq('tenant_id', requireTenantScope(context.tenant_id));

    if (error) {
      console.error('[executePause] 상태 변경 오류:', maskPII(error.message));
      return { success: false, result: null, error: error.message };
    }

    // P1 이슈 해결: 에러 메시지 PII 제거
    return {
      success: true,
      result: {
        message: `휴원 처리가 완료되었습니다.`,
        person_id: maskPII(personId),
      },
    };
  } catch (error: any) {
    console.error('[executePause] 오류:', maskPII(error.message));
    return {
      success: false,
      result: null,
      error: error.message || '휴원 처리 중 오류가 발생했습니다',
    };
  }
}

/**
 * 학생 복귀 처리
 */
async function executeResume(
  params: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  const { student_name, student_id } = params;

  // 프로덕션 최적화: 로깅 제거

  try {
    // P0-2: resolvePersonId에 phone/birth_date 힌트 전달
    const resolveResult = await resolvePersonId(
      student_name,
      student_id,
      context,
      params.phone,        // 전화번호 힌트
      params.birth_date    // 생년월일 힌트
    );
    if (!resolveResult.success) {
      return {
        success: false,
        result: null,
        error: resolveResult.error,
      };
    }
    const personId = resolveResult.person_id!;

    // P2-8: 캐시된 테이블명 조회
    const studentTable = await getCachedTableName(context, 'student');
    if (!studentTable) {
      return { success: false, result: null, error: '업종별 학생 테이블을 찾을 수 없습니다.' };
    }

    // 상태 변경
    const { error } = await context.supabase
      .from(studentTable)
      .update({
        status: STUDENT_STATUS.ACTIVE,
        updated_at: toKSTISOString(),
        updated_by: context.user_id,
      })
      .eq('person_id', personId)
      .eq('tenant_id', requireTenantScope(context.tenant_id));

    if (error) {
      console.error('[executeResume] 상태 변경 오류:', maskPII(error.message));
      return { success: false, result: null, error: error.message };
    }

    // P1 이슈 해결: 에러 메시지 PII 제거
    return {
      success: true,
      result: {
        message: `복귀 처리가 완료되었습니다.`,
        person_id: maskPII(personId),
      },
    };
  } catch (error: any) {
    console.error('[executeResume] 오류:', maskPII(error.message));
    return {
      success: false,
      result: null,
      error: error.message || '복귀 처리 중 오류가 발생했습니다',
    };
  }
}

/**
 * P2-11: 학생 정보 수정
 */
async function executeUpdate(
  params: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  const { student_name, student_id, ...updateFields } = params;

  try {
    // P0-2: resolvePersonId에 phone/birth_date 힌트 전달
    const resolveResult = await resolvePersonId(
      student_name,
      student_id,
      context,
      params.phone,        // 전화번호 힌트
      params.birth_date    // 생년월일 힌트
    );
    if (!resolveResult.success) {
      return {
        success: false,
        result: null,
        error: resolveResult.error,
      };
    }
    const personId = resolveResult.person_id!;

    // P2-8: 캐시된 테이블명 조회
    const studentTable = await getCachedTableName(context, 'student');
    if (!studentTable) {
      return { success: false, result: null, error: '업종별 학생 테이블을 찾을 수 없습니다.' };
    }

    // 학생 정보 업데이트
    const studentFields: Record<string, any> = {};
    if (params.grade) studentFields.grade = params.grade;
    if (params.school_name) studentFields.school_name = params.school_name;
    if (params.class_name) studentFields.class_name = params.class_name;

    if (Object.keys(studentFields).length > 0) {
      studentFields.updated_at = toKSTISOString();
      studentFields.updated_by = context.user_id;

      const { error } = await context.supabase
        .from(studentTable)
        .update(studentFields)
        .eq('person_id', personId)
        .eq('tenant_id', requireTenantScope(context.tenant_id));

      if (error) {
        console.error('[executeUpdate] 학생 정보 업데이트 오류:', maskPII(error.message));
        return { success: false, result: null, error: error.message };
      }
    }

    // persons 정보 업데이트
    const personFields: Record<string, any> = {};
    if (params.address) personFields.address = params.address;
    if (params.email) personFields.email = params.email;

    if (Object.keys(personFields).length > 0) {
      const { error } = await context.supabase
        .from('persons')
        .update(personFields)
        .eq('id', personId)
        .eq('tenant_id', requireTenantScope(context.tenant_id));

      if (error) {
        console.error('[executeUpdate] 개인 정보 업데이트 오류:', maskPII(error.message));
        return { success: false, result: null, error: error.message };
      }
    }

    return {
      success: true,
      result: {
        message: `학생 정보가 수정되었습니다.`,
        person_id: maskPII(personId),
      },
    };
  } catch (error: any) {
    console.error('[executeUpdate] 오류:', maskPII(error.message));
    return {
      success: false,
      result: null,
      error: error.message || '학생 정보 수정 중 오류가 발생했습니다',
    };
  }
}

/**
 * P2-11: 학생 연락처 수정
 */
async function executeUpdateContact(
  params: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  const { student_name, student_id, phone, guardian_phone } = params;

  try {
    // P0-2: resolvePersonId에 phone/birth_date 힌트 전달
    const resolveResult = await resolvePersonId(
      student_name,
      student_id,
      context,
      phone,               // 전화번호 힌트
      params.birth_date    // 생년월일 힌트
    );
    if (!resolveResult.success) {
      return {
        success: false,
        result: null,
        error: resolveResult.error,
      };
    }
    const personId = resolveResult.person_id!;

    // 학생 전화번호 업데이트
    if (phone) {
      const { error } = await context.supabase
        .from('persons')
        .update({ phone: phone })
        .eq('id', personId)
        .eq('tenant_id', requireTenantScope(context.tenant_id));

      if (error) {
        console.error('[executeUpdateContact] 전화번호 업데이트 오류:', maskPII(error.message));
        return { success: false, result: null, error: error.message };
      }
    }

    // 보호자 전화번호 업데이트
    if (guardian_phone) {
      // 기존 보호자 정보 업데이트 또는 생성
      const { data: existingGuardian } = await context.supabase
        .from('guardians')
        .select('id')
        .eq('tenant_id', requireTenantScope(context.tenant_id))
        .eq('student_id', personId)
        .limit(1)
        .maybeSingle();

      if (existingGuardian) {
        await context.supabase
          .from('guardians')
          .update({ phone: guardian_phone })
          .eq('id', existingGuardian.id);
      } else {
        await context.supabase
          .from('guardians')
          .insert({
            tenant_id: requireTenantScope(context.tenant_id),
            student_id: personId,
            phone: guardian_phone,
            relationship: 'parent',
          });
      }
    }

    return {
      success: true,
      result: {
        message: `연락처가 수정되었습니다.`,
        person_id: maskPII(personId),
      },
    };
  } catch (error: any) {
    console.error('[executeUpdateContact] 오류:', maskPII(error.message));
    return {
      success: false,
      result: null,
      error: error.message || '연락처 수정 중 오류가 발생했습니다',
    };
  }
}

/**
 * P2-11: 학생 반 변경
 */
async function executeChangeClass(
  params: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  const { student_name, student_id, class_name } = params;

  try {
    // P0-2: resolvePersonId에 phone/birth_date 힌트 전달
    const resolveResult = await resolvePersonId(
      student_name,
      student_id,
      context,
      params.phone,        // 전화번호 힌트
      params.birth_date    // 생년월일 힌트
    );
    if (!resolveResult.success) {
      return {
        success: false,
        result: null,
        error: resolveResult.error,
      };
    }
    const personId = resolveResult.person_id!;

    // P2-8: 캐시된 테이블명 조회
    const studentTable = await getCachedTableName(context, 'student');
    if (!studentTable) {
      return { success: false, result: null, error: '업종별 학생 테이블을 찾을 수 없습니다.' };
    }

    const { error } = await context.supabase
      .from(studentTable)
      .update({
        class_name: class_name,
        updated_at: toKSTISOString(),
        updated_by: context.user_id,
      })
      .eq('person_id', personId)
      .eq('tenant_id', requireTenantScope(context.tenant_id));

    if (error) {
      console.error('[executeChangeClass] 반 변경 오류:', maskPII(error.message));
      return { success: false, result: null, error: error.message };
    }

    return {
      success: true,
      result: {
        message: `반이 변경되었습니다.`,
        person_id: maskPII(personId),
        class_name: maskPII(class_name),
      },
    };
  } catch (error: any) {
    console.error('[executeChangeClass] 오류:', maskPII(error.message));
    return {
      success: false,
      result: null,
      error: error.message || '반 변경 중 오류가 발생했습니다',
    };
  }
}

/**
 * P2-11: 학생 중복 병합
 */
async function executeMerge(
  params: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  // 중복 병합은 복잡한 로직이므로 기본 구조만 구현
  return {
    success: false,
    result: null,
    error: '학생 중복 병합 기능은 현재 개발 중입니다.',
  };
}

/**
 * P2-11: 출결 관리 액션 실행
 */
async function executeAttendanceAction(
  params: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  // 출결 관리 액션은 복잡한 로직이므로 기본 구조만 구현
  return {
    success: false,
    result: null,
    error: '출결 관리 기능은 현재 개발 중입니다.',
  };
}

/**
 * P2-11: 수납 관리 액션 실행
 */
async function executeBillingAction(
  params: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  // 수납 관리 액션은 복잡한 로직이므로 기본 구조만 구현
  return {
    success: false,
    result: null,
    error: '수납 관리 기능은 현재 개발 중입니다.',
  };
}

/**
 * 문자 발송
 */
async function executeSendMessageAction(
  params: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  const { type, recipient, recipients, message, schedule_time } = params;

  // 프로덕션 최적화: 로깅 제거

  try {
    // P0-40: recipient 정보를 execution_context에 저장 (스키마 안전성)
    // message_logs 테이블에 recipient_info 컬럼이 없을 수 있으므로 execution_context 사용
    const messageLog: any = {
      tenant_id: requireTenantScope(context.tenant_id),
      message_type: type,
      content: message,
      status: MESSAGE_STATUS.PENDING,
      created_by: context.user_id,
      scheduled_at: schedule_time,
      // P0-40: execution_context에 recipient 정보 저장 (감사/재발송용)
      execution_context: {
        type: type,
        recipient: recipient || null,
        recipients: recipients || [],
        recipient_count: recipients?.length || (recipient ? 1 : 0),
        executed_at: new Date().toISOString(),
      },
    };

    const { data: log, error: logError } = await context.supabase
      .from('message_logs')
      .insert(messageLog)
      .select()
      .single();

    if (logError) {
      console.error('[executeSendMessageAction] 로그 저장 오류:', maskPII(logError.message));
      return { success: false, result: null, error: logError.message };
    }

    // P0-32: 실제 발송 API 구현 전까지 PENDING 상태 유지
    // TODO: 실제 문자 발송 API 호출 (알림톡/SMS)
    // const sendResult = await sendSMS({ to: recipient, message: message });
    // if (!sendResult.success) {
    //   await context.supabase
    //     .from('message_logs')
    //     .update({ status: MESSAGE_STATUS.FAILED, error_message: sendResult.error })
    //     .eq('id', log.id)
    //     .eq('tenant_id', requireTenantScope(context.tenant_id));
    //   return { success: false, result: null, error: sendResult.error };
    // }

    // P0-37: 예약 메시지는 SCHEDULED 상태로 (실제 발송 시각에 워커가 처리)
    if (type === 'scheduled' && schedule_time) {
      await context.supabase
        .from('message_logs')
        .update({ status: MESSAGE_STATUS.SCHEDULED })  // P0-37: SSOT 사용
        .eq('id', log.id)
        .eq('tenant_id', requireTenantScope(context.tenant_id));

      return {
        success: true,
        result: {
          message: `메시지가 ${schedule_time}에 발송 예약되었습니다.`,
          log_id: maskPII(log.id),
          recipient_count: recipients?.length || 1,
          status: MESSAGE_STATUS.SCHEDULED,
        },
      };
    }

    // P0-32: 즉시 발송은 실제 API 구현 전까지 PENDING 유지
    // 운영 환경에서는 실제 발송 성공 후에만 SENT로 변경
    console.warn('[executeSendMessageAction] 실제 발송 API 미구현 - PENDING 상태 유지');

    return {
      success: true,
      result: {
        message: `메시지 발송이 준비되었습니다. (실제 발송 API 구현 필요)`,
        log_id: maskPII(log.id),
        recipient_count: recipients?.length || 1,
        status: 'pending',
      },
    };
  } catch (error: any) {
    console.error('[executeSendMessageAction] 오류:', maskPII(error.message));
    return {
      success: false,
      result: null,
      error: error.message || '메시지 발송 중 오류가 발생했습니다',
    };
  }
}
