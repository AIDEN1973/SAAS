// LAYER: EDGE_FUNCTION
/**
 * ChatOps Edge Function
 *
 * 챗봇.md 참조
 * 목적: 자연어 입력을 받아 AI 응답을 생성
 *
 * [불변 규칙] Zero-Trust: tenant_id는 JWT에서 추출 (요청 본문에서 받지 않음)
 * [불변 규칙] 상담일지 요약과 동일한 GPT 모델 사용 (gpt-4o-mini, temperature: 0.3)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { shouldUseAI } from '../_shared/policy-utils.ts';
import { envServer } from '../_shared/env-registry.ts';
import { parseIntentFromResponse, removeIntentJsonFromResponse } from '../_shared/intent-parser.ts';
import { intentRegistry } from '../_shared/intent-registry.ts';
import { maskPII } from '../_shared/pii-utils.ts';
import { getL0Handler, hasL0Handler } from '../_shared/l0-handlers.ts';
import { getTenantSettingByPath } from '../_shared/policy-utils.ts';
import { createTaskCardWithDedup } from '../_shared/create-task-card-with-dedup.ts';
import { withTenant } from '../_shared/withTenant.ts';
import { toKSTDate } from '../_shared/date-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface ChatOpsRequest {
  message: string;
}

interface ChatOpsResponse {
  response: string;
  intent?: {
    intent_key: string;
    automation_level: 'L0' | 'L1' | 'L2';
    execution_class?: 'A' | 'B'; // L2일 때만 존재
    params?: Record<string, unknown>;
  };
  l0_result?: unknown; // L0 Intent 실행 결과
  task_card_id?: string; // L1/L2 Intent의 경우 생성된 TaskCard ID
}

/**
 * Intent 키워드 매핑 (Fallback용)
 * Intent Registry의 intent_key를 기반으로 키워드 매핑을 생성합니다.
 */
const INTENT_KEYWORD_MAP: Record<string, string[]> = {
  // Student 도메인
  'student.exec.discharge': ['퇴원', '퇴원처리', '퇴원해', '퇴원 처리', '퇴원 처리해', '퇴원해줘', '퇴원해주세요', '퇴원시켜', '퇴원시켜줘', '퇴원시켜주세요'],
  'student.exec.pause': ['휴원', '휴원처리', '휴원해', '휴원해줘', '휴원해주세요', '휴원시켜', '휴원시켜줘'],
  'student.exec.resume': ['재개', '복학', '재개해', '재개해줘', '재개해주세요', '복학해', '복학해줘'],
  'student.exec.register': ['등록', '등록해', '등록해줘', '등록해주세요', '신규등록', '신규 등록'],
  'student.exec.update_profile': ['수정', '변경', '업데이트', '프로필 수정', '정보 수정'],
  'student.exec.change_class': ['반 변경', '반이동', '반 이동', '반 바꿔', '반 바꾸기'],
  'student.query.search': ['검색', '찾기', '조회', '찾아', '찾아줘', '찾아주세요', '검색해', '검색해줘', '조회해', '조회해줘'],
  'student.query.profile': ['프로필', '정보', '상세', '상세정보', '프로필 조회'],

  // Attendance 도메인
  'attendance.query.late': ['지각', '지각한', '지각자', '지각 조회', '지각 목록'],
  'attendance.query.absent': ['결석', '결석한', '결석자', '결석 조회', '결석 목록'],
  'attendance.query.by_student': ['출결', '출석', '출결 조회', '출석 조회', '출결률', '출석률'],
  'attendance.query.by_class': ['반 출결', '반 출석', '반별 출결', '반별 출석'],
  'attendance.query.early_leave': ['조퇴', '조퇴한', '조퇴자', '조퇴 조회'],
  'attendance.query.unchecked': ['미체크', '미확인', '체크 안된', '확인 안된'],
  'attendance.exec.notify_guardians_late': ['지각 알림', '지각 안내', '지각 문자', '지각 메시지'],
  'attendance.exec.notify_guardians_absent': ['결석 알림', '결석 안내', '결석 문자', '결석 메시지'],
  'attendance.exec.correct_record': ['출결 수정', '출석 수정', '기록 수정', '출결 정정'],
  'attendance.exec.mark_excused': ['사유 처리', '사유 인정', '사유 체크'],

  // Billing 도메인
  'billing.query.overdue_list': ['연체', '연체자', '연체 목록', '미납', '미납자'],
  'billing.query.overdue_month': ['월별 연체', '월 연체', '연체 월별'],
  'billing.query.by_student': ['청구', '수납', '청구 조회', '수납 조회', '납부'],
  'billing.query.invoice_status': ['청구서', '인보이스', '청구서 상태', '인보이스 상태'],
  'billing.query.failed_payments': ['결제 실패', '결제 오류', '결제 안됨'],
  'billing.query.refund_candidates': ['환불', '환불 후보', '환불 대상'],
  'billing.exec.send_payment_link': ['결제 링크', '납부 링크', '결제 링크 발송'],
  'billing.exec.issue_invoices': ['청구서 발행', '인보이스 발행', '청구서 발급'],
  'billing.exec.record_manual_payment': ['수동 결제', '수동 납부', '수동 입금'],
  'billing.exec.apply_discount': ['할인', '할인 적용', '할인 처리'],
  'billing.exec.apply_refund': ['환불 적용', '환불 처리', '환불 실행'],

  // Message 도메인
  'message.exec.send_to_guardian': ['문자', '메시지', '알림', '발송', '문자 발송', '메시지 발송'],
  'message.exec.send_bulk': ['일괄 발송', '대량 발송', '일괄 문자', '대량 문자'],
  'message.exec.schedule_bulk': ['예약 발송', '스케줄 발송', '예약 문자'],
  'message.draft.absence_notice': ['결석 안내', '결석 공지', '결석 초안'],
  'message.draft.overdue_notice': ['연체 안내', '연체 공지', '연체 초안'],

  // Class 도메인
  'class.query.list': ['반 목록', '반 리스트', '반 조회'],
  'class.query.roster': ['명단', '반 명단', '학생 명단'],
  'class.exec.create': ['반 생성', '반 만들기', '반 추가'],
  'class.exec.update': ['반 수정', '반 변경', '반 업데이트'],
  'class.exec.close': ['반 종료', '반 마감', '반 닫기'],

  // Schedule 도메인
  'schedule.query.today': ['오늘 일정', '오늘 수업', '오늘 스케줄'],
  'schedule.query.by_teacher': ['선생님 일정', '강사 일정', '교사 일정'],
  'schedule.query.by_class': ['반 일정', '반 스케줄'],
  'schedule.exec.add_session': ['수업 추가', '세션 추가', '일정 추가'],
  'schedule.exec.move_session': ['일정 변경', '수업 이동', '일정 이동'],
  'schedule.exec.cancel_session': ['수업 취소', '일정 취소', '세션 취소'],

  // Report 도메인
  'report.query.dashboard_kpi': ['대시보드', 'KPI', '지표', '현황'],
  'report.query.attendance_summary': ['출결 요약', '출석 요약', '출결 리포트'],
  'report.query.billing_summary': ['수납 요약', '청구 요약', '수납 리포트'],
  'report.exec.generate_monthly_report': ['월간 리포트', '월간 보고서', '월 리포트'],
  'report.exec.generate_daily_brief': ['일일 브리핑', '일일 요약', '일일 리포트'],
};

/**
 * Intent 키워드 매핑 확장 (동사/명령형 변형 생성)
 */
function expandKeywords(baseKeywords: string[]): string[] {
  const expanded: string[] = [];
  const verbEndings = ['해', '해줘', '해주세요', '해요', '하세요', '하자', '하겠', '하겠습니다', '시켜', '시켜줘', '시켜주세요'];

  for (const keyword of baseKeywords) {
    expanded.push(keyword);
    // 동사형이 아닌 경우 동사형 추가
    if (!keyword.endsWith('해') && !keyword.endsWith('해줘') && !keyword.endsWith('해주세요')) {
      for (const ending of verbEndings) {
        expanded.push(keyword + ending);
      }
    }
  }

  return [...new Set(expanded)]; // 중복 제거
}

/**
 * Fallback: 사용자 요청에서 키워드를 분석하여 올바른 Intent 추론
 * Intent 파싱 실패 시 사용자 요청을 분석하여 올바른 Intent를 추론합니다.
 * Intent Registry의 모든 인텐트를 지원합니다.
 */
function inferIntentFromMessage(message: string): ChatOpsResponse['intent'] | undefined {
  console.log('[ChatOps:Fallback] ===== Fallback 함수 시작 =====', {
    message_type: typeof message,
    message_length: message?.length,
    message_preview: message?.substring(0, 50),
  });

  if (!message || typeof message !== 'string') {
    console.log('[ChatOps:Fallback] message가 유효하지 않음');
    return undefined;
  }

  const lowerMessage = message.toLowerCase().trim();
  console.log('[ChatOps:Fallback] 키워드 분석 중:', {
    message_preview: message.substring(0, 50),
    lower_message: lowerMessage,
    lower_message_length: lowerMessage.length,
  });

  // Intent Registry의 모든 인텐트에 대해 키워드 매칭 시도
  // 우선순위: 명시적 키워드 매핑 > Intent 키 패턴 매칭

  // 1. 명시적 키워드 매핑 확인 (INTENT_KEYWORD_MAP)
  for (const [intentKey, keywords] of Object.entries(INTENT_KEYWORD_MAP)) {
    const expandedKeywords = expandKeywords(keywords);
    const matchedKeywords = expandedKeywords.filter(keyword => lowerMessage.includes(keyword.toLowerCase()));

    if (matchedKeywords.length > 0) {
      const intent = intentRegistry[intentKey];
      if (intent) {
        console.log('[ChatOps:Fallback] 키워드 매칭됨:', {
          intent_key: intentKey,
          matched_keywords: matchedKeywords,
          automation_level: intent.automation_level,
        });
        return {
          intent_key: intentKey,
          automation_level: intent.automation_level,
          ...(intent.execution_class && { execution_class: intent.execution_class }),
          params: {},
        };
      }
    }
  }

  // 2. Intent 키 패턴 매칭 (도메인.타입.액션 기반)
  // 예: "student.exec.discharge" → "student", "discharge", "exec" 등의 키워드
  for (const [intentKey, intent] of Object.entries(intentRegistry)) {
    const parts = intentKey.split('.');
    if (parts.length === 3) {
      const [domain, type, action] = parts;

      // 도메인 키워드 매핑
      const domainKeywords: Record<string, string[]> = {
        'student': ['학생', '대상', '회원', '원생'],
        'attendance': ['출결', '출석', '지각', '결석', '조퇴'],
        'billing': ['수납', '청구', '결제', '납부', '연체', '환불'],
        'message': ['문자', '메시지', '알림', '공지'],
        'class': ['반', '수업', '클래스'],
        'schedule': ['일정', '스케줄', '시간표'],
        'report': ['리포트', '보고서', '요약', '현황'],
      };

      // 타입 키워드 매핑
      const typeKeywords: Record<string, string[]> = {
        'query': ['조회', '검색', '찾기', '확인', '보기'],
        'exec': ['실행', '처리', '해', '시켜', '하기'],
        'task': ['업무', '작업', '태스크'],
        'draft': ['초안', '작성', '만들기'],
      };

      // 액션 키워드 매핑 (일부 주요 액션)
      const actionKeywords: Record<string, string[]> = {
        'discharge': ['퇴원'],
        'pause': ['휴원'],
        'resume': ['재개', '복학'],
        'register': ['등록'],
        'late': ['지각'],
        'absent': ['결석'],
        'overdue': ['연체'],
        'invoice': ['청구서', '인보이스'],
        'payment': ['결제', '납부'],
      };

      const domainKw = domainKeywords[domain] || [];
      const typeKw = typeKeywords[type] || [];
      const actionKw = actionKeywords[action] || [];

      // 도메인 + 타입 + 액션 키워드가 모두 매칭되는지 확인
      const hasDomain = domainKw.length === 0 || domainKw.some(kw => lowerMessage.includes(kw));
      const hasType = typeKw.length === 0 || typeKw.some(kw => lowerMessage.includes(kw));
      const hasAction = actionKw.length === 0 || actionKw.some(kw => lowerMessage.includes(kw));

      // 도메인과 액션이 매칭되거나, 도메인과 타입이 매칭되는 경우
      if ((hasDomain && hasAction) || (hasDomain && hasType && actionKw.length === 0)) {
        console.log('[ChatOps:Fallback] 패턴 매칭됨:', {
          intent_key: intentKey,
          domain_matched: hasDomain,
          type_matched: hasType,
          action_matched: hasAction,
        });
        return {
          intent_key: intentKey,
          automation_level: intent.automation_level,
          ...(intent.execution_class && { execution_class: intent.execution_class }),
          params: {},
        };
      }
    }
  }

  // Intent Registry에서 찾을 수 없으면 undefined 반환
  console.log('[ChatOps:Fallback] 키워드 매칭 실패');
  return undefined;
}

/**
 * 파라미터 정규화 (범용)
 *
 * AI가 추출한 파라미터를 Handler가 기대하는 형식으로 변환합니다.
 * - name → student_id (학생 이름으로 조회)
 * - class_name → class_id (반 이름으로 조회)
 * - 기타 일반적인 변환 규칙 적용
 *
 * 이 함수는 모든 Intent에 일관되게 적용되며, 케이스별 로직을 피합니다.
 */
async function normalizeParams(
  params: Record<string, unknown>,
  intentKey: string,
  supabase: any,
  tenantId: string
): Promise<Record<string, unknown>> {
  const normalized = { ...params };

  // student_id가 없고 name이 있는 경우: name으로 student_id 조회
  if (!normalized.student_id && normalized.name && typeof normalized.name === 'string') {
    const studentName = normalized.name;
    try {
      // ⚠️ 중요: withTenant를 사용하여 tenant_id 필터링 필수
      const { data: persons, error: searchError } = await withTenant(
        supabase
          .from('persons')
          .select('id, name')
          .eq('name', studentName)
          .eq('person_type', 'student')
          .limit(1),
        tenantId
      );

      if (!searchError && persons && persons.length > 0) {
        normalized.student_id = persons[0].id;
        console.log('[ChatOps:Normalize] name → student_id 변환 성공:', {
          name: maskPII(studentName),
          student_id: persons[0].id.substring(0, 8) + '...',
        });
        // name은 제거하지 않음 (Handler가 필요할 수 있음)
      } else {
        console.log('[ChatOps:Normalize] name → student_id 변환 실패:', {
          name: maskPII(studentName),
          error: searchError ? maskPII(searchError) : '학생을 찾을 수 없음',
        });
      }
    } catch (error) {
      const maskedError = maskPII(error);
      console.log('[ChatOps:Normalize] name → student_id 변환 중 오류:', maskedError);
    }
  }

  // class_id가 없고 class_name이 있는 경우: class_name으로 class_id 조회
  if (!normalized.class_id && normalized.class_name && typeof normalized.class_name === 'string') {
    const className = normalized.class_name;
    try {
      // ⚠️ 중요: withTenant를 사용하여 tenant_id 필터링 필수
      const { data: classes, error: searchError } = await withTenant(
        supabase
          .from('academy_classes')
          .select('id, name')
          .eq('name', className)
          .limit(1),
        tenantId
      );

      if (!searchError && classes && classes.length > 0) {
        normalized.class_id = classes[0].id;
        console.log('[ChatOps:Normalize] class_name → class_id 변환 성공:', {
          class_name: className,
          class_id: classes[0].id.substring(0, 8) + '...',
        });
      } else {
        console.log('[ChatOps:Normalize] class_name → class_id 변환 실패:', {
          class_name: className,
          error: searchError ? maskPII(searchError) : '반을 찾을 수 없음',
        });
      }
    } catch (error) {
      const maskedError = maskPII(error);
      console.log('[ChatOps:Normalize] class_name → class_id 변환 중 오류:', maskedError);
    }
  }

  // 날짜 형식 정규화 (YYYY-MM-DD)
  // ⚠️ P1: 날짜 처리 - toKSTDate() 사용 (체크리스트 준수)
  if (normalized.date && typeof normalized.date === 'string') {
    // 이미 YYYY-MM-DD 형식인지 확인
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(normalized.date)) {
      try {
        const date = new Date(normalized.date);
        if (!isNaN(date.getTime())) {
          // ⚠️ P1: toISOString().split('T')[0] 직접 사용 금지, toKSTDate() 사용
          normalized.date = toKSTDate(date);
          console.log('[ChatOps:Normalize] 날짜 형식 정규화:', {
            original: normalized.date,
            normalized: normalized.date,
          });
        }
      } catch (error) {
        // 날짜 파싱 실패는 무시
      }
    }
  }

  return normalized;
}

/**
 * JWT에서 tenant_id 추출
 * [불변 규칙] Zero-Trust: 클라이언트에서 전달한 tenant_id는 신뢰하지 않고 JWT에서 추출
 */
function extractTenantIdFromJWT(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7); // "Bearer " 제거
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('[ChatOps] Invalid JWT format: expected 3 parts');
      return null;
    }

    // JWT payload 디코딩 (base64url)
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }

    const payload = JSON.parse(atob(base64));
    const tenantId = payload.tenant_id;
    if (!tenantId || typeof tenantId !== 'string') {
      console.error('[ChatOps] tenant_id not found in JWT claims');
      return null;
    }

    return tenantId;
  } catch (error) {
    // P0: PII 마스킹 필수
    const maskedError = maskPII(error);
    console.error('[ChatOps] JWT parsing error:', maskedError);
    return null;
  }
}

serve(async (req) => {
  // CORS preflight 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // [불변 규칙] Edge Functions도 env-registry를 통해 환경변수 접근
    const openaiApiKey = envServer.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');
    }

    // [불변 규칙] Zero-Trust: JWT에서 tenant_id 추출
    const authHeader = req.headers.get('authorization');
    const tenant_id = extractTenantIdFromJWT(authHeader);

    if (!tenant_id) {
      // P0: PII 마스킹 필수 (tenant_id는 로그에 포함하지 않음)
      console.error('[ChatOps] Failed to extract tenant_id from JWT');
      return new Response(
        JSON.stringify({ error: '인증이 필요합니다. JWT에서 tenant_id를 추출할 수 없습니다.' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // P0: PII 마스킹 필수 (tenant_id는 로그에 포함하지 않음)
    console.log('[ChatOps] tenant_id extracted successfully');

    // 요청 본문 파싱
    let requestBody: ChatOpsRequest;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      // P0: PII 마스킹 필수
      const maskedParseError = maskPII(parseError);
      console.error('[ChatOps] Failed to parse request body:', maskedParseError);
      return new Response(
        JSON.stringify({ error: '요청 본문을 파싱할 수 없습니다.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { message } = requestBody;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      console.error('[ChatOps] message is missing or empty');
      return new Response(
        JSON.stringify({ error: 'message가 필요합니다.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // P0: PII 마스킹 필수
    console.log('[ChatOps] ===== 작업 시작 =====');
    console.log('[ChatOps] 사용자 메시지 수신:', {
      message_preview: maskPII(message.substring(0, 100)),
      message_length: message.length,
      tenant_id: tenant_id ? 'present' : 'missing',
    });

    // Supabase 클라이언트 생성
    const supabase = createClient(envServer.SUPABASE_URL, envServer.SERVICE_ROLE_KEY);

    // AI 기능 온오프 체크 (SSOT 기준, Fail Closed)
    if (!(await shouldUseAI(supabase, tenant_id))) {
      // P0: PII 마스킹 필수 (tenant_id는 로그에 포함하지 않음)
      console.log('[ChatOps] AI disabled for tenant');

      // ⚠️ 중요: AI OFF 시 ai_decision_logs에 skipped_by_flag 기록 (SSOT 준수)
      await supabase.from('ai_decision_logs').insert({
        tenant_id: tenant_id,
        model: 'chatops',
        features: { message: message.substring(0, 100) },
        reason: 'AI disabled (PLATFORM_AI_ENABLED or tenant_features disabled)',
        skipped_by_flag: true,
        created_at: new Date().toISOString(),
      }).catch((error) => {
        // P0: PII 마스킹 필수
        const maskedError = maskPII(error);
        console.error('[ChatOps] Failed to log AI skip decision:', maskedError);
      });

      return new Response(
        JSON.stringify({ error: 'AI 기능이 비활성화되어 있습니다.' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // ChatGPT API 호출 (상담일지 요약과 동일한 모델 설정)
    // ⚠️ 업종 중립: "학원" 대신 "기관" 또는 일반적인 용어 사용
    // ⚠️ 개선: System prompt를 간결하게 재구성하고 Few-shot 예시 추가
    const systemPrompt = `당신은 기관 관리 시스템의 AI 어시스턴트입니다.

⚠️ 필수: 모든 응답 끝에 반드시 Intent JSON을 포함해야 합니다.

Few-shot 예시 (정확히 이 형식을 따르세요):

예시 1:
사용자: "박소영 퇴원처리해"
응답:
박소영님의 퇴원 처리를 진행하겠습니다.

\`\`\`json
{
  "intent_key": "student.exec.discharge",
  "automation_level": "L2",
  "execution_class": "B",
  "params": {}
}
\`\`\`

예시 2:
사용자: "지각한 학생 조회"
응답:
지각한 학생 목록을 조회하겠습니다.

\`\`\`json
{
  "intent_key": "attendance.query.late",
  "automation_level": "L0",
  "params": {}
}
\`\`\`

예시 3:
사용자: "박소영 출결"
응답:
박소영님의 출결 정보를 조회하겠습니다.

\`\`\`json
{
  "intent_key": "student.query.search",
  "automation_level": "L0",
  "params": {}
}
\`\`\`

주요 기능:
- 참석 조회 (지각, 결석, 조퇴 등) // 업종 중립: 출결 → 참석
- 대상 정보 조회 // 업종 중립: 학생 → 대상
- 업무 생성 및 승인 요청
- 메시지 발송 계획 수립
- 수납/청구 조회 및 처리
- 반/수업/시간표 관리
- 상담일지 및 AI 요약
- 리포트 생성 및 발송

사용 가능한 Intent 목록 (도메인별):

[출결(Attendance) 도메인 - L0 조회]
- attendance.query.late: 지각한 대상 조회
- attendance.query.by_student: 특정 대상의 출결 조회
- attendance.query.absent: 결석한 대상 조회
- attendance.query.early_leave: 조퇴한 대상 조회
- attendance.query.unchecked: 출결 미체크 대상 조회
- attendance.query.by_class: 반별 출결 조회
- attendance.query.streak_absent: 연속 결석 대상 조회
- attendance.query.rate_summary: 출결률 요약 조회
- attendance.query.rate_drop: 출결률 하락 대상 조회
- attendance.query.late_rank: 지각 랭킹 조회
- attendance.query.export_csv: 출결 데이터 CSV 내보내기

[출결(Attendance) 도메인 - L1 업무화]
- attendance.task.flag_absence_followup: 결석 후속 조치 TaskCard 생성
- attendance.task.flag_late_followup: 지각 후속 조치 TaskCard 생성
- attendance.task.create_contact_list: 연락처 목록 생성 TaskCard

[출결(Attendance) 도메인 - L2 실행]
- attendance.exec.notify_guardians_late: 지각 대상 보호자 알림 발송 실행 (L2-A)
- attendance.exec.notify_guardians_absent: 결석 대상 보호자 알림 발송 실행 (L2-A)
- attendance.exec.request_reason_message: 결석 사유 요청 메시지 발송 (L2-A)
- attendance.exec.send_staff_summary: 직원용 출결 요약 발송 실행 (L2-A)
- attendance.exec.correct_record: 출결 기록 수정 실행 (L2-B)
- attendance.exec.mark_excused: 출결 기록 사유 처리 실행 (L2-B)
- attendance.exec.bulk_update: 출결 기록 일괄 수정 실행 (L2-B)
- attendance.exec.schedule_recheck: 출결 재확인 예약 실행 (L2-B)

[학생 라이프사이클(Student) 도메인 - L0 조회]
- student.query.search: 대상 검색
- student.query.profile: 대상 프로필 조회
- student.query.status_list: 상태별 대상 목록 조회
- student.query.missing_guardian_contact: 보호자 연락처 누락 대상 조회
- student.query.duplicates_suspected: 중복 의심 대상 조회
- student.query.onboarding_needed: 온보딩 필요 대상 조회
- student.query.data_quality_scan: 대상 데이터 품질 검증

[학생 라이프사이클(Student) 도메인 - L1 업무화]
- student.task.register_prefill: 대상 등록 사전 입력 TaskCard 생성
- student.task.collect_documents: 문서 수집 TaskCard 생성

[학생 라이프사이클(Student) 도메인 - L2 실행]
- student.exec.send_welcome_message: 신규 등록 환영 메시지 발송 실행 (L2-A)
- student.exec.request_documents_message: 문서 요청 메시지 발송 실행 (L2-A)
- student.exec.register: 대상 등록 실행 (L2-B)
- student.exec.update_profile: 대상 프로필 수정 실행 (L2-B)
- student.exec.change_class: 반 변경 실행 (L2-B)
- student.exec.pause: 대상 휴원 처리 실행 (L2-B)
- student.exec.resume: 대상 재개 처리 실행 (L2-B)
- student.exec.discharge: 대상 퇴원 처리 실행 (L2-B)
- student.exec.merge_duplicates: 중복 대상 병합 실행 (L2-B)
- student.exec.update_guardian_contact: 보호자 연락처 수정 실행 (L2-B)
- student.exec.assign_tags: 대상 태그 할당 실행 (L2-B)
- student.exec.bulk_register: 대상 일괄 등록 실행 (L2-B)
- student.exec.bulk_update: 대상 일괄 수정 실행 (L2-B)
- student.exec.data_quality_apply_fix: 데이터 품질 자동 수정 실행 (L2-B)
- student.exec.reactivate_from_discharged: 퇴원 대상 재활성화 실행 (L2-B)

[수납/청구(Billing) 도메인 - L0 조회]
- billing.query.overdue_month: 월별 연체 조회
- billing.query.overdue_list: 연체 목록 조회
- billing.query.by_student: 특정 대상의 청구 조회
- billing.query.invoice_status: 청구서 상태 조회
- billing.query.failed_payments: 결제 실패 목록 조회
- billing.query.refund_candidates: 환불 후보 조회
- billing.query.kpi_summary: 수납 KPI 요약 조회
- billing.query.unissued_invoices: 미발행 청구서 조회
- billing.query.partial_payments: 부분 결제 목록 조회
- billing.query.export_statement: 명세서 내보내기

[수납/청구(Billing) 도메인 - L1 업무화]
- billing.task.flag_overdue_followup: 연체 후속 조치 TaskCard 생성
- billing.task.prepare_invoice_batch: 청구서 일괄 준비 TaskCard 생성
- billing.task.prepare_refund_review: 환불 검토 TaskCard 생성
- billing.task.prepare_payment_link_batch: 결제 링크 일괄 준비 TaskCard 생성
- billing.task.flag_churn_risk_from_billing: 수납 기반 이탈 위험 플래깅 TaskCard 생성

[수납/청구(Billing) 도메인 - L2 실행]
- billing.exec.send_overdue_notice_1st: 1차 연체 안내 발송 실행 (L2-A)
- billing.exec.send_overdue_notice_2nd: 2차 연체 안내 발송 실행 (L2-A)
- billing.exec.send_payment_link: 결제 링크 발송 실행 (L2-A)
- billing.exec.schedule_overdue_notice: 연체 안내 예약 발송 실행 (L2-A)
- billing.exec.issue_invoices: 청구서 발행 실행 (L2-B)
- billing.exec.reissue_invoice: 청구서 재발행 실행 (L2-B)
- billing.exec.record_manual_payment: 수동 결제 기록 실행 (L2-B)
- billing.exec.apply_discount: 할인 적용 실행 (L2-B)
- billing.exec.apply_refund: 환불 적용 실행 (L2-B)
- billing.exec.create_installment_plan: 할부 계획 생성 실행 (L2-B)
- billing.exec.fix_duplicate_invoices: 중복 청구서 수정 실행 (L2-B)
- billing.exec.sync_gateway: 결제 게이트웨이 동기화 실행 (L2-B)
- billing.exec.close_month: 월 마감 처리 실행 (L2-B)

[메시지/공지(Messaging) 도메인 - L0 조회/초안]
- message.query.sent_log: 발송 로그 조회
- message.query.failed_log: 발송 실패 로그 조회
- message.draft.absence_notice: 결석 안내 초안 생성
- message.draft.overdue_notice: 연체 안내 초안 생성
- message.draft.general_notice: 일반 공지 초안 생성
- message.preview.audience: 수신 대상 미리보기
- message.preview.template_render: 템플릿 렌더링 미리보기
- message.draft.payment_link_notice: 결제 링크 안내 초안 생성
- message.query.variables_check: 템플릿 변수 검증

[메시지/공지(Messaging) 도메인 - L1 업무화]
- message.task.prepare_bulk_send: 일괄 발송 준비 TaskCard 생성
- message.task.test_send_request: 테스트 발송 요청 TaskCard 생성

[메시지/공지(Messaging) 도메인 - L2 실행]
- message.exec.send_to_guardian: 보호자 메시지 발송 실행 (L2-A)
- message.exec.send_bulk: 일괄 메시지 발송 실행 (L2-A)
- message.exec.schedule_bulk: 일괄 메시지 예약 발송 실행 (L2-A)
- message.exec.resend_failed: 실패 메시지 재발송 실행 (L2-A)
- message.exec.optout_respect_audit: 수신거부 감사 실행 (L2-A)
- message.exec.staff_broadcast: 직원 브로드캐스트 실행 (L2-A)
- message.exec.class_schedule_change_notice: 수업 일정 변경 안내 실행 (L2-A)
- message.exec.emergency_notice: 긴급 공지 실행 (L2-A)
- message.exec.cancel_scheduled: 예약 발송 취소 실행 (L2-B)
- message.exec.create_template: 메시지 템플릿 생성 실행 (L2-B)
- message.exec.update_template: 메시지 템플릿 수정 실행 (L2-B)

[반/수업/시간표(Class/Schedule) 도메인 - L0 조회]
- class.query.list: 반 목록 조회
- class.query.roster: 반 명단 조회
- schedule.query.today: 오늘 시간표 조회
- schedule.query.by_teacher: 강사별 시간표 조회
- schedule.query.by_class: 반별 시간표 조회
- schedule.query.export_timetable: 시간표 내보내기

[반/수업/시간표(Class/Schedule) 도메인 - L1 업무화]
- schedule.task.propose_makeup_session: 보강 수업 제안 TaskCard 생성

[반/수업/시간표(Class/Schedule) 도메인 - L2 실행]
- schedule.exec.notify_change: 시간표 변경 안내 실행 (L2-A)
- class.exec.create: 반 생성 실행 (L2-B)
- class.exec.update: 반 정보 수정 실행 (L2-B)
- class.exec.close: 반 폐쇄 실행 (L2-B)
- schedule.exec.add_session: 수업 세션 추가 실행 (L2-B)
- schedule.exec.move_session: 수업 세션 이동 실행 (L2-B)
- schedule.exec.cancel_session: 수업 세션 취소 실행 (L2-B)
- class.exec.bulk_reassign_teacher: 강사 일괄 재배정 실행 (L2-B)
- schedule.exec.bulk_shift: 시간표 일괄 이동 실행 (L2-B)

[상담/학습/메모 + AI(Notes/AI) 도메인 - L0 조회/초안]
- note.query.by_student: 대상별 상담일지 조회
- note.draft.consult_summary: 상담 요약 초안 생성
- ai.summarize.student_history: 대상 이력 요약
- ai.generate.followup_message: 후속 메시지 생성
- ai.summarize.class_history: 반 이력 요약
- ai.generate.counseling_agenda: 상담 안건 초안 생성
- ai.query.export_ai_briefing: AI 브리핑 내보내기

[상담/학습/메모 + AI(Notes/AI) 도메인 - L1 업무화]
- ai.task.flag_risk_signals: 위험 신호 플래깅 TaskCard 생성
- ai.task.create_recommendations: 일일 추천 생성 TaskCard
- ai.task.bulk_generate_taskcards: TaskCard 일괄 생성 TaskCard

[상담/학습/메모 + AI(Notes/AI) 도메인 - L2 실행]
- ai.exec.request_staff_review: 직원 검토 요청 실행 (L2-A)
- ai.exec.escalate_emergency: 긴급 에스컬레이션 실행 (L2-A)
- note.exec.create: 상담일지 생성 실행 (L2-B)
- note.exec.update: 상담일지 수정 실행 (L2-B)

[리포트/대시보드(Reports) 도메인 - L0 조회]
- report.query.dashboard_kpi: 대시보드 KPI 조회
- report.query.attendance_summary: 출결 요약 리포트 조회
- report.query.billing_summary: 수납 요약 리포트 조회
- report.query.export_dataset: 데이터셋 내보내기
- report.query.health_snapshot: 헬스 스냅샷 조회

[리포트/대시보드(Reports) 도메인 - L1 업무화]
- report.task.prepare_monthly_report: 월간 리포트 준비 TaskCard 생성

[리포트/대시보드(Reports) 도메인 - L2 실행]
- report.exec.send_report: 리포트 발송 실행 (L2-A)
- report.exec.schedule_monthly_report: 월간 리포트 예약 발송 실행 (L2-A)
- report.exec.generate_monthly_report: 월간 리포트 생성 실행 (L2-B)
- report.exec.generate_daily_brief: 일일 브리핑 생성 실행 (L2-B)

[정책/권한/시스템(System) 도메인 - L0 조회]
- rbac.query.my_permissions: 내 권한 조회
- policy.query.automation_rules: 자동화 규칙 조회
- system.query.health: 시스템 헬스 조회

[정책/권한/시스템(System) 도메인 - L2 실행]
- policy.exec.enable_automation: 자동화 활성화 실행 (L2-B)
- policy.exec.update_threshold: 임계값 업데이트 실행 (L2-B)
- rbac.exec.assign_role: 역할 할당 실행 (L2-B)
- system.exec.run_healthcheck: 헬스체크 실행 (L2-B)
- system.exec.rebuild_search_index: 검색 인덱스 재구축 실행 (L2-B)
- system.exec.backfill_reports: 리포트 백필 실행 (L2-B)
- system.exec.retry_failed_actions: 실패 액션 재시도 실행 (L2-B)

응답 형식 (필수):
1. 자연어 응답을 제공하세요.
2. ⚠️ 반드시 응답 끝에 JSON 형식으로 Intent 정보를 포함해야 합니다 (마크다운 코드 블록 사용):
   \`\`\`json
   {
     "intent_key": "intent.key.format",
     "automation_level": "L0" | "L1" | "L2",
     "execution_class": "A" | "B",
     "params": {}
   }
   \`\`\`

⚠️⚠️⚠️ params 필드 필수 규칙 (절대 준수) ⚠️⚠️⚠️:

1. 사용자 메시지에서 필요한 파라미터를 반드시 추출하여 params에 포함하세요.
2. 학생 이름이 포함된 경우:
   - student.query.* Intent: params에 { "student_id": "..." } 또는 { "name": "..." } 포함
   - student.exec.* Intent: params에 { "student_id": "..." } 포함
   - 학생 이름으로 student_id를 찾을 수 없으면 { "name": "..." } 포함
3. 날짜가 포함된 경우:
   - params에 { "date": "YYYY-MM-DD" } 또는 { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" } 포함
4. 반(class) 정보가 포함된 경우:
   - params에 { "class_id": "..." } 또는 { "class_name": "..." } 포함
5. 기타 Intent별 필수 파라미터:
   - attendance.query.*: class_id, date 등 필요 시 포함
   - billing.query.*: student_id, month 등 필요 시 포함
   - message.exec.*: template_id, student_ids 등 필요 시 포함

예시:
사용자: "박소영 학생 전화번호"
응답:
박소영님의 전화번호를 조회하겠습니다.

\`\`\`json
{
  "intent_key": "student.query.profile",
  "automation_level": "L0",
  "params": {
    "name": "박소영"
  }
}
\`\`\`

⚠️ 중요: params는 빈 객체 {}가 아닌, 사용자 메시지에서 추출한 실제 파라미터를 포함해야 합니다!

Intent 규칙:
- L0: 조회/초안/추천 (상태변경 없음) - execution_class 없음
- L1: TaskCard 생성 (업무화, 실행 없음) - execution_class 없음
- L2: 승인 후 실행 (문자발송/상태변경 등) - execution_class 필수
  - L2-A (execution_class="A"): 알림/발송 계열
  - L2-B (execution_class="B"): 도메인 변경 계열

⚠️⚠️⚠️ 필수 규칙 (절대 준수 필수) ⚠️⚠️⚠️:

1. 모든 응답에는 반드시 Intent JSON이 포함되어야 합니다.
2. Intent 이름은 반드시 위의 "사용 가능한 Intent 목록"에서 정확히 복사해서 사용하세요. 절대 임의로 만들지 마세요!
3. Intent 이름은 정확히 3개의 점(.)으로 구분된 형식입니다: "{도메인}.{타입}.{액션}"
   - 올바른 도메인: student, attendance, billing, message, class, schedule, note, ai, report, rbac, policy, system
   - 올바른 타입: query, task, exec, draft
   - 올바른 액션: 위 목록에 나열된 정확한 이름

⚠️⚠️⚠️ automation_level과 execution_class 형식 규칙 (절대 준수) ⚠️⚠️⚠️:

❌ 절대 금지 (잘못된 형식):
- "automation_level": "L2-B" ❌ (잘못됨! automation_level에 하이픈 포함 금지)
- "automation_level": "L2-A" ❌ (잘못됨! automation_level에 하이픈 포함 금지)
- "automation_level": "L2" + execution_class 없음 ❌ (L2는 execution_class 필수)

✅ 올바른 형식:
- L0 Intent:
  {
    "intent_key": "attendance.query.late",
    "automation_level": "L0",
    "params": {}
  }
  (execution_class 없음)

- L1 Intent:
  {
    "intent_key": "attendance.task.flag_absence_followup",
    "automation_level": "L1",
    "params": {}
  }
  (execution_class 없음)

- L2-A Intent:
  {
    "intent_key": "attendance.exec.notify_guardians_late",
    "automation_level": "L2",
    "execution_class": "A",
    "params": {}
  }
  (automation_level은 "L2" 문자열, execution_class는 별도 필드 "A")

- L2-B Intent:
  {
    "intent_key": "student.exec.register",
    "automation_level": "L2",
    "execution_class": "B",
    "params": {}
  }
  (automation_level은 "L2" 문자열, execution_class는 별도 필드 "B")

⚠️ 중요:
1. automation_level은 반드시 "L0", "L1", "L2" 중 하나입니다 (하이픈 없음!)
2. execution_class는 L2일 때만 존재하며, "A" 또는 "B"입니다
3. automation_level에 "L2-A", "L2-B" 같은 형식을 절대 사용하지 마세요!
4. Intent 이름은 반드시 위 목록에서 정확히 복사하세요 (임의로 만들지 마세요)
5. Intent 이름 형식: "{도메인}.{타입}.{액션}" (예: student.exec.discharge)
6. 모든 응답 끝에 Intent JSON을 반드시 포함하세요
7. 위 Few-shot 예시를 참고하여 정확한 형식으로 응답하세요`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // 상담일지 요약과 동일한 모델
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: message,
          },
        ],
        temperature: 0.3, // 상담일지 요약과 동일한 temperature
        max_tokens: 800, // Intent JSON 포함을 위해 토큰 수 증가
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      // P0: PII 마스킹 필수
      const maskedErrorText = maskPII(errorText.substring(0, 500));
      console.error('[ChatOps] OpenAI API error:', {
        status: openaiResponse.status,
        statusText: openaiResponse.statusText,
        error: maskedErrorText,
      });
      throw new Error(`OpenAI API call failed: ${openaiResponse.status}`);
    }

    let openaiData;
    try {
      openaiData = await openaiResponse.json();
    } catch (parseError) {
      // P0: PII 마스킹 필수
      const maskedParseError = maskPII(parseError);
      console.error('[ChatOps] Failed to parse OpenAI response:', maskedParseError);
      throw new Error('Failed to parse OpenAI response');
    }

    const aiResponse = openaiData.choices?.[0]?.message?.content?.trim();

    if (!aiResponse) {
      console.error('[ChatOps] AI response is empty:', {
        response_structure: Object.keys(openaiData),
      });
      throw new Error('AI 응답 생성에 실패했습니다.');
    }

    console.log('[ChatOps] AI 응답 생성 완료:', {
      response_length: aiResponse.length,
      response_preview: maskPII(aiResponse.substring(0, 200)),
      full_response: maskPII(aiResponse), // 전체 응답 로깅 (디버깅용)
    });

    // Intent 파싱 시도 (응답 끝에 JSON 형식의 Intent 정보가 있는 경우)
    console.log('[ChatOps] Intent 파싱 시작...');
    // ⚠️ 개선: 정밀한 파싱 로직 사용 (마크다운 코드 블록, 여러 형식 지원, 검증 강화)
    let parsedIntent: ChatOpsResponse['intent'] | undefined;
    try {
      const parseResult = parseIntentFromResponse(aiResponse, intentRegistry, {
        allowMarkdownCodeBlock: true,
        tryMultipleBlocks: true,
      });

      if (parseResult.success && parseResult.intent) {
        parsedIntent = {
          intent_key: parseResult.intent.intent_key,
          automation_level: parseResult.intent.automation_level,
          ...(parseResult.intent.execution_class && {
            execution_class: parseResult.intent.execution_class,
          }),
          params: parseResult.intent.params,
        };
        console.log('[ChatOps] Intent 파싱 성공:', {
          intent_key: parsedIntent.intent_key,
          automation_level: parsedIntent.automation_level,
          execution_class: parsedIntent.execution_class,
          params_keys: Object.keys(parsedIntent.params || {}),
          params_preview: maskPII(JSON.stringify(parsedIntent.params || {}).substring(0, 200)),
        });
      } else {
        // 파싱 실패는 치명적 오류가 아니므로 로그만 남기고 계속 진행
        console.log('[ChatOps] Intent 파싱 실패 (치명적 오류 아님):', {
          error_code: parseResult.error?.code,
          error_message: parseResult.error?.message,
          error_details: parseResult.error?.details,
          ai_response_preview: maskPII(aiResponse.substring(0, 500)), // AI 응답 미리보기
          user_message: maskPII(message), // 사용자 메시지 (Fallback용)
          // PII 보호를 위해 details는 제한적으로만 로깅
        });

        // Fallback: 사용자 요청에서 키워드를 분석하여 올바른 Intent 추론
        // ⚠️ 중요: 이 로직은 반드시 실행되어야 하므로 try-catch로 감싸서 안전하게 처리
        console.log('[ChatOps] Fallback: 사용자 요청 분석하여 Intent 추론 시도...', {
          user_message_preview: maskPII(message.substring(0, 100)),
          user_message_length: message.length,
        });

        try {
          // Fallback 함수 호출 전에 message가 유효한지 확인
          if (!message || typeof message !== 'string') {
            console.log('[ChatOps] Fallback 실패: message가 유효하지 않음');
          } else {
            const fallbackIntent = inferIntentFromMessage(message);
            if (fallbackIntent) {
              console.log('[ChatOps] Fallback Intent 추론 성공:', {
                intent_key: fallbackIntent.intent_key,
                automation_level: fallbackIntent.automation_level,
                execution_class: fallbackIntent.execution_class,
              });
              parsedIntent = fallbackIntent;
              console.log('[ChatOps] parsedIntent 설정 완료:', {
                intent_key: parsedIntent.intent_key,
                automation_level: parsedIntent.automation_level,
              });
            } else {
              console.log('[ChatOps] Fallback Intent 추론 실패 - 키워드 매칭 실패');
            }
          }
        } catch (fallbackError) {
          const maskedFallbackError = maskPII(fallbackError);
          console.error('[ChatOps] Fallback 실행 중 오류:', maskedFallbackError);
          // Fallback 실패는 치명적 오류가 아니므로 계속 진행
        }
      }
    } catch (parseError) {
      // 예상치 못한 오류도 치명적 오류가 아니므로 로그만 남기고 계속 진행
      // P0: PII 마스킹 필수
      const maskedParseError = maskPII(parseError);
      console.log('[ChatOps] Intent parsing error (non-fatal):', maskedParseError);

      // catch 블록에서도 Fallback 시도
      console.log('[ChatOps] Catch 블록에서 Fallback 시도...');
      if (message && typeof message === 'string') {
        const fallbackIntent = inferIntentFromMessage(message);
        if (fallbackIntent) {
          console.log('[ChatOps] Catch 블록 Fallback 성공:', {
            intent_key: fallbackIntent.intent_key,
            automation_level: fallbackIntent.automation_level,
          });
          parsedIntent = fallbackIntent;
        }
      }
    }

    // Intent JSON 블록 제거 (사용자에게는 자연어 응답만 표시)
    // ⚠️ 개선: 정밀한 제거 로직 사용 (마크다운 코드 블록, 여러 형식 지원)
    let cleanResponse = removeIntentJsonFromResponse(aiResponse);

    // L0 Intent 실행 (조회/초안)
    // 챗봇.md 6.1: L0 Intent는 TaskCard 생성 없이 즉시 실행
    let l0ExecutionResult: unknown = undefined;
    if (parsedIntent && parsedIntent.automation_level === 'L0') {
      console.log('[ChatOps] L0 Intent 실행 시작:', {
        intent_key: parsedIntent.intent_key,
      });
      try {
        if (hasL0Handler(parsedIntent.intent_key)) {
          const handler = getL0Handler(parsedIntent.intent_key);
          if (handler) {
            // JWT에서 user_id 추출
            let userId = 'system'; // 기본값
            try {
              if (authHeader) {
                const token = authHeader.replace('Bearer ', '');
                const { data: { user } } = await supabase.auth.getUser(token);
                if (user) {
                  userId = user.id;
                }
              }
            } catch (userError) {
              // user_id 추출 실패는 치명적 오류가 아니므로 기본값 사용
              console.log('[ChatOps] Failed to extract user_id from JWT, using default');
            }

            const handlerContext = {
              tenant_id: tenant_id,
              user_id: userId,
              supabase: supabase,
            };

            // 파라미터 정규화 (범용 변환 규칙 적용)
            const normalizedParams = await normalizeParams(
              parsedIntent.params || {},
              parsedIntent.intent_key,
              supabase,
              tenant_id
            );

            const result = await handler.execute(normalizedParams, handlerContext);

            if (result.success && result.data) {
              l0ExecutionResult = result.data;
              // ⚠️ 중요: L0 실행 결과는 l0_result 필드로만 반환
              // cleanResponse에는 추가하지 않음 (프론트엔드에서 별도로 표시)
              console.log('[ChatOps] L0 Intent 실행 성공:', {
                intent_key: parsedIntent.intent_key,
                result_preview: maskPII(JSON.stringify(result.data).substring(0, 200)),
              });
            } else {
              // L0 실행 실패 시 에러 메시지 추가
              const errorMsg = result.error?.message || '조회에 실패했습니다.';
              cleanResponse = `${cleanResponse}\n\n[오류] ${errorMsg}`;
              console.log('[ChatOps] L0 Intent 실행 실패:', {
                intent_key: parsedIntent.intent_key,
                error_code: result.error?.code,
                error_message: result.error?.message,
              });
            }
          }
        } else {
          // L0 핸들러가 없는 경우 로그만 남기고 계속 진행
          console.log('[ChatOps] L0 Handler not found:', {
            intent_key: parsedIntent.intent_key,
          });
        }
      } catch (l0Error) {
        // P0: PII 마스킹 필수
        const maskedL0Error = maskPII(l0Error);
        console.error('[ChatOps] L0 Intent execution error:', maskedL0Error);
        // L0 실행 실패는 치명적 오류가 아니므로 로그만 남기고 계속 진행
        cleanResponse = `${cleanResponse}\n\n[오류] 조회 실행 중 오류가 발생했습니다.`;
      }
    }

    // L1/L2 Intent TaskCard 생성 (업무화/승인 후 실행)
    // 챗봇.md 6.2, 6.3: L1은 TaskCard 생성(업무화), L2는 TaskCard 생성 후 승인 시 실행
    let taskCardId: string | undefined = undefined;
    if (parsedIntent && (parsedIntent.automation_level === 'L1' || parsedIntent.automation_level === 'L2')) {
      console.log('[ChatOps] L1/L2 Intent TaskCard 생성 시작:', {
        intent_key: parsedIntent.intent_key,
        automation_level: parsedIntent.automation_level,
        execution_class: parsedIntent.execution_class,
      });
      try {
        // Intent Registry에서 Intent 정보 조회
        const intent = intentRegistry[parsedIntent.intent_key];
        if (!intent) {
          console.log('[ChatOps] Intent not found in registry:', {
            intent_key: parsedIntent.intent_key,
          });
          // Intent가 Registry에 없어도 응답은 반환 (자연어 응답은 이미 생성됨)
        } else {
          // JWT에서 user_id 추출
          let userId = 'system'; // 기본값
          try {
            if (authHeader) {
              const token = authHeader.replace('Bearer ', '');
              const { data: { user } } = await supabase.auth.getUser(token);
              if (user) {
                userId = user.id;
              }
            }
          } catch (userError) {
            // user_id 추출 실패는 치명적 오류가 아니므로 기본값 사용
            console.log('[ChatOps] Failed to extract user_id from JWT, using default');
          }

          // Policy에서 priority 조회
          // ⚠️ ChatOps는 사용자 직접 요청 기능이므로 기본값 제공 (다른 자동화와 차별화)
          // 다른 자동화 함수들은 모두 Fail-Closed를 따르지만, ChatOps는 사용자 경험을 위해 기본값 사용
          const priorityPolicyPath = `chatops.taskcard.priority`;
          console.log('[ChatOps] Policy에서 priority 조회 중...', {
            policy_path: priorityPolicyPath,
          });
          const priority = await getTenantSettingByPath(
            supabase,
            tenant_id,
            priorityPolicyPath
          );

          // ChatOps 기본 priority: 50 (사용자 직접 요청 기능이므로 기본값 제공)
          // ⚠️ 참고: 다른 자동화 함수들은 모두 Fail-Closed를 따르지만, ChatOps는 사용자 경험을 위해 예외
          const priorityValue = priority !== null && priority !== undefined && typeof priority === 'number'
            ? priority
            : 50; // 기본값 50 (ChatOps 전용 예외)

          if (priority === null || priority === undefined) {
            console.log('[ChatOps] Priority policy 없음, 기본값(50) 사용 (ChatOps 전용 예외):', {
              intent_key: parsedIntent.intent_key,
              policy_path: priorityPolicyPath,
              default_priority: priorityValue,
            });
          } else {
            console.log('[ChatOps] Priority 조회 성공:', {
              priority: priorityValue,
              from_policy: true,
            });
          }

          // priority 검증 (0-100 범위)
          if (priorityValue < 0 || priorityValue > 100) {
            console.error('[ChatOps] Invalid priority value:', {
              intent_key: parsedIntent.intent_key,
              priority: priorityValue,
            });
            cleanResponse = `${cleanResponse}\n\n[오류] TaskCard 생성에 실패했습니다. Priority 값이 유효하지 않습니다.`;
          } else {
            // 간소화된 Plan 생성
            // Edge Function 환경에서는 packages/chatops-intents를 직접 import할 수 없으므로 간소화된 버전 사용
            const targetStudentIds = Array.isArray(parsedIntent.params?.student_ids)
              ? parsedIntent.params.student_ids as string[]
              : [];

            console.log('[ChatOps] Plan 생성 중...', {
              target_student_count: targetStudentIds.length,
            });

            const plan: any = {
              schema_version: 'chatops.plan.v1',
              intent_key: parsedIntent.intent_key,
              params: parsedIntent.params || {},
              automation_level: intent.automation_level,
              ...(intent.automation_level === 'L2' && intent.execution_class && {
                execution_class: intent.execution_class,
                // L2-A Intent의 경우 event_type은 Registry에서 가져올 수 없으므로
                // 실제 구현 시에는 packages/chatops-intents의 Registry를 참조해야 함
                // 현재는 간소화된 버전이므로 event_type은 생략
              }),
              plan_snapshot: {
                summary: cleanResponse.substring(0, 200), // 자연어 응답의 일부를 summary로 사용
                target_count: targetStudentIds.length,
                targets: {
                  kind: 'student_id_list',
                  student_ids: targetStudentIds,
                },
              },
              security: {
                requested_by_user_id: userId,
                requested_at_utc: new Date().toISOString(),
              },
            };

            // TaskCard 생성 (간소화된 버전)
            // entity_id 및 entity_type 결정: SSOT Registry의 taskcard.entity_type 규칙 반영
            // ⚠️ 중요: SSOT Registry(packages/chatops-intents/src/registry.ts)의 taskcard.entity_type 규칙 준수
            // ⚠️ 업종 중립성: entity_type은 업종과 무관하게 Core Party 개념 사용
            //   - 'student': Core Party의 person_type='student' (업종별로 customer, client, member 등으로 매핑되지만 entity_type은 'student'로 통일)
            //   - 'tenant': 테넌트 레벨 작업
            //   - 'class': 업종별 클래스/서비스/프로그램 (업종별로 class, service, program 등으로 매핑되지만 entity_type은 'class'로 통일)
            //   - 'billing': 청구 관련 엔티티 (특수 케이스)
            // ⚠️ 확장성: 새로운 업종 추가 시에도 entity_type은 변경되지 않음 (업종별 매핑은 Industry Adapter에서 처리)
            // - student.*: 항상 'student' (학생 등록 등 targetStudentIds가 비어있어도 'student')
            // - attendance.*: student_ids가 있으면 'student', 없으면 'tenant' (대량 작업)
            // - billing.*: 대부분 'tenant', 일부 'student' (payment_link, manual_payment 등)
            // - message.*: student_id가 있으면 'student', 없으면 'tenant'
            // - class.*: class_id가 있으면 'class', 없으면 'tenant'
            // - schedule.*: class_id가 있으면 'class', 없으면 'tenant'
            // - note.*: 항상 'student'
            // - ai.*: student_id가 있으면 'student', 없으면 'tenant'
            // - report.*, system.*, policy.*, rbac.*: 항상 'tenant'

            const intentKey = parsedIntent.intent_key;
            const domainParts = intentKey.split('.');
            const domain = domainParts[0];

            // ⚠️ 디버깅: domain 파싱 확인 (필수)
            console.log('[ChatOps] Intent domain 파싱:', {
              intent_key: intentKey,
              domain: domain,
              domain_parts: domainParts,
              domain_parts_length: domainParts.length,
            });

            // entity_type 및 entity_id 결정 로직 (SSOT Registry 규칙 반영)
            let entityType: string;
            let entityId: string;

            console.log('[ChatOps] domain 비교 시작:', {
              domain: domain,
              is_student: domain === 'student',
              domain_type: typeof domain,
            });

            if (domain === 'student') {
              console.log('[ChatOps] ✅ domain === "student" 조건 통과!');
              // student.* Intent는 항상 entity_type='student' (SSOT Registry 규칙)
              entityType = 'student';
              // ⚠️ 중요: 학생 등록(student.exec.register)의 경우 targetStudentIds가 비어있으므로 entityId=tenant_id
              // 이것은 정상이며, 학생이 등록되면 TaskCard의 entity_id를 업데이트해야 함
              entityId = targetStudentIds.length > 0 ? targetStudentIds[0] : tenant_id;

              console.log('[ChatOps] student 도메인 entity 결정:', {
                intent_key: intentKey,
                target_student_ids_count: targetStudentIds.length,
                entity_type: entityType,
                entity_id: entityId.substring(0, 8) + '...',
                is_register: intentKey === 'student.exec.register',
                entity_id_is_tenant: entityId === tenant_id,
              });
            } else if (domain === 'attendance') {
              // attendance.*: student_ids가 있으면 'student', 없으면 'tenant' (대량 작업)
              if (targetStudentIds.length > 0) {
                entityType = 'student';
                entityId = targetStudentIds[0];
              } else {
                entityType = 'tenant';
                entityId = tenant_id;
              }
            } else if (domain === 'billing') {
              // billing.*: 대부분 'tenant', 일부 'student', 일부 'billing' (SSOT Registry 규칙)
              // SSOT Registry: payment_link, manual_payment, discount, refund, installment_plan은 'student'
              // SSOT Registry: reissue_invoice는 'billing' (특수 케이스)
              const studentBillingIntents = [
                'billing.exec.send_payment_link',
                'billing.exec.record_manual_payment',
                'billing.exec.apply_discount',
                'billing.exec.apply_refund',
                'billing.exec.create_installment_plan',
              ];
              const billingEntityIntents = [
                'billing.exec.reissue_invoice',
              ];
              if (studentBillingIntents.includes(intentKey) && targetStudentIds.length > 0) {
                entityType = 'student';
                entityId = targetStudentIds[0];
              } else if (billingEntityIntents.includes(intentKey)) {
                // billing entity_type: entity_id는 invoice_id 또는 tenant_id
                // SSOT Registry: reissue_invoice는 'billing' entity_type
                entityType = 'billing';
                entityId = parsedIntent.params?.invoice_id as string | undefined || tenant_id;
              } else {
                entityType = 'tenant';
                entityId = tenant_id;
              }
            } else if (domain === 'message') {
              // message.*: student_id가 있으면 'student', 없으면 'tenant'
              const studentId = targetStudentIds.length > 0 ? targetStudentIds[0] : (parsedIntent.params?.student_id as string | undefined);
              if (studentId) {
                entityType = 'student';
                entityId = studentId;
              } else {
                entityType = 'tenant';
                entityId = tenant_id;
              }
            } else if (domain === 'class') {
              // class.*: class_id가 있으면 'class', 없으면 'tenant'
              const classId = parsedIntent.params?.class_id as string | undefined;
              if (classId) {
                entityType = 'class';
                entityId = classId;
              } else {
                entityType = 'tenant';
                entityId = tenant_id;
              }
            } else if (domain === 'schedule') {
              // schedule.*: class_id가 있으면 'class', 없으면 'tenant'
              const classId = parsedIntent.params?.class_id as string | undefined;
              if (classId) {
                entityType = 'class';
                entityId = classId;
              } else {
                entityType = 'tenant';
                entityId = tenant_id;
              }
            } else if (domain === 'note') {
              // note.*: 항상 'student' (SSOT Registry 규칙)
              entityType = 'student';
              const studentId = targetStudentIds.length > 0 ? targetStudentIds[0] : (parsedIntent.params?.student_id as string | undefined);
              entityId = studentId || tenant_id;
            } else if (domain === 'ai') {
              // ai.*: student_id가 있으면 'student', 없으면 'tenant'
              const studentId = targetStudentIds.length > 0 ? targetStudentIds[0] : (parsedIntent.params?.student_id as string | undefined);
              if (studentId) {
                entityType = 'student';
                entityId = studentId;
              } else {
                entityType = 'tenant';
                entityId = tenant_id;
              }
            } else if (domain === 'report' || domain === 'system' || domain === 'policy' || domain === 'rbac') {
              // report.*, system.*, policy.*, rbac.*: 항상 'tenant' (SSOT Registry 규칙)
              entityType = 'tenant';
              entityId = tenant_id;
            } else {
              // 기본값: targetStudentIds가 있으면 'student', 없으면 'tenant'
              console.log('[ChatOps] ⚠️ 기본값 블록 실행 (domain이 매칭되지 않음):', {
                domain: domain,
                intent_key: intentKey,
                target_student_ids_count: targetStudentIds.length,
              });
              if (targetStudentIds.length > 0) {
                entityType = 'student';
                entityId = targetStudentIds[0];
              } else {
                entityType = 'tenant';
                entityId = tenant_id;
              }
            }

            // ⚠️ 최종 검증: student.exec.register는 반드시 entity_type='student'여야 함
            if (intentKey === 'student.exec.register' && entityType !== 'student') {
              console.error('[ChatOps] ⚠️⚠️⚠️ 치명적 오류: student.exec.register인데 entity_type이 student가 아님!', {
                intent_key: intentKey,
                entity_type: entityType,
                domain: domain,
                target_student_ids_count: targetStudentIds.length,
              });
              // 강제로 수정
              entityType = 'student';
              entityId = targetStudentIds.length > 0 ? targetStudentIds[0] : tenant_id;
              console.log('[ChatOps] ✅ entity_type을 강제로 student로 수정:', {
                entity_type: entityType,
                entity_id: entityId.substring(0, 8) + '...',
              });
            }

            // dedup_key 생성 (간소화된 버전)
            // 챗봇.md: dedup_key 포맷 "{tenantId}:{trigger}:{entityType}:{entityId}:{window}"
            // ⚠️ P1: 날짜 처리 - toKSTDate() 사용 (체크리스트 준수)
            const window = toKSTDate(); // YYYY-MM-DD (KST 기준)
            const dedupEntityId = entityType === 'tenant' ? 'global' : entityId;
            const dedupKey = `${tenant_id}:chatops:${entityType}:${dedupEntityId}:${window}`;

            // action_url 생성 (SSOT: packages/chatops-intents/src/taskcard.ts 참조)
            // ⚠️ 중요: entity_type과 entity_id에 따라 적절한 URL 생성
            // SSOT 규칙: entity_type='student'이면 `/students/${entityId}/tasks`
            // 단, 학생 등록의 경우 entity_id=tenant_id이므로 특수 처리
            let actionUrl = '';
            if (entityType === 'student') {
              // 학생 등록의 경우 entity_id=tenant_id이므로, TaskCard 목록 페이지로 이동
              // 학생이 등록되면 TaskCard의 entity_id를 업데이트해야 함
              if (intentKey === 'student.exec.register' && entityId === tenant_id) {
                actionUrl = '/students/tasks';
              } else {
                // 일반 학생 TaskCard: `/students/${entityId}/tasks`
                actionUrl = `/students/${entityId}/tasks`;
              }
            } else if (entityType === 'class') {
              actionUrl = `/classes/${entityId}/tasks`;
            } else if (entityType === 'billing') {
              // billing entity_type: 청구 관련 TaskCard
              actionUrl = '/billing/tasks';
            } else {
              // tenant, report, system 등: `/tasks/${dedupKey}` (SSOT 규칙)
              // dedupKey는 아직 생성되지 않았으므로 임시로 '/tasks' 사용
              actionUrl = '/tasks';
            }

            // title 생성 (자연어 응답에서 추출 또는 Intent 키 변환)
            // ⚠️ 참고: Edge Function의 intent-registry는 간소화된 버전이라 description이 없음
            // 자연어 응답(cleanResponse)의 첫 줄을 title로 사용하거나, intent_key를 변환
            let taskCardTitle = '';
            if (cleanResponse && cleanResponse.trim().length > 0) {
              // 자연어 응답의 첫 줄 추출 (최대 50자)
              const firstLine = cleanResponse.split('\n')[0].trim();
              taskCardTitle = firstLine.length > 50
                ? firstLine.substring(0, 50) + '...'
                : firstLine;
            } else {
              // Fallback: intent_key를 읽기 쉬운 형식으로 변환
              taskCardTitle = parsedIntent.intent_key
                .replace(/\./g, ' ')
                .replace(/\b\w/g, (l) => l.toUpperCase());
            }

            // TaskCard 생성
            // ⚠️ 중요: service_role을 사용하므로 RPC 대신 직접 INSERT (RLS 우회)
            console.log('[ChatOps] ===== TaskCard 생성 디버깅 시작 =====');
            console.log('[ChatOps] entity_type/entity_id 최종 결정:', {
              intent_key: intentKey,
              domain: domain,
              entity_type: entityType,
              entity_id: entityId.substring(0, 8) + '...',
              entity_id_is_tenant: entityId === tenant_id,
              target_student_ids_count: targetStudentIds.length,
            });
            console.log('[ChatOps] TaskCard 생성 시도...', {
              tenant_id: tenant_id.substring(0, 8) + '...',
              entity_id: entityId.substring(0, 8) + '...',
              entity_type: entityType,
              dedup_key: dedupKey,
              priority: priorityValue,
              intent_key: intentKey,
              action_url: actionUrl,
              title: taskCardTitle,
              student_id: entityType === 'student' ? entityId.substring(0, 8) + '...' : null,
            });

            try {
              // ⚠️ 문서 준수: 프론트 자동화.md 2.3 섹션 - Supabase client upsert() 직접 사용 가능
              // service_role을 사용하므로 RLS 우회하여 직접 INSERT 가능
              // ⚠️ 중요: 부분 인덱스(WHERE dedup_key IS NOT NULL AND status = 'pending')는 Supabase client의 onConflict와 호환되지 않음
              // 따라서 먼저 기존 레코드를 확인하고, 있으면 업데이트, 없으면 삽입하는 방식 사용

              const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
              const updatedAt = new Date().toISOString();

              // 먼저 기존 레코드 확인 (부분 인덱스 조건: dedup_key IS NOT NULL AND status = 'pending')
              console.log('[ChatOps] 기존 TaskCard 확인 중...', {
                tenant_id: tenant_id.substring(0, 8) + '...',
                dedup_key: dedupKey,
              });
              const { data: existingCard, error: checkError } = await supabase
                .from('task_cards')
                .select('id, tenant_id, entity_id, entity_type, task_type, dedup_key, status, created_at, updated_at, priority')
                .eq('tenant_id', tenant_id)
                .eq('dedup_key', dedupKey)
                .eq('status', 'pending')
                .maybeSingle();

              console.log('[ChatOps] 기존 TaskCard 확인 결과:', {
                found: !!existingCard,
                error: checkError ? maskPII(checkError) : null,
                card_id: existingCard?.id?.substring(0, 8) + '...',
                card_entity_type: existingCard?.entity_type,
                card_status: existingCard?.status,
              });

              let taskCardData: any = null;
              let taskCardError: any = null;

              if (existingCard) {
                // 기존 레코드 업데이트 (RPC 함수의 DO UPDATE 로직과 동일)
                // ⚠️ 중요: action_url은 NOT NULL이므로 업데이트하지 않음 (기존 값 유지)
                const { data: updatedCard, error: updateError } = await supabase
                  .from('task_cards')
                  .update({
                    updated_at: updatedAt,
                    priority: Math.max(existingCard.priority || 0, priorityValue),
                    suggested_action: plan,
                    description: cleanResponse.substring(0, 500),
                    // action_url은 업데이트하지 않음 (RPC 함수: COALESCE(EXCLUDED.action_url, task_cards.action_url))
                  })
                  .eq('id', existingCard.id)
                  .select('id, tenant_id, entity_id, entity_type, task_type, dedup_key, status, created_at, updated_at')
                  .single();

                taskCardData = updatedCard;
                taskCardError = updateError;
              } else {
                // 새 레코드 삽입 시도
                // ⚠️ 중요: action_url은 NOT NULL이므로 빈 문자열로 설정
                const insertData = {
                  tenant_id: tenant_id,
                  entity_id: entityId,
                  entity_type: entityType,
                  task_type: 'ai_suggested',
                  source: 'chatops',
                  priority: priorityValue,
                  title: taskCardTitle,
                  description: cleanResponse.substring(0, 500),
                  action_url: actionUrl,
                  expires_at: expiresAt,
                  dedup_key: dedupKey,
                  status: 'pending',
                  suggested_action: plan,
                    // student_id 설정: entity_type='student'일 때 entity_id와 동일하게 설정 (레거시 호환)
                    // ⚠️ 중요: 마이그레이션 126의 CHECK 제약조건: entity_type='student'이면 student_id = entity_id AND student_id IS NOT NULL
                    // 학생 등록의 경우 entity_id=tenant_id이므로 student_id=tenant_id로 설정됨 (CHECK 제약조건 만족)
                    student_id: entityType === 'student' ? entityId : null,
                  updated_at: updatedAt,
                };

                console.log('[ChatOps] TaskCard 삽입 데이터:', {
                  tenant_id: tenant_id.substring(0, 8) + '...',
                  entity_id: entityId.substring(0, 8) + '...',
                  entity_type: entityType,
                  task_type: insertData.task_type,
                  source: insertData.source,
                  priority: insertData.priority,
                  title: insertData.title.substring(0, 50),
                  action_url: insertData.action_url,
                  dedup_key: insertData.dedup_key,
                  status: insertData.status,
                  student_id: insertData.student_id ? insertData.student_id.substring(0, 8) + '...' : null,
                });

                const { data: insertedCard, error: insertError } = await supabase
                  .from('task_cards')
                  .insert(insertData)
                  .select('id, tenant_id, entity_id, entity_type, task_type, dedup_key, status, created_at, updated_at')
                  .single();

                console.log('[ChatOps] TaskCard 삽입 결과:', {
                  success: !!insertedCard,
                  error: insertError ? maskPII(insertError) : null,
                  card_id: insertedCard?.id?.substring(0, 8) + '...',
                  card_entity_type: insertedCard?.entity_type,
                  card_status: insertedCard?.status,
                });

                if (insertError) {
                  // unique_violation 오류인 경우 (race condition), 다시 조회
                  if (insertError.code === '23505') {
                    console.log('[ChatOps] TaskCard 삽입 중 중복 감지, 기존 레코드 재조회 중...');
                    const { data: retryCard } = await supabase
                      .from('task_cards')
                      .select('id, tenant_id, entity_id, entity_type, task_type, dedup_key, status, created_at, updated_at')
                      .eq('tenant_id', tenant_id)
                      .eq('dedup_key', dedupKey)
                      .eq('status', 'pending')
                      .single();

                    if (retryCard) {
                      taskCardData = retryCard;
                      taskCardError = null;
                    } else {
                      taskCardError = insertError;
                    }
                  } else {
                    taskCardError = insertError;
                  }
                } else {
                  taskCardData = insertedCard;
                }
              }

              if (taskCardError) {
                // 중복 키 오류인 경우 기존 레코드 조회 (RPC 함수 EXCEPTION 처리와 동일)
                if (taskCardError.code === '23505') { // unique_violation
                  console.log('[ChatOps] TaskCard 중복 감지, 기존 레코드 조회 중...');
                  const { data: existingCard } = await supabase
                    .from('task_cards')
                    .select('id, tenant_id, entity_id, entity_type, task_type, dedup_key, status, created_at, updated_at')
                    .eq('tenant_id', tenant_id)
                    .eq('dedup_key', dedupKey)
                    .single();

                  if (existingCard) {
                    taskCardId = existingCard.id;
                    cleanResponse = `${cleanResponse}\n\n[업무 카드 생성 완료] TaskCard ID: ${taskCardId}`;
                    console.log('[ChatOps] TaskCard 조회 성공 (중복):', {
                      task_card_id: taskCardId,
                      intent_key: parsedIntent.intent_key,
                    });
                  } else {
                    throw taskCardError;
                  }
                } else {
                  throw taskCardError;
                }
              } else if (taskCardData) {
                taskCardId = taskCardData.id;
                cleanResponse = `${cleanResponse}\n\n[업무 카드 생성 완료] TaskCard ID: ${taskCardId}`;
                console.log('[ChatOps] ===== TaskCard 생성 성공 =====');
                console.log('[ChatOps] TaskCard 생성 성공:', {
                  task_card_id: taskCardId,
                  tenant_id: tenant_id.substring(0, 8) + '...',
                  entity_id: taskCardData.entity_id?.substring(0, 8) + '...',
                  entity_type: taskCardData.entity_type,
                  task_type: taskCardData.task_type,
                  dedup_key: taskCardData.dedup_key,
                  status: taskCardData.status,
                  created_at: taskCardData.created_at,
                  intent_key: parsedIntent.intent_key,
                  automation_level: intent.automation_level,
                  execution_class: intent.execution_class,
                });

                // 생성된 TaskCard를 다시 조회하여 모든 필드 확인
                const { data: verifyCard, error: verifyError } = await supabase
                  .from('task_cards')
                  .select('*')
                  .eq('id', taskCardId)
                  .single();

                console.log('[ChatOps] TaskCard 검증 조회 결과:', {
                  found: !!verifyCard,
                  error: verifyError ? maskPII(verifyError) : null,
                  entity_type: verifyCard?.entity_type,
                  entity_id: verifyCard?.entity_id?.substring(0, 8) + '...',
                  student_id: verifyCard?.student_id?.substring(0, 8) + '...',
                  status: verifyCard?.status,
                  expires_at: verifyCard?.expires_at,
                  action_url: verifyCard?.action_url,
                });
              } else {
                throw new Error('TaskCard 생성 결과가 없습니다.');
              }
            } catch (taskCardInsertError) {
              const maskedError = maskPII(taskCardInsertError);
              console.error('[ChatOps] TaskCard 생성 실패:', {
                intent_key: parsedIntent.intent_key,
                automation_level: intent.automation_level,
                error: maskedError,
              });
              cleanResponse = `${cleanResponse}\n\n[오류] TaskCard 생성에 실패했습니다.`;
            }
          }
        }
      } catch (taskCardError) {
        // P0: PII 마스킹 필수
        const maskedTaskCardError = maskPII(taskCardError);
        console.error('[ChatOps] TaskCard creation error:', maskedTaskCardError);
        // TaskCard 생성 실패는 치명적 오류가 아니므로 로그만 남기고 계속 진행
        cleanResponse = `${cleanResponse}\n\n[오류] TaskCard 생성 중 오류가 발생했습니다.`;
      }
    }

    // ⚠️ 중요: 응답 반환 전 Fallback 강제 실행 (parsedIntent가 없고 사용자 메시지가 있는 경우)
    // 이 로직은 반드시 실행되어야 하므로 try-catch로 감싸서 안전하게 처리
    if (!parsedIntent && message && typeof message === 'string') {
      console.log('[ChatOps] parsedIntent가 없음 - Fallback 강제 실행 (응답 반환 전)...', {
        message_preview: maskPII(message.substring(0, 50)),
        message_length: message.length,
      });
      try {
        const fallbackIntent = inferIntentFromMessage(message);
        if (fallbackIntent) {
          console.log('[ChatOps] Fallback 강제 실행 성공:', {
            intent_key: fallbackIntent.intent_key,
            automation_level: fallbackIntent.automation_level,
            execution_class: fallbackIntent.execution_class,
          });
          parsedIntent = fallbackIntent;
          console.log('[ChatOps] parsedIntent 최종 설정 완료:', {
            intent_key: parsedIntent.intent_key,
            automation_level: parsedIntent.automation_level,
          });
        } else {
          console.log('[ChatOps] Fallback 강제 실행 실패 - 키워드 매칭 실패');
        }
      } catch (fallbackError) {
        const maskedFallbackError = maskPII(fallbackError);
        console.error('[ChatOps] Fallback 강제 실행 중 오류:', maskedFallbackError);
      }
    }

    // 응답 반환
    console.log('[ChatOps] ===== 작업 완료 =====');
    console.log('[ChatOps] 최종 응답 상태:', {
      has_intent: !!parsedIntent,
      intent_key: parsedIntent?.intent_key,
      automation_level: parsedIntent?.automation_level,
      has_l0_result: !!l0ExecutionResult,
      has_task_card: !!taskCardId,
      task_card_id: taskCardId,
      response_length: cleanResponse.length,
    });

    const response: ChatOpsResponse = {
      response: cleanResponse,
      intent: parsedIntent,
      l0_result: l0ExecutionResult, // L0 실행 결과 포함
      task_card_id: taskCardId, // L1/L2 Intent의 경우 생성된 TaskCard ID
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // P0: PII 마스킹 필수
    const maskedError = maskPII(error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[ChatOps] Fatal error:', maskedError);
    if (errorStack) {
      // P0: PII 마스킹 필수 (스택 트레이스에도 PII가 포함될 수 있음)
      const maskedStack = maskPII(errorStack);
      console.error('[ChatOps] Error stack:', maskedStack);
    }
    return new Response(
      JSON.stringify({
        error: 'AI response generation failed',
        message: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

