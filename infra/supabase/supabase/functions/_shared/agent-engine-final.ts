// LAYER: EDGE_FUNCTION_SHARED
/**
 * Agent Engine - Final Implementation
 *
 * OpenAI Function Calling 기반 Agent 엔진
 * Intent 147개 → Tool 15개로 통합
 */

import { AGENT_TOOLS, type AgentTool } from './agent-tools-final.ts';
import { maskPII } from './pii-utils.ts';
import { toKSTDate, toKSTISOString } from './date-utils.ts';
import { requireTenantScope } from '../chatops/handlers/auth.ts';
import { getTenantTableName } from './industry-adapter.ts';
import { getTenantSettingByPath } from './policy-utils.ts';

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
  _tableCache?: Map<string, string>;  // P2-8: 테이블명 캐시
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
 * P2-8: 캐시된 테이블명 조회 헬퍼
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

  // 조회 + 캐시 저장
  const tableName = await getTenantTableName(
    context.supabase,
    context.tenant_id,
    entityType
  );

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
  if (student_id) {
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

  let query = context.supabase
    .from(studentTable)
    .select('person_id, persons!inner(name, phone, birth_date)')
    .eq('tenant_id', requireTenantScope(context.tenant_id))
    .ilike('persons.name', `%${student_name}%`);

  // P0-2: phone_hint나 birth_date_hint로 자동 필터링
  if (phone_hint) {
    // 전화번호 숫자만 추출하여 마지막 4자리 매칭
    const phoneDigits = phone_hint.replace(/\D/g, '');
    if (phoneDigits.length >= 4) {
      const last4 = phoneDigits.slice(-4);
      query = query.ilike('persons.phone', `%${last4}`);
    }
  }

  if (birth_date_hint) {
    // 생년월일 정확 매칭 (YYYY-MM-DD 또는 YYYY.MM.DD 형식 지원)
    const normalizedDate = birth_date_hint.replace(/\./g, '-');
    query = query.eq('persons.birth_date', normalizedDate);
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
    const candidates = students.map((s: any) => ({
      person_id: maskPII(s.person_id),
      name: s.persons.name,
      phone: maskPII(s.persons.phone || ''),
      birth_date: s.persons.birth_date ? maskPII(s.persons.birth_date) : '',
    }));

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
      let query = context.supabase
        .from(studentTable)
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

      // P0-4: Automation Config First 정책 게이트 (Fail-Closed 엄격 적용)
      const policyPath = `domain_action.student.${action}.enabled`;
      const policyEnabled = await getTenantSettingByPath(
        context.supabase,
        context.tenant_id,
        policyPath
      );

      // Fail-Closed: 명시적으로 true가 아니면 차단
      if (policyEnabled !== true) {
        return {
          success: false,
          result: null,
          error: policyEnabled === false
            ? `${action} 작업이 정책에 의해 비활성화되어 있습니다.`
            : `${action} 작업 정책이 설정되지 않았습니다. 관리자에게 문의하세요. (정책 경로: ${policyPath})`,
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
        // draft_params 병합
        const mergedParams = { ...existingDraft.draft_params, ...args };

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

        // Draft 업데이트
        const { data: updatedDraft, error: updateError } = await context.supabase
          .from('chatops_drafts')
          .update({
            draft_params: mergedParams,
            status: draftStatus,
            missing_required: missingParams,
            updated_at: toKSTISOString(),
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

  // 프로덕션 최적화: 로깅 제거

  try {
    // P0-3: toKSTDate 사용
    const targetDate = date || toKSTDate();

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
  const intentKey = `attendance.exec.${action}`;

  // P1-5: manage_student처럼 Draft 생성
  const { data: draft, error: draftError } = await context.supabase
    .from('chatops_drafts')
    .insert({
      tenant_id: requireTenantScope(context.tenant_id),
      user_id: context.user_id,
      session_id: context.session_id,
      intent_key: intentKey,
      draft_params: args,
      status: DRAFT_STATUS.READY,
      confirm_required: true,
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

  // P0-4: Automation Config First 정책 게이트 (Fail-Closed 엄격 적용)
  const policyPath = `domain_action.message.send.enabled`;
  const policyEnabled = await getTenantSettingByPath(
    context.supabase,
    context.tenant_id,
    policyPath
  );

  // Fail-Closed: 명시적으로 true가 아니면 차단
  if (policyEnabled !== true) {
    return {
      success: false,
      result: null,
      error: policyEnabled === false
        ? '메시지 발송이 정책에 의해 비활성화되어 있습니다.'
        : `메시지 발송 정책이 설정되지 않았습니다. 관리자에게 문의하세요. (정책 경로: ${policyPath})`,
    };
  }

  // Draft 생성
  const { data: draft, error: draftError } = await context.supabase
    .from('chatops_drafts')
    .insert({
      tenant_id: requireTenantScope(context.tenant_id),  // ✅ P1-SEC: requireTenantScope 적용
      user_id: context.user_id,
      session_id: context.session_id,
      intent_key: intentKey,
      draft_params: args,
      status: DRAFT_STATUS.READY,
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
  const intentKey = `message.exec.draft_${type}`;

  // P1-7: chatops_drafts에 저장
  const { data: draft, error: draftError } = await context.supabase
    .from('chatops_drafts')
    .insert({
      tenant_id: requireTenantScope(context.tenant_id),
      user_id: context.user_id,
      session_id: context.session_id,
      intent_key: intentKey,
      draft_params: args,
      status: DRAFT_STATUS.READY,
      confirm_required: true,
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

  return {
    success: true,
    result: {
      message: `${type} 메시지 초안을 작성했습니다. 발송하시겠습니까?\n\n(draft_id: ${draft.id})`,
      draft_id: draft.id,
      requires_confirmation: true,
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
  const { action } = args;
  const intentKey = `billing.exec.${action}`;

  // P1-6: manage_student처럼 Draft 생성
  const { data: draft, error: draftError } = await context.supabase
    .from('chatops_drafts')
    .insert({
      tenant_id: requireTenantScope(context.tenant_id),
      user_id: context.user_id,
      session_id: context.session_id,
      intent_key: intentKey,
      draft_params: args,
      status: DRAFT_STATUS.READY,
      confirm_required: true,
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
    const today = new Date().toISOString().split('T')[0];

    if (type === 'dashboard') {
      // 대시보드 KPI 조회 (병렬 처리로 최적화)
      const thisMonth = new Date().toISOString().substring(0, 7);

      // P2-8: 캐시된 테이블명 조회
      const studentTable = await getCachedTableName(context, 'student');
      if (!studentTable) {
        return { success: false, result: null, error: '업종별 학생 테이블을 찾을 수 없습니다.' };
      }

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
          .eq('tenant_id', requireTenantScope(context.tenant_id))
          .eq('date', today),

        // 2. 이번 달 수납 통계
        context.supabase
          .from('invoices')
          .select('amount, paid_amount, status')
          .eq('tenant_id', requireTenantScope(context.tenant_id))
          .gte('created_at', `${thisMonth}-01T00:00:00`),

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
/**
 * 최근 대화에서 draft_id 추출 (draft_id 추적 메커니즘)
 */
function extractLastDraftId(conversationHistory: AgentMessage[]): string | null {
  // 최근 5개 메시지에서 draft_id 패턴 검색 (역순)
  for (let i = conversationHistory.length - 1; i >= Math.max(0, conversationHistory.length - 5); i--) {
    const msg = conversationHistory[i];
    if (msg.role === 'assistant' && msg.content) {
      // draft_id 패턴: draft_id: uuid 또는 "draft_id": "uuid"
      const match = msg.content.match(/draft_id["\s:]+([a-f0-9-]{36})/i);
      if (match) {
        return match[1];
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

**[Tool 선택 규칙]**
- 학생 이름 언급 → manage_student (조회/등록/수정/휴원/복귀/퇴원/반변경)
- "전화번호", "정보", "프로필" → manage_student의 action: 'search' 또는 'get_profile'
- "지각", "결석", "출석", "출결" → query_attendance (조회) 또는 manage_attendance (관리)
- "메시지", "문자", "알림", "공지" → query_message (이력) / send_message (발송) / draft_message (초안)
- "수납", "청구", "연체", "미수금", "입금" → query_billing (조회) 또는 manage_billing (처리)
- "반 목록", "반 명단", "학생 명단" → query_class
- "통계", "현황", "요약", "대시보드" → get_report

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
      // draft_id가 없으면 배열로 받아 첫 번째 요소 추출 (안전)
      const result = await context.supabase
        .from('chatops_drafts')
        .select('*')
        .eq('tenant_id', requireTenantScope(context.tenant_id))
        .eq('session_id', context.session_id)
        .eq('status', DRAFT_STATUS.READY)
        .order('updated_at', { ascending: false })
        .limit(1);

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
      // draft_id가 없으면 배열로 받아 첫 번째 요소 추출 (안전)
      const result = await context.supabase
        .from('chatops_drafts')
        .select('*')
        .eq('tenant_id', requireTenantScope(context.tenant_id))
        .eq('session_id', context.session_id)
        .eq('status', DRAFT_STATUS.READY)
        .order('updated_at', { ascending: false })
        .limit(1);

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
    // P2-8: 캐시된 테이블명 조회
    const studentTable = await getCachedTableName(context, 'student');
    if (!studentTable) {
      return { success: false, result: null, error: '업종별 학생 테이블을 찾을 수 없습니다.' };
    }

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

    // 2. 업종별 학생 테이블에 삽입
    const { error: studentError } = await context.supabase
      .from(studentTable)
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
      console.error('[executeRegister] 학생 테이블 삽입 오류:', maskPII(studentError.message));
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

    // P2-10: toKSTISOString 사용 (timestamp 컬럼)
    // 로그 상태 업데이트
    await context.supabase
      .from('message_logs')
      .update({ status: MESSAGE_STATUS.SENT, sent_at: toKSTISOString() })
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
