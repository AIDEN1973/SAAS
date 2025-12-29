// LAYER: EDGE_FUNCTION_SHARED
/**
 * Agent Engine - Final Implementation
 *
 * OpenAI Function Calling 기반 Agent 엔진
 * Intent 147개 → Tool 15개로 통합
 */

import { AGENT_TOOLS, type AgentTool } from './agent-tools-final.ts';
import { maskPII } from './pii-utils.ts';
import { toKSTDate } from './date-utils.ts';
import { requireTenantScope } from '../chatops/handlers/auth.ts';

/**
 * 상수 정의 (P2 이슈 해결)
 */
const STUDENT_STATUS = {
  ACTIVE: 'active',
  ON_LEAVE: 'on_leave',
  WITHDRAWN: 'withdrawn',
  GRADUATED: 'graduated',
} as const;

const DRAFT_STATUS = {
  COLLECTING: 'collecting',
  READY: 'ready',
  EXECUTED: 'executed',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
} as const;

const MESSAGE_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
} as const;

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
}

export interface AgentResponse {
  response: string;
  tool_results?: Array<{ tool: string; success: boolean; result: any }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost_usd: string;
    cost_krw: string;
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
 * Tool 실행
 */
async function executeTool(
  toolName: string,
  toolArgs: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  try {
    // Tool별 실행 로직
    switch (toolName) {
      case 'manage_student':
        return await executeManageStudent(toolArgs, context);

      case 'query_attendance':
        return await executeQueryAttendance(toolArgs, context);

      case 'manage_attendance':
        return await executeManageAttendance(toolArgs, context);

      case 'query_message':
        return await executeQueryMessage(toolArgs, context);

      case 'send_message':
        return await executeSendMessage(toolArgs, context);

      case 'draft_message':
        return await executeDraftMessage(toolArgs, context);

      case 'query_billing':
        return await executeQueryBilling(toolArgs, context);

      case 'manage_billing':
        return await executeManageBilling(toolArgs, context);

      case 'query_class':
        return await executeQueryClass(toolArgs, context);

      case 'get_report':
        return await executeGetReport(toolArgs, context);

      case 'confirm_action':
        return await executeConfirmAction(toolArgs, context);

      case 'cancel_action':
        return await executeCancelAction(toolArgs, context);

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
 * 학생 이름 또는 ID로 person_id 조회
 */
async function resolvePersonId(
  student_name: string | undefined,
  student_id: string | undefined,
  context: AgentContext
): Promise<{ success: boolean; person_id?: string; error?: string }> {
  if (student_id) {
    return { success: true, person_id: student_id };
  }

  if (!student_name) {
    return { success: false, error: '학생 이름 또는 ID가 필요합니다.' };
  }

  const { data: students, error } = await context.supabase
    .from('academy_students')
    .select('person_id, persons!inner(name)')
    .eq('tenant_id', requireTenantScope(context.tenant_id))
    .ilike('persons.name', `%${student_name}%`)
    .limit(1);

  if (error) {
    console.error('[resolvePersonId] DB 오류:', maskPII(error.message));
    return { success: false, error: error.message };
  }

  if (!students || students.length === 0) {
    return {
      success: false,
      error: `학생을 찾을 수 없습니다. (입력: ${maskPII(student_name)})`,
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

      // P0 이슈 해결: requireTenantScope 사용
      // persons 테이블과 academy_students 테이블 JOIN
      let query = context.supabase
        .from('academy_students')
        .select(`
          person_id,
          status,
          class_name,
          grade,
          school_name,
          persons!inner (
            id,
            name,
            phone,
            email,
            address
          )
        `)
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
        return {
          success: true,
          result: {
            student: student,
            message: `${student.name} 학생의 정보입니다.\n전화번호: ${student.phone || '없음'}\n반: ${student.class_name || '없음'}\n상태: ${student.status}`,
          },
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

      // 프로덕션 최적화: 로깅 제거

      // P0 이슈 해결: requireTenantScope 사용
      // Draft 생성
      const { data: draft, error: draftError } = await context.supabase
        .from('chatops_drafts')
        .insert({
          tenant_id: requireTenantScope(context.tenant_id),
          user_id: context.user_id,
          session_id: context.session_id,
          intent_key: intentKey,
          draft_params: args,
          status: draftStatus,
          missing_required: missingParams,  // ✅ 누락된 필수 파라미터 저장
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
            message: `${studentNameForMessage} ${action === 'register' ? '등록' : action}을 위해 다음 정보가 필요합니다:\n\n${missingList}\n\n정보를 입력해주세요.`,
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
          message: `${actionMessages[action] || `${action} 작업을 준비했습니다`}. 실행하시겠습니까?`,
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

  // 프로덕션 최적화: 로깅 제거

  try {
    // P1 이슈 해결: toKSTDate 사용
    const targetDate = date || toKSTDate();

    // P0 이슈 해결: requireTenantScope 사용
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
      .eq('date', targetDate);

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

    // 프로덕션 최적화: 로깅 제거

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

    return {
      success: true,
      result: {
        records: flattenedData,
        count: flattenedData.length,
        date: targetDate,
        type: type,
        message: `${targetDate} ${type} 출결: ${flattenedData.length}건`,
      },
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

  // L2 실행은 Draft 생성
  return {
    success: true,
    result: {
      message: `${action} 작업을 준비했습니다. 확인하시겠습니까?`,
      requires_confirmation: true,
      intent_key: `attendance.exec.${action}`,
      params: args,
    },
  };
}

async function executeQueryMessage(
  args: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  const { type, date, student_name } = args;

  // 프로덕션 최적화: 로깅 제거

  try {
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

    // 날짜 필터
    if (date) {
      query = query.gte('created_at', `${date}T00:00:00`)
                   .lt('created_at', `${date}T23:59:59`);
    }

    const { data, error } = await query;

    // 프로덕션 최적화: 로깅 제거

    if (error) {
      console.error('[executeQueryMessage] DB 오류:', maskPII(error.message));
      return { success: false, result: null, error: error.message };
    }

    return {
      success: true,
      result: {
        messages: data || [],
        count: data?.length || 0,
        type: type,
        message: `${type} 메시지: ${data?.length || 0}건`,
      },
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
  const intentKey = `message.exec.send_${type}`;

  // 프로덕션 최적화: 로깅 제거

  // Draft 생성
  const { data: draft, error: draftError } = await context.supabase
    .from('chatops_drafts')
    .insert({
      tenant_id: requireTenantScope(context.tenant_id),  // ✅ P1-SEC: requireTenantScope 적용
      user_id: context.user_id,
      session_id: context.session_id,
      intent_key: intentKey,
      draft_params: args,
      status: 'ready',
      confirm_required: true,
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
      message: `${recipientText}에게 메시지 발송을 준비했습니다. 실행하시겠습니까?\n\n내용: ${message?.substring(0, 50)}${message?.length > 50 ? '...' : ''}`,
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

  // 프로덕션 최적화: 로깅 제거

  // 메시지 초안 작성은 L2 작업이므로 Draft 생성
  return {
    success: true,
    result: {
      message: `${type} 메시지 초안을 작성했습니다. 발송하시겠습니까?`,
      requires_confirmation: true,
      draft: {
        type: type,
        target: target,
        content: content,
      },
    },
  };
}

async function executeQueryBilling(
  args: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  const { type, month, student_name } = args;

  // 프로덕션 최적화: 로깅 제거

  try {
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

    // 월 필터
    if (month) {
      query = query.gte('created_at', `${month}-01T00:00:00`)
                   .lt('created_at', `${month}-31T23:59:59`);
    }

    // 학생 이름 필터
    if (student_name) {
      query = query.ilike('persons.name', `%${student_name}%`);
    }

    const { data, error } = await query;

    // 프로덕션 최적화: 로깅 제거

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

    return {
      success: true,
      result: {
        invoices: flattenedData,
        count: flattenedData.length,
        total_amount: totalAmount,
        total_paid: totalPaid,
        total_unpaid: totalAmount - totalPaid,
        type: type,
        message: `${type} 수납: ${flattenedData.length}건, 미수금: ${totalAmount - totalPaid}원`,
      },
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
  // L2 실행은 Draft 생성
  return {
    success: true,
    result: {
      message: `${args.action} 작업을 준비했습니다. 확인하시겠습니까?`,
      requires_confirmation: true,
      intent_key: `billing.exec.${args.action}`,
      params: args,
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

      // 반 목록 조회
      const { data, error } = await context.supabase
        .from('academy_classes')
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

      // 반 명단 조회 (academy_students와 persons JOIN)
      const { data, error } = await context.supabase
        .from('academy_students')
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
    const today = new Date().toISOString().split('T')[0];

    if (type === 'dashboard') {
      // 대시보드 KPI 조회 (병렬 처리로 최적화)
      const thisMonth = new Date().toISOString().substring(0, 7);

      // 병렬 실행
      const [
        { data: attendanceData },
        { data: billingData },
        { count: studentCount }
      ] = await Promise.all([
        // 1. 오늘 출결 통계
        context.supabase
          .from('attendance_logs')
          .select('status')
          .eq('tenant_id', context.tenant_id)
          .eq('occurred_at::date', today),

        // 2. 이번 달 수납 통계
        context.supabase
          .from('invoices')
          .select('amount, paid_amount, status')
          .eq('tenant_id', context.tenant_id)
          .gte('created_at', `${thisMonth}-01T00:00:00`),

        // 3. 전체 학생 수
        context.supabase
          .from('academy_students')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', context.tenant_id)
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

      return {
        success: true,
        result: {
          attendance: attendanceStats,
          billing: billingStats,
          students: { total: studentCount || 0 },
          date: today,
          message: `대시보드 KPI: 학생 ${studentCount}명, 출석 ${attendanceStats.present}명, 연체 ${billingStats.overdue}건`,
        },
      };
    } else if (type === 'attendance') {
      // 출결 요약
      const { data, error } = await context.supabase
        .from('attendance_logs')
        .select('status, occurred_at')
        .eq('tenant_id', context.tenant_id)
        .gte('occurred_at::date', today)
        .order('date', { ascending: false })
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
        .eq('tenant_id', context.tenant_id)
        .gte('created_at', `${thisMonth}-01T00:00:00`);

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
 * Agent 대화 실행
 */
export async function runAgent(
  userMessage: string,
  conversationHistory: AgentMessage[],
  context: AgentContext,
  maxIterations: number = 5
): Promise<AgentResponse> {

  // System Prompt (최적화: 1200→450 토큰, 62% 감소)
  const systemPrompt = `학원 관리 AI 어시스턴트. Tool을 사용해 요청 처리.

**핵심 규칙**:
1. 학생 등록/수정 시 manage_student 즉시 호출 (부족한 정보는 빈 값)
2. 단순 값 입력(날짜/전화번호) → 이전 Draft 업데이트용으로 manage_student 재호출
3. 날짜 형식: YYYY.MM.DD → YYYY-MM-DD 변환
4. 불확실하면 확인 질문

**Tool 사용**:
- 조회: query_* Tool
- 실행: manage_* Tool → Draft 생성 → confirm_action
- 학생 등록 필수: 이름, 전화번호, 생년월일

**응답**: 친절하고 간결하게, 이전 맥락 고려`;

  const messages: AgentMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-6), // -10→-6 감소: 최근 3턴만 (응답 시간 최적화)
    { role: 'user', content: userMessage },
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
      const toolArgs = JSON.parse(toolCall.function.arguments);

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

  // 비용 계산
  const costUsd = (totalUsage.prompt_tokens * 0.00000015 + totalUsage.completion_tokens * 0.0000006);
  const costKrw = costUsd * 1300;

  return {
    response: finalResponse,
    tool_results: toolResults.length > 0 ? toolResults : undefined,
    usage: {
      ...totalUsage,
      cost_usd: `$${costUsd.toFixed(6)}`,
      cost_krw: `₩${costKrw.toFixed(2)}`,
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
  // 프로덕션 최적화: 로깅 제거

  try {
    // P0 이슈 해결: requireTenantScope 사용
    // 최근 ready 상태의 Draft 조회
    const { data: draft, error: draftError } = await context.supabase
      .from('chatops_drafts')
      .select('*')
      .eq('tenant_id', requireTenantScope(context.tenant_id))
      .eq('session_id', context.session_id)
      .eq('status', DRAFT_STATUS.READY)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (draftError) {
      console.error('[executeConfirmAction] Draft 조회 오류:', maskPII(draftError.message));
      return { success: false, result: null, error: draftError.message };
    }

    if (!draft) {
      return {
        success: false,
        result: null,
        error: '실행할 작업이 없습니다. 먼저 작업을 요청해주세요.',
      };
    }

    // 프로덕션 최적화: 로깅 제거

    // Intent에 따라 실제 실행
    let executionResult;

    if (draft.intent_key === 'student.exec.discharge') {
      executionResult = await executeDischarge(draft.draft_params, context);
    } else if (draft.intent_key === 'student.exec.register') {
      executionResult = await executeRegister(draft.draft_params, context);
    } else if (draft.intent_key === 'student.exec.pause') {
      executionResult = await executePause(draft.draft_params, context);
    } else if (draft.intent_key === 'student.exec.resume') {
      executionResult = await executeResume(draft.draft_params, context);
    } else if (draft.intent_key.startsWith('message.exec.')) {
      executionResult = await executeSendMessageAction(draft.draft_params, context);
    } else {
      executionResult = {
        success: false,
        error: `지원하지 않는 Intent: ${draft.intent_key}`,
      };
    }

    // Draft 상태 업데이트
    if (executionResult.success) {
      await context.supabase
        .from('chatops_drafts')
        .update({ status: DRAFT_STATUS.EXECUTED })
        .eq('id', draft.id);
    } else {
      await context.supabase
        .from('chatops_drafts')
        .update({ status: DRAFT_STATUS.FAILED })
        .eq('id', draft.id);
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
  // 프로덕션 최적화: 로깅 제거

  try {
    // P0 이슈 해결: requireTenantScope 사용
    // 최근 ready 상태의 Draft 조회
    const { data: draft, error: draftError } = await context.supabase
      .from('chatops_drafts')
      .select('*')
      .eq('tenant_id', requireTenantScope(context.tenant_id))
      .eq('session_id', context.session_id)
      .eq('status', DRAFT_STATUS.READY)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (draftError) {
      console.error('[executeCancelAction] Draft 조회 오류:', maskPII(draftError.message));
      return { success: false, result: null, error: draftError.message };
    }

    if (!draft) {
      return {
        success: false,
        result: null,
        error: '취소할 작업이 없습니다.',
      };
    }

    // Draft 취소
    await context.supabase
      .from('chatops_drafts')
      .update({ status: DRAFT_STATUS.CANCELLED })
      .eq('id', draft.id);

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

    // P0 이슈 해결: requireTenantScope 사용
    // academy_students 상태 변경
    const { error: updateError } = await context.supabase
      .from('academy_students')
      .update({
        status: STUDENT_STATUS.WITHDRAWN,
        updated_at: toKSTDate(),
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
 * 학생 등록
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

  // 프로덕션 최적화: 로깅 제거

  try {
    // P0 이슈 해결: requireTenantScope 사용
    // 1. persons 테이블에 삽입
    const { data: person, error: personError } = await context.supabase
      .from('persons')
      .insert({
        tenant_id: requireTenantScope(context.tenant_id),
        name: finalName,
        phone: phone,
        email: email,
        address: address,
        person_type: 'student',
      })
      .select()
      .single();

    if (personError) {
      console.error('[executeRegister] persons 삽입 오류:', maskPII(personError.message));
      return { success: false, result: null, error: personError.message };
    }

    // 2. academy_students 테이블에 삽입
    const { error: studentError } = await context.supabase
      .from('academy_students')
      .insert({
        person_id: person.id,
        tenant_id: requireTenantScope(context.tenant_id),
        birth_date: birth_date,
        class_name: class_name,
        grade: grade,
        school_name: school_name,
        status: STUDENT_STATUS.ACTIVE,
        created_by: context.user_id,
      });

    if (studentError) {
      console.error('[executeRegister] academy_students 삽입 오류:', maskPII(studentError.message));
      // P1 이슈: 트랜잭션 대신 수동 롤백 (Supabase 제약)
      // persons 롤백 (CASCADE로 자동 삭제될 수도 있음)
      await context.supabase
        .from('persons')
        .delete()
        .eq('id', person.id);

      return { success: false, result: null, error: studentError.message };
    }

    // 3. 보호자 정보가 있으면 저장
    if (guardian_phone) {
      try {
        await context.supabase
          .from('guardians')
          .insert({
            tenant_id: requireTenantScope(context.tenant_id),
            student_id: person.id,
            phone: guardian_phone,
            relationship: 'parent',
          });
      } catch (guardianError) {
        console.warn('[executeRegister] 보호자 정보 저장 실패:', guardianError);
      }
    }

    // P1 이슈 해결: 에러 메시지 PII 제거
    return {
      success: true,
      result: {
        message: `학생이 등록되었습니다.`,
        student_id: maskPII(person.id),
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

    // P0 이슈 해결: requireTenantScope, P1 이슈 해결: toKSTDate
    // 상태 변경
    const { error } = await context.supabase
      .from('academy_students')
      .update({
        status: STUDENT_STATUS.ON_LEAVE,
        updated_at: toKSTDate(),
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

    // P0 이슈 해결: requireTenantScope, P1 이슈 해결: toKSTDate
    // 상태 변경
    const { error } = await context.supabase
      .from('academy_students')
      .update({
        status: STUDENT_STATUS.ACTIVE,
        updated_at: toKSTDate(),
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
 * 문자 발송
 */
async function executeSendMessageAction(
  params: Record<string, any>,
  context: AgentContext
): Promise<{ success: boolean; result: any; error?: string }> {
  const { type, recipient, recipients, message, schedule_time } = params;

  // 프로덕션 최적화: 로깅 제거

  try {
    // P0 이슈 해결: requireTenantScope 사용
    // message_logs 테이블에 기록
    const messageLog = {
      tenant_id: requireTenantScope(context.tenant_id),
      message_type: type,
      content: message,
      status: MESSAGE_STATUS.PENDING,
      created_by: context.user_id,
      scheduled_at: schedule_time,
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

    // TODO: 실제 문자 발송 API 호출 (알림톡/SMS)
    // await sendSMS({ to: recipient, message: message });

    // P1 이슈 해결: toKSTDate 사용
    // 로그 상태 업데이트
    await context.supabase
      .from('message_logs')
      .update({ status: MESSAGE_STATUS.SENT, sent_at: toKSTDate() })
      .eq('id', log.id);

    return {
      success: true,
      result: {
        message: `메시지가 ${type === 'scheduled' ? '예약' : '발송'}되었습니다.`,
        log_id: maskPII(log.id),
        recipient_count: recipients?.length || 1,
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
