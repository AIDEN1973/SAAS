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
import { withTenant } from '../_shared/withTenant.ts';
import { toKSTDate } from '../_shared/date-utils.ts';
import { computeMissingRequired } from '../_shared/compute-missing-required.ts';
import { assertAutomationEventType } from '../_shared/automation-event-catalog.ts';
import type { SuggestedActionChatOpsPlanV1 } from '../execute-student-task/handlers/types.ts';
import { ContractErrorCategory } from '../execute-student-task/handlers/types.ts';
import { shouldUseWorker, createJob } from '../_shared/job-utils.ts';
import { runAllPreflightChecks, type HealthCheckResult } from '../execute-student-task/handlers/system-exec-run_healthcheck.ts';
import { getTenantTableName } from '../_shared/industry-adapter.ts';
import { createExecutionAuditRecord } from '../_shared/execution-audit-utils.ts';
import { normalizeParams as normalizeParamsShared } from '../_shared/normalize-params.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface ChatOpsRequest {
  session_id: string;
  message: string;
  action?: 'message' | 'draft_apply' | 'draft_confirm' | 'draft_cancel'; // 기본값: 'message'
  draft_id?: string; // draft_apply/confirm/cancel 시 필요
  draft_params?: Record<string, unknown>; // draft_apply 시 파라미터 업데이트
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
  original_message?: string; // 원본 사용자 메시지 (필터링용)
  // Draft 관련 필드 (Inline Execution)
  draft_id?: string;
  draft_status?: 'collecting' | 'ready' | 'executed' | 'cancelled';
  missing_required?: string[];
  next_question?: string; // 다음 질문 템플릿
  summary?: string; // ready 상태일 때 실행 요약
  confirm_required?: boolean; // 확인 필요 여부
}

/**
 * Intent 후보 추출 (Resolver 구조: 후보→선택)
 *
 * Registry의 examples 필드와 키워드를 기반으로 사용자 메시지와 유사한 Intent 후보를 추출합니다.
 * 이 함수는 나중에 임베딩 기반 검색으로 교체 가능하도록 구조를 고정합니다.
 *
 * @param message 사용자 메시지
 * @param maxCandidates 최대 후보 수 (기본값: 10)
 * @returns Intent 후보 목록 (intent_key, score, reason)
 */
function extractIntentCandidates(
  message: string,
  maxCandidates: number = 10
): Array<{ intent_key: string; score: number; reason: string }> {
  const lowerMessage = message.toLowerCase();
  const candidates: Array<{ intent_key: string; score: number; reason: string }> = [];

  // Registry의 모든 Intent를 순회하며 유사도 계산
  for (const [intentKey, intent] of Object.entries(intentRegistry)) {
    let score = 0;
    const reasons: string[] = [];

    // 1. examples 필드 기반 매칭 (가장 높은 가중치)
    let hasExampleMatch = false;
    let bestExampleScore = 0;
    if (intent.examples && intent.examples.length > 0) {
      for (const example of intent.examples) {
        const lowerExample = example.toLowerCase();
        let exampleScore = 0;

        // 정확히 일치 (최고 점수)
        if (lowerMessage === lowerExample) {
          exampleScore = 30; // 점수 증가
          hasExampleMatch = true;
          reasons.push(`예시 정확 일치: "${example}"`);
        }
        // 부분 일치 (최소 길이 요구사항 추가)
        else if (lowerExample.length >= 5 && (lowerMessage.includes(lowerExample) || lowerExample.includes(lowerMessage))) {
          // 부분 일치 시 길이 비율에 따라 점수 조정
          const overlapRatio = Math.min(lowerMessage.length, lowerExample.length) / Math.max(lowerMessage.length, lowerExample.length);
          if (overlapRatio >= 0.7) { // 60% -> 70%로 강화
            exampleScore = Math.floor(12 * overlapRatio); // 8 -> 12로 증가
            hasExampleMatch = true;
            reasons.push(`예시 부분 일치: "${example}" (${Math.floor(overlapRatio * 100)}%)`);
          }
        }
        // 키워드 일치 (최소 2개 이상 키워드 매칭 요구, 중요 키워드 가중치)
        else {
          const exampleWords = lowerExample.split(/\s+/).filter(w => w.length >= 2);
          const matchedWords = exampleWords.filter(word => lowerMessage.includes(word));

          // 중요 키워드 확인 (도메인 특화 키워드)
          const importantKeywords = ['지각', '결석', '출석', '출결', '연체', '미납', '프로필', '검색'];
          const matchedImportant = matchedWords.filter(w => importantKeywords.some(kw => w.includes(kw) || kw.includes(w)));

          if (matchedWords.length >= 2) {
            // 중요 키워드가 매칭되면 추가 점수
            const baseScore = matchedWords.length * 2;
            const importantBonus = matchedImportant.length * 3;
            exampleScore = baseScore + importantBonus;
            hasExampleMatch = true;
            reasons.push(`예시 키워드 일치: ${matchedWords.join(', ')}${matchedImportant.length > 0 ? ` (중요 키워드: ${matchedImportant.join(', ')})` : ''}`);
          }
        }

        // 최고 점수 업데이트 (여러 examples 중 최고 점수만 사용)
        if (exampleScore > bestExampleScore) {
          bestExampleScore = exampleScore;
        }
      }

      // 최고 점수만 추가 (중복 점수 방지)
      score += bestExampleScore;
    }

    // 2. description 기반 매칭 (examples 매칭이 없을 때만 높은 점수)
    if (intent.description) {
      const lowerDesc = intent.description.toLowerCase();
      if (lowerMessage.includes(lowerDesc)) {
        if (hasExampleMatch) {
          score += 1; // examples가 있으면 낮은 점수
        } else {
          score += 5; // examples가 없으면 높은 점수
        }
        reasons.push(`설명 일치: "${intent.description}"`);
      }
    }

    // 3. intent_key 기반 키워드 매칭 (도메인/타입/액션)
    const parts = intentKey.split('.');
    if (parts.length === 3) {
      const [domain, type, action] = parts;

      // 도메인 키워드
      const domainKeywords: Record<string, string[]> = {
        'student': ['학생', '대상', '회원', '원생', '수강생'],
        'attendance': ['출결', '출석', '지각', '결석', '조퇴', '나온', '안온', '불참'],
        'billing': ['수납', '청구', '결제', '납부', '연체', '환불', '미납', '미결제', '돈', '요금', '비용'],
        'message': ['문자', '메시지', '알림', '공지'],
        'class': ['반', '수업', '클래스'],
        'schedule': ['일정', '스케줄', '시간표'],
        'report': ['리포트', '보고서', '요약', '현황'],
      };

      const domainKw = domainKeywords[domain] || [];
      if (domainKw.some(kw => lowerMessage.includes(kw))) {
        if (hasExampleMatch) {
          score += 1; // examples가 있으면 낮은 점수
        } else {
          score += 2; // examples가 없으면 기본 점수
        }
        reasons.push(`도메인 키워드: ${domain}`);
      }

      // 타입 키워드 (query 타입에 더 높은 가중치)
      const typeKeywords: Record<string, string[]> = {
        'query': ['조회', '검색', '찾기', '확인', '보기', '보여줘', '보여주세요', '애들', '목록', '리스트', '현황'],
        'exec': ['실행', '처리', '해', '시켜', '하기', '해줘', '해주세요'],
        'task': ['업무', '작업', '태스크'],
        'draft': ['초안', '작성', '만들기'],
      };

      const typeKw = typeKeywords[type] || [];
      const matchedTypeKw = typeKw.filter(kw => lowerMessage.includes(kw));
      if (matchedTypeKw.length > 0) {
        if (hasExampleMatch) {
          score += 0.5; // examples가 있으면 매우 낮은 점수
        } else {
          // query 타입은 더 높은 점수 (조회 의도가 명확)
          const typeScore = type === 'query' ? 2 : 1;
          score += typeScore;
        }
        reasons.push(`타입 키워드: ${type} (${matchedTypeKw.join(', ')})`);
      }
    }

    // 4. INTENT_KEYWORD_MAP 기반 매칭 (하위 호환성, examples가 없을 때만 높은 점수)
    const keywordMap = INTENT_KEYWORD_MAP[intentKey];
    if (keywordMap) {
      for (const keyword of keywordMap) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
          if (hasExampleMatch) {
            score += 1; // examples가 있으면 낮은 점수
          } else {
            score += 2; // examples가 없으면 기본 점수
          }
          reasons.push(`키워드 매핑: "${keyword}"`);
        }
      }
    }

    // 점수가 0보다 크면 후보에 추가
    if (score > 0) {
      candidates.push({
        intent_key: intentKey,
        score,
        reason: reasons.join('; '),
      });
    }
  }

  // 점수 내림차순 정렬 후 상위 N개 반환
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, maxCandidates);
}

/**
 * Intent 키워드 매핑 (Fallback용)
 * Intent Registry의 intent_key를 기반으로 키워드 매핑을 생성합니다.
 * ⚠️ 주의: 이 매핑은 하위 호환성을 위해 유지되지만, Registry의 examples 필드를 우선 사용합니다.
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
  'billing.query.overdue_list': [
    // 기본 키워드
    '연체', '연체자', '연체 목록', '미납', '미납자',
    // 동의어/유의어 확장
    '돈 안낸', '돈 안낸 사람', '돈 안낸 학생', '돈 안낸 사람들',
    '납부 안한', '납부 안한 사람', '납부 안한 학생', '납부 안한 사람들',
    '결제 안한', '결제 안한 사람', '결제 안한 학생', '결제 안한 사람들',
    '미결제', '미결제자', '미결제 학생', '미결제자 목록',
    '미납자 목록', '연체자 목록', '미납 학생', '미납 학생들',
    '안낸 사람', '안낸 학생', '안낸 사람들',
    '미납 대상', '연체 대상', '미납 회원', '연체 회원',
    '납부 안된', '결제 안된', '미납된', '연체된',
  ],
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
        'student': ['학생', '대상', '회원', '원생', '수강생'],
        'attendance': ['출결', '출석', '지각', '결석', '조퇴', '나온', '안온', '불참'],
        'billing': ['수납', '청구', '결제', '납부', '연체', '환불', '미납', '미결제', '돈', '요금', '비용'],
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
        'late': ['지각', '늦은', '늦게 온'],
        'absent': ['결석', '안온', '안나온', '불참'],
        'overdue': ['연체', '미납', '돈 안낸', '납부 안한', '결제 안한', '미결제'],
        'invoice': ['청구서', '인보이스', '납부서', '계산서'],
        'payment': ['결제', '납부', '입금', '수납'],
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

// normalizeParams는 _shared/normalize-params.ts로 이동됨

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

/**
 * Preflight 검증 캐시 (모듈 레벨)
 * 붕괴사전예방.md Layer C 참조: 부팅 시 자동 Preflight 검증
 * Edge Function 특성상 첫 요청 시 검증 + 캐싱 방식
 */
let preflightCache: HealthCheckResult | null = null;
let preflightCacheTime = 0;
const PREFLIGHT_CACHE_TTL = 5 * 60 * 1000; // 5분

/**
 * Preflight 검증 실행 또는 캐시 반환
 * 붕괴사전예방.md Layer C 참조
 */
async function getOrRunPreflight(
  supabase: any,
  tenantId: string
): Promise<HealthCheckResult> {
  const now = Date.now();

  // 캐시가 유효하면 반환
  if (preflightCache && (now - preflightCacheTime) < PREFLIGHT_CACHE_TTL) {
    console.log('[ChatOps] Preflight 검증 캐시 사용');
    return preflightCache;
  }

  // 캐시가 없거나 만료되었으면 검증 실행
  console.log('[ChatOps] Preflight 검증 실행 (캐시 없음 또는 만료)');
  const result = await runAllPreflightChecks(supabase, tenantId);

  // 캐시 업데이트
  preflightCache = result;
  preflightCacheTime = now;

  // 검증 실패 시 로그
  if (result.status === 'unhealthy') {
    console.error('[ChatOps] Preflight 검증 실패 (unhealthy):', {
      layer_a: result.layer_a,
      layer_b: result.layer_b,
      layer_c: result.layer_c,
    });
  } else if (result.status === 'degraded') {
    console.warn('[ChatOps] Preflight 검증 경고 (degraded):', {
      layer_c: result.layer_c,
    });
  }

  return result;
}

/**
 * ChatOps 실행 가능 여부 확인 (Preflight 기반)
 * 붕괴사전예방.md 7. Preflight 실패 시 시스템 행동 규칙 참조
 */
function isChatOpsEnabled(preflightResult: HealthCheckResult): boolean {
  // DB 계약 실패 시 ChatOps 전체 비활성화
  if (preflightResult.status === 'unhealthy') {
    return false;
  }
  return true;
}

/**
 * L2 실행 가능 여부 확인 (Preflight 기반)
 * 붕괴사전예방.md 7. Preflight 실패 시 시스템 행동 규칙 참조
 */
function isL2ExecutionEnabled(preflightResult: HealthCheckResult): boolean {
  // DB 계약 실패 또는 Policy Registry 실패 시 L2 실행 차단
  if (preflightResult.status === 'unhealthy') {
    return false;
  }
  if (preflightResult.status === 'degraded' && !preflightResult.layer_c?.policy_registry_accessible) {
    return false;
  }
  return true;
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

    let { session_id, message, action = 'message', draft_id, draft_params } = requestBody;

    if (!session_id || typeof session_id !== 'string' || session_id.trim().length === 0) {
      console.error('[ChatOps] session_id is missing or empty');
      return new Response(
        JSON.stringify({ error: 'session_id가 필요합니다.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

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
      session_id: session_id.substring(0, 8) + '...',
      message_preview: maskPII(message.substring(0, 100)),
      message_length: message.length,
      tenant_id: tenant_id ? 'present' : 'missing',
    });

    // Supabase 클라이언트 생성
    const supabase = createClient(envServer.SUPABASE_URL, envServer.SERVICE_ROLE_KEY);

    // ⚠️ P0: 부팅 시 자동 Preflight 검증 (첫 요청 시 검증 + 캐싱)
    // 붕괴사전예방.md Layer C 참조
    const preflightResult = await getOrRunPreflight(supabase, tenant_id);

    // ChatOps 실행 가능 여부 확인
    if (!isChatOpsEnabled(preflightResult)) {
      console.error('[ChatOps] Preflight 검증 실패로 ChatOps 전체 비활성화');
      return new Response(
        JSON.stringify({
          error: 'SYSTEM_UNHEALTHY',
          message: '시스템 헬스체크 실패로 ChatOps 기능이 비활성화되었습니다. 관리자에게 문의하세요.',
          health_status: preflightResult,
        }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // JWT에서 user_id 추출
    let user_id = 'system'; // 기본값
    try {
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          user_id = user.id;
        }
      }
    } catch (userError) {
      // user_id 추출 실패는 치명적 오류가 아니므로 기본값 사용
      console.log('[ChatOps] Failed to extract user_id from JWT, using default');
    }

    // ⚠️ 중요: action이 'message'이고 메시지가 실행 확인 키워드를 포함하면
    // 자동으로 'draft_confirm'으로 변환 (사용자가 "실행해", "확인" 등으로 답변한 경우)
    if (action === 'message') {
      const confirmKeywords = ['실행해', '실행', '등록', '확인', '네', '예', 'ok', 'yes', 'go', '진행'];
      const normalizedMessage = message.trim().toLowerCase();
      const isConfirmMessage = confirmKeywords.some(keyword =>
        normalizedMessage.includes(keyword.toLowerCase())
      );

      if (isConfirmMessage) {
        // 기존 ready 상태의 draft 조회
        const { data: existingDraft } = await supabase
          .from('chatops_drafts')
          .select('id')
          .eq('session_id', session_id)
          .eq('tenant_id', tenant_id)
          .eq('user_id', user_id)
          .eq('status', 'ready')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingDraft) {
          action = 'draft_confirm';
          draft_id = existingDraft.id;
          console.log('[ChatOps] 자동으로 draft_confirm 액션으로 전환 (실행 확인 키워드 감지):', {
            message: message,
            draft_id: draft_id,
          });
        }
      }
    }

    // 세션 조회 또는 생성
    let session: { id: string; summary?: string | null; updated_at?: string } | null = null;
    try {
      const { data: existingSession, error: sessionError } = await supabase
        .from('chatops_sessions')
        .select('id, summary, updated_at')
        .eq('id', session_id)
        .eq('tenant_id', tenant_id)
        .eq('user_id', user_id)
        .maybeSingle();

      if (sessionError && sessionError.code !== 'PGRST116') { // PGRST116 = not found
        throw sessionError;
      }

      if (existingSession) {
        session = existingSession;
        console.log('[ChatOps] 기존 세션 조회 성공:', {
          session_id: session_id.substring(0, 8) + '...',
          has_summary: !!(session?.summary),
        });
      } else {
        // 새 세션 생성
        const { data: newSession, error: createError } = await supabase
          .from('chatops_sessions')
          .insert({
            id: session_id,
            tenant_id: tenant_id,
            user_id: user_id,
            summary: null,
          })
          .select('id, summary, updated_at')
          .single();

        if (createError) {
          throw createError;
        }

        session = newSession;
        console.log('[ChatOps] 새 세션 생성 성공:', {
          session_id: session_id.substring(0, 8) + '...',
        });
      }
    } catch (sessionError) {
      const maskedError = maskPII(sessionError);
      console.error('[ChatOps] 세션 조회/생성 실패:', maskedError);
      // 세션 오류는 치명적이지 않으므로 계속 진행 (기본 동작)
    }

    // 최근 메시지 조회 (기본 N=16)
    const HISTORY_WINDOW = 16;
    let recentMessages: Array<{ role: string; content: string }> = [];
    try {
      const { data: messages, error: messagesError } = await supabase
        .from('chatops_messages')
        .select('role, content')
        .eq('session_id', session_id)
        .eq('tenant_id', tenant_id)
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(HISTORY_WINDOW);

      if (messagesError) {
        throw messagesError;
      }

      if (messages && messages.length > 0) {
        // 시간 역순으로 정렬되어 있으므로 뒤집어서 시간 순서대로 만듦
        recentMessages = messages.reverse();
        console.log('[ChatOps] 최근 메시지 조회 성공:', {
          count: recentMessages.length,
        });
      }
    } catch (messagesError) {
      const maskedError = maskPII(messagesError);
      console.error('[ChatOps] 최근 메시지 조회 실패:', maskedError);
      // 메시지 조회 실패는 치명적이지 않으므로 계속 진행
    }

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

    // Draft apply 액션 처리 (파라미터 업데이트)
    if (action === 'draft_apply') {
      if (!draft_id) {
        return new Response(
          JSON.stringify({ error: 'draft_id가 필요합니다.' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (!draft_params || typeof draft_params !== 'object') {
        return new Response(
          JSON.stringify({ error: 'draft_params가 필요합니다.' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Draft 조회
      const { data: draft, error: draftError } = await supabase
        .from('chatops_drafts')
        .select('*')
        .eq('id', draft_id)
        .eq('tenant_id', tenant_id)
        .eq('user_id', user_id)
        .in('status', ['collecting', 'ready'])
        .single();

      if (draftError || !draft) {
        return new Response(
          JSON.stringify({ error: 'Draft를 찾을 수 없거나 업데이트할 수 없는 상태입니다.' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Draft 파라미터 병합
      const updatedParams = {
        ...(draft.draft_params || {}),
        ...draft_params,
      };

      // Inline Execution으로 파라미터 업데이트 처리
      const intent = intentRegistry[draft.intent_key];
      if (!intent) {
        return new Response(
          JSON.stringify({ error: 'Intent를 찾을 수 없습니다.' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      try {
        const { processInlineExecution } = await import('../_shared/inline-execution.ts');
        const inlineResult = await processInlineExecution(
          supabase,
          session_id,
          tenant_id,
          user_id,
          intent,
          updatedParams,
          'apply'
        );

        return new Response(
          JSON.stringify({
            response: inlineResult.response || '파라미터가 업데이트되었습니다.',
            draft_id: inlineResult.draft_id,
            draft_status: inlineResult.draft_status,
            missing_required: inlineResult.missing_required,
            next_question: inlineResult.next_question,
            summary: inlineResult.summary,
            confirm_required: inlineResult.confirm_required,
            intent: {
              intent_key: draft.intent_key,
              automation_level: intent.automation_level,
              ...(intent.execution_class && { execution_class: intent.execution_class }),
            },
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (applyError) {
        const maskedError = maskPII(applyError);
        console.error('[ChatOps] Draft apply error:', maskedError);
        return new Response(
          JSON.stringify({
            error: '파라미터 업데이트 중 오류가 발생했습니다.',
            details: maskedError,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Draft confirm/cancel 액션 처리 (Inline Execution)
    if (action === 'draft_confirm' || action === 'draft_cancel') {
      if (!draft_id) {
        return new Response(
          JSON.stringify({ error: 'draft_id가 필요합니다.' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Draft 조회 (resolve_snapshot 포함)
      // ChatOps_계약_붕괴_방지_체계_분석.md 3.3 참조: 세션 혼선 방지
      const { data: draft, error: draftError } = await supabase
        .from('chatops_drafts')
        .select('*, session_id, resolve_snapshot')
        .eq('id', draft_id)
        .eq('tenant_id', tenant_id)
        .eq('user_id', user_id)
        .eq('status', 'ready')
        .single();

      if (draftError || !draft) {
        return new Response(
          JSON.stringify({ error: 'Draft를 찾을 수 없거나 실행 준비 상태가 아닙니다.' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // ⚠️ 세션 일치 검증 추가 (CONTRACT_SESSION_MISMATCH)
      // ChatOps_계약_붕괴_방지_체계_분석.md 3.3 참조
      if (draft.session_id !== session_id) {
        return new Response(
          JSON.stringify({
            error: 'CONTRACT_SESSION_MISMATCH',
            message: 'Draft 세션이 일치하지 않습니다. 다른 세션의 draft를 실행할 수 없습니다.',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'draft_cancel') {
        // Draft 취소
        await supabase
          .from('chatops_drafts')
          .update({ status: 'cancelled' })
          .eq('id', draft_id);
        return new Response(
          JSON.stringify({
            response: '등록이 취소되었습니다.',
            draft_id: draft_id,
            draft_status: 'cancelled',
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // confirm: 실제 Handler 실행
      const intent = intentRegistry[draft.intent_key];
      // ⚠️ 모든 L1/L2 Intent는 Inline Execution으로 처리
      const isInlineExecution = intent && (
        intent.automation_level === 'L1' ||
        intent.automation_level === 'L2'
      );
      if (!intent || !isInlineExecution) {
        return new Response(
          JSON.stringify({ error: 'Invalid intent for inline execution' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Handler 실행 (execute-student-task의 Handler 사용)
      try {
        const { handlerRegistry } = await import('../execute-student-task/handlers/registry.ts');
        const handler = handlerRegistry[draft.intent_key];
        if (!handler) {
          throw new Error(`Handler not found for ${draft.intent_key}`);
        }

        // ⚠️ 체크리스트 준수: Zod 검증 (Validate)
        // Edge Function에서는 Zod를 직접 사용하기 어려우므로, Handler에서 검증하지만
        // 여기서는 기본적인 타입 검증만 수행
        let handlerParams = draft.draft_params;
        if (draft.intent_key === 'student.exec.register' && handlerParams.form_values) {
          // Handler는 plan.params를 직접 formValues로 사용하므로 form_values를 추출
          handlerParams = handlerParams.form_values as Record<string, unknown>;

          // 기본 검증: name 필수
          if (!handlerParams.name || typeof handlerParams.name !== 'string' || handlerParams.name.trim() === '') {
            return new Response(
              JSON.stringify({ error: '학생 이름이 필요합니다.' }),
              {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }
        }

        // ⚠️ P0: Resolver Gate - 파라미터 정규화 (name → student_id 등)
        // ChatOps_계약_붕괴_방지_체계_분석.md 2.2.2 참조: Query→ID 해소 없으면 Apply 진입 금지
        try {
          console.log('[ChatOps] 파라미터 정규화 시작:', {
            intent_key: draft.intent_key,
            params_keys: Object.keys(handlerParams),
            has_name: !!handlerParams.name,
            has_student_id: !!handlerParams.student_id,
          });

          handlerParams = await normalizeParamsShared(
            handlerParams,
            draft.intent_key,
            supabase,
            tenant_id
          );

          console.log('[ChatOps] 파라미터 정규화 완료:', {
            has_student_id: !!handlerParams.student_id,
            has_resolve_failed: !!handlerParams._resolve_failed,
          });

          // ⚠️ P0: Resolver Gate - Query→ID 해소 검증
          // ChatOps_계약_붕괴_방지_체계_분석.md 2.2.2 참조: Query→ID 해소 없으면 Apply 진입 금지
          if (handlerParams._resolve_failed) {
            const resolveFailed = handlerParams._resolve_failed as { field: string; original_value: string; reason: string };
            console.log('[ChatOps] Resolver Gate 실패:', {
              field: resolveFailed.field,
              original_value: maskPII(resolveFailed.original_value),
              reason: resolveFailed.reason,
            });
            return new Response(
              JSON.stringify({
                error: 'CONTRACT_RESOLUTION_FAILED',
                contract_category: ContractErrorCategory.CONTRACT_INPUT_TYPE,
                message: `학생을 찾을 수 없습니다: "${maskPII(resolveFailed.original_value)}". 정확한 학생 이름을 입력해주세요.`,
                missing_field: resolveFailed.field,
                original_value: maskPII(resolveFailed.original_value),
              }),
              {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }

          // ⚠️ P0: Schema Gate - Apply 입력 스키마 강제 검증 게이트
          // 붕괴사전예방.md Layer A 참조: Apply 입력 스키마 강제 검증
          // UUID 필수 필드 검증 (student_id, class_id, teacher_id 등)
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const uuidFields = ['student_id', 'class_id', 'teacher_id', 'person_id', 'user_id', 'invoice_id', 'session_id'];

          for (const field of uuidFields) {
            if (handlerParams[field] !== undefined && handlerParams[field] !== null) {
              const value = handlerParams[field];
              if (typeof value !== 'string' || !uuidRegex.test(value)) {
                console.log('[ChatOps] Schema Gate 실패: 잘못된 UUID 형식:', {
                  field,
                  value: maskPII(String(value)),
                });
                return new Response(
                  JSON.stringify({
                    error: 'CONTRACT_INPUT_TYPE',
                    contract_category: ContractErrorCategory.CONTRACT_INPUT_TYPE,
                    message: `잘못된 ${field} 형식입니다. UUID 형식이어야 합니다.`,
                    invalid_field: field,
                    invalid_value: maskPII(String(value)),
                  }),
                  {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                  }
                );
              }
            }
          }

          // student.exec.* Intent는 student_id 필수 검증
          if (draft.intent_key.startsWith('student.exec.')) {
            if (!handlerParams.student_id || typeof handlerParams.student_id !== 'string') {
              console.log('[ChatOps] Schema Gate 실패: student_id 없음', {
                intent_key: draft.intent_key,
                params_keys: Object.keys(handlerParams),
                has_name: !!handlerParams.name,
              });
              // name이 있었지만 student_id로 변환되지 않은 경우 더 구체적인 메시지 제공
              const errorMessage = handlerParams.name
                ? `학생 "${maskPII(String(handlerParams.name))}"을(를) 찾을 수 없습니다. 정확한 학생 이름을 입력해주세요.`
                : '학생 정보가 필요합니다. 학생 이름을 입력해주세요.';
              return new Response(
                JSON.stringify({
                  error: 'CONTRACT_RESOLUTION_FAILED',
                  contract_category: ContractErrorCategory.CONTRACT_INPUT_TYPE,
                  message: errorMessage,
                  missing_field: 'student_id',
                  ...(handlerParams.name && { provided_name: maskPII(String(handlerParams.name)) }),
                }),
                {
                  status: 400,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
              );
            }
          }

          // _resolve_failed 필드 제거 (Handler에 전달하지 않음)
          delete handlerParams._resolve_failed;
        } catch (normalizeError) {
          const maskedError = maskPII(normalizeError);
          console.error('[ChatOps] 파라미터 정규화 중 오류:', maskedError);
          return new Response(
            JSON.stringify({
              error: 'CONTRACT_RESOLUTION_FAILED',
              contract_category: ContractErrorCategory.CONTRACT_INPUT_TYPE,
              message: '파라미터 정규화 중 오류가 발생했습니다.',
            }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // ⚠️ 체크리스트 준수: 멱등성/중복 방지 (dedup_key) - Handler 실행 **전**에 체크
        // dedup_key = sha256(tenant_id + intent_key + stableJson(params))
        // 안정적인 JSON 직렬화를 위해 정렬된 키 사용
        const stableParams = JSON.stringify(handlerParams, Object.keys(handlerParams).sort());
        // Deno 환경에서는 crypto.subtle.digest 사용
        const paramsHash = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(`${tenant_id}:${draft.intent_key}:${stableParams}`)
        );
        const hashArray = Array.from(new Uint8Array(paramsHash));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        const dedupKey = hashHex.substring(0, 64); // SHA-256은 64자리 hex

        // ⚠️ 체크리스트 준수: 중복 실행 방지 체크 (Handler 실행 전)
        // 기존 automation_actions 레코드 확인
        const { data: existingAction, error: checkError } = await supabase
          .from('automation_actions')
          .select('id, result, executed_at')
          .eq('tenant_id', tenant_id)
          .eq('dedup_key', dedupKey)
          .maybeSingle();

        if (existingAction) {
          // 중복 실행: 기존 결과 반환 (Handler 실행하지 않음)
          console.log('[ChatOps] 중복 실행 감지, 기존 결과 반환:', {
            existing_action_id: existingAction.id?.substring(0, 8) + '...',
            executed_at: existingAction.executed_at,
          });
          // Draft 상태도 executed로 업데이트 (이미 실행된 것으로 간주)
          await supabase
            .from('chatops_drafts')
            .update({ status: 'executed' })
            .eq('id', draft_id);
          return new Response(
            JSON.stringify({
              response: '이미 처리된 요청입니다.',
              draft_id: draft_id,
              draft_status: 'executed',
              intent: {
                intent_key: draft.intent_key,
                automation_level: intent.automation_level,
                ...(intent.execution_class && { execution_class: intent.execution_class }),
              },
              result: existingAction.result,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // ⚠️ 체크리스트 준수: L2-A Policy 체크 (execute-task-card와 동일한 로직)
        // ChatOps_계약_붕괴_방지_체계_분석.md 2.2.3 참조: Policy 재평가
        let policyEnabled: unknown = null;
        let eventType: string | undefined;
        // L2-A Intent는 event_type 필수
        // Edge Function의 intentRegistry에는 event_type이 없으므로, Handler 내부에서 확인
        // 일단 Handler 실행 시 plan.event_type을 확인하도록 함
        // Handler는 plan.event_type을 사용하므로, plan 객체에 event_type을 추가해야 함
        // 하지만 Edge Function의 intentRegistry에는 event_type이 없으므로, Handler 내부에서 확인하도록 함
        if (intent.automation_level === 'L2' && intent.execution_class === 'A') {
          // L2-A Intent는 event_type이 필요하지만, Edge Function의 intentRegistry에는 없음
          // Handler 내부에서 plan.event_type을 확인하므로, 여기서는 Policy 체크를 하지 않음
          // Handler 내부에서 Policy 체크를 수행함
          eventType = undefined; // Handler 내부에서 확인
          if (!eventType) {
            return new Response(
              JSON.stringify({
                error: 'CONTRACT_INPUT_TYPE',
                message: 'L2-A Intent는 event_type이 필요합니다.',
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // event_type 검증 (AUTOMATION_EVENT_CATALOG)
          try {
            assertAutomationEventType(eventType);
          } catch (eventTypeError) {
            const maskedError = maskPII(eventTypeError);
            console.error('[ChatOps] Invalid event_type:', maskedError);
            return new Response(
              JSON.stringify({
                error: 'CONTRACT_INPUT_TYPE',
                message: `유효하지 않은 event_type입니다: ${eventType}`,
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Policy 재평가 (Fail-Closed)
          policyEnabled = await getTenantSettingByPath(
            supabase,
            tenant_id,
            `auto_notification.${eventType}.enabled`
          );

          if (!policyEnabled || policyEnabled !== true) {
            return new Response(
              JSON.stringify({
                error: 'CONTRACT_POLICY_DISABLED',
                contract_category: ContractErrorCategory.CONTRACT_POLICY_DISABLED,
                message: '실행 정책이 비활성화되어 있거나 존재하지 않습니다.',
              }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // Plan 객체 구성 (Handler 실행용)
        // ChatOps_계약_붕괴_방지_체계_분석.md 참조: Plan 스냅샷 구조
        // ⚠️ 중요: automation_level은 'L1' | 'L2'만 허용 (L0는 Inline Execution 불가)
        const plan: SuggestedActionChatOpsPlanV1 = {
          schema_version: 'chatops.plan.v1',
          intent_key: draft.intent_key,
          params: handlerParams,
          automation_level: intent.automation_level === 'L0' ? 'L1' : (intent.automation_level as 'L1' | 'L2'), // 타입 안전성
          ...(intent.execution_class && { execution_class: intent.execution_class }),
          // event_type은 Handler 내부에서 확인 (Edge Function의 intentRegistry에는 없음)
          // plan_snapshot은 Handler가 필요로 하는 정보이므로, Handler 실행 시 동적으로 구성
          // 일단 기본 구조만 제공 (Handler 내부에서 실제 targets 구성)
          plan_snapshot: {
            summary: `ChatOps Inline Execution: ${draft.intent_key}`,
            target_count: 0, // Handler 내부에서 실제 계산
            targets: {
              kind: 'student_id_list',
              student_ids: [], // Handler 내부에서 실제 targets 구성
            },
          },
          security: {
            requested_by_user_id: user_id,
            requested_at_utc: new Date().toISOString(),
          },
        };

        // Handler Context 생성
        // ⚠️ HandlerContext는 user_role, now_kst도 필요
        // ⚠️ 디버깅: tenant_id 값 확인
        console.log('[ChatOps] Handler Context 생성:', {
          tenant_id: tenant_id,
          tenant_id_type: typeof tenant_id,
          tenant_id_is_null: tenant_id === null,
          tenant_id_is_undefined: tenant_id === undefined,
          user_id: user_id,
        });

        // ⚠️ Preflight: 실행 직전 상태 재확인 (계약 붕괴 방지)
        // ChatOps_계약_붕괴_방지_체계_분석.md 2.2.2 참조
        // Handler 내부에서 plan.plan_snapshot.targets.student_ids를 구성하므로,
        // 여기서는 Preflight 체크를 하지 않음 (Handler 내부에서 수행)
        // 일단 주석 처리 (Handler 내부에서 Preflight 체크 수행)
        /*
        if (plan.plan_snapshot?.targets?.kind === 'student_id_list' && plan.plan_snapshot.targets.student_ids?.length > 0) {
          const { data: currentState, error: preflightError } = await withTenant(
            supabase
              .from('persons')
              .select('id, person_type, status')
              .in('id', plan.plan_snapshot.targets.student_ids)
              .eq('person_type', 'student'),
            tenant_id
          );

          if (preflightError) {
            console.error('[ChatOps] Preflight query failed:', maskPII(preflightError));
            return new Response(
              JSON.stringify({
                error: 'CONTRACT_PREFLIGHT_FAILED',
                message: '실행 전 상태 확인 중 오류가 발생했습니다.',
              }),
              { status: 500, headers: corsHeaders }
            );
          }

          // 상태 변화 감지 (이미 퇴원한 학생 등)
          const dischargedStudents = currentState?.filter(s => s.status === 'discharged');
          if (dischargedStudents && dischargedStudents.length > 0) {
            return new Response(
              JSON.stringify({
                error: 'CONTRACT_STATE_CHANGED',
                contract_category: ContractErrorCategory.CONTRACT_STATE_CHANGED,
                message: `이미 퇴원한 학생이 포함되어 있습니다: ${dischargedStudents.length}명`,
                affected_students: dischargedStudents.map(s => s.id),
              }),
              { status: 409, headers: corsHeaders }
            );
          }

          // 존재하지 않는 학생 감지
          const foundIds = new Set(currentState?.map(s => s.id) || []);
          const missingIds = plan.plan_snapshot.targets.student_ids.filter(
            id => !foundIds.has(id)
          );
          if (missingIds.length > 0) {
            return new Response(
              JSON.stringify({
                error: 'CONTRACT_TARGET_NOT_FOUND',
                contract_category: ContractErrorCategory.CONTRACT_TARGET_NOT_FOUND,
                message: `존재하지 않는 학생이 포함되어 있습니다: ${missingIds.length}명`,
                missing_ids: missingIds,
              }),
              { status: 404, headers: corsHeaders }
            );
          }
        }
        */

        // ⚠️ P0: L2 실행 전 Preflight 검증 확인
        // 붕괴사전예방.md 7. Preflight 실패 시 시스템 행동 규칙 참조
        if (intent.automation_level === 'L2' && !isL2ExecutionEnabled(preflightResult)) {
          console.warn('[ChatOps] Preflight 검증 실패로 L2 실행 차단');
          return new Response(
            JSON.stringify({
              error: 'L2_EXECUTION_DISABLED',
              message: '시스템 헬스체크 실패로 L2 자동 실행이 비활성화되었습니다. L0/L1 조회만 가능합니다.',
              health_status: preflightResult,
            }),
            {
              status: 503,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // ⚠️ Worker 아키텍처: Apply 단계는 job 생성만, 실제 실행은 Worker가 처리
        // ChatOps_계약_붕괴_방지_체계_분석.md 4.5 참조
        const executionStartTime = Date.now();
        const executedAt = new Date().toISOString();

        // Worker가 필요한 작업인지 판단
        const useWorker = shouldUseWorker(plan);

        let handlerResult: any = null;
        let jobId: string | undefined = undefined;

        if (useWorker) {
          // Worker 아키텍처: job 생성 후 즉시 Worker 호출 (지연 없음)
          const jobResult = await createJob(
            supabase,
            tenant_id,
            plan,
            { user_id: user_id, user_role: 'admin' },
            {
              resolve_snapshot: draft.resolve_snapshot || null,
              apply_input: {
                params: maskPII(handlerParams), // PII 마스킹 필수
                target_count: plan.plan_snapshot?.target_count,
                target_ids_sample: plan.plan_snapshot?.targets?.student_ids?.slice(0, 5),
              },
              policy_verdict: plan.automation_level === 'L2' && plan.execution_class === 'A' ? {
                enabled: policyEnabled,
                path: `auto_notification.${eventType}.enabled`,
                checked_at: executedAt,
                event_type: eventType,
              } : null,
            },
            {
              supabaseUrl: envServer.SUPABASE_URL,
              serviceRoleKey: envServer.SERVICE_ROLE_KEY,
            }
          );

          if (!jobResult) {
            // job 생성 실패
            await supabase
              .from('chatops_drafts')
              .update({ status: 'cancelled' })
              .eq('id', draft_id);

            return new Response(
              JSON.stringify({
                response: '작업 생성에 실패했습니다.',
                draft_id: draft_id,
                draft_status: 'cancelled',
                error_code: 'JOB_CREATION_FAILED',
                intent: {
                  intent_key: draft.intent_key,
                  automation_level: intent.automation_level,
                  ...(intent.execution_class && { execution_class: intent.execution_class }),
                },
              }),
              {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }

          jobId = jobResult.job_id;
          handlerResult = {
            status: 'success',
            message: '처리가 시작되었습니다. Worker가 실행을 처리합니다.',
            job_id: jobId,
          };
        } else {
          // 즉시 실행 (Worker 불필요한 작업)
          const handlerContext = {
            tenant_id: tenant_id,
            user_id: user_id,
            user_role: 'admin', // Inline Execution은 사용자 직접 요청이므로 admin으로 가정
            now_kst: new Date().toISOString(), // ISO 8601 형식 (HandlerContext 타입에 맞춤)
            supabase: supabase,
          };

          // Handler 실행 (실행 시간 측정)
          const handlerStartTime = Date.now();
          handlerResult = await handler.execute(plan, handlerContext);
          const handlerDurationMs = Date.now() - handlerStartTime;

          // handlerResult에 duration_ms가 없으면 계산한 값 추가
          if (!handlerResult.duration_ms) {
            handlerResult.duration_ms = handlerDurationMs;
          }

          // ⚠️ 중요: Handler 실행 결과 확인 (실패 시 에러 반환)
          if (handlerResult.status === 'failed') {
            console.error('[ChatOps] Handler execution failed:', {
              error_code: handlerResult.error_code,
              message: handlerResult.message,
              intent_key: draft.intent_key,
            });

            // Draft 상태를 cancelled로 업데이트 (실패한 실행)
            await supabase
              .from('chatops_drafts')
              .update({ status: 'cancelled' })
              .eq('id', draft_id);

            return new Response(
              JSON.stringify({
                response: handlerResult.message || '실행에 실패했습니다.',
                draft_id: draft_id,
                draft_status: 'cancelled',
                error_code: handlerResult.error_code,
                intent: {
                  intent_key: draft.intent_key,
                  automation_level: intent.automation_level,
                  ...(intent.execution_class && { execution_class: intent.execution_class }),
                },
              }),
              {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }
        }

        // Draft 상태 업데이트
        await supabase
          .from('chatops_drafts')
          .update({ status: 'executed' })
          .eq('id', draft_id);

        // ⚠️ P0-5: request_id 생성 (서버에서 생성, 클라이언트 입력 금지)
        // request_id 형식: {draft_id}:draft_confirm:{attempt_window} (액티비티.md 7.2, 챗봇.md 6.3.1 참조)
        // draft_confirm는 버킷 멱등 (5분 버킷)
        const attemptWindow = Math.floor(Date.now() / (5 * 60 * 1000)); // 5분 버킷
        const requestId = `${draft_id}:draft_confirm:${attemptWindow}`;

        // ⚠️ 체크리스트 준수: Activity 기록 (실행 정본)
        // automation_actions에 실행 결과 기록
        // ChatOps_계약_붕괴_방지_체계_분석.md 3.5 참조: 실행 스냅샷 저장 확장
        const { error: insertError } = await supabase.from('automation_actions').insert({
          tenant_id: tenant_id,
          action_type: draft.intent_key,
          executed_by: user_id,
          executed_at: executedAt,
          result: handlerResult,
          request_id: requestId, // ⚠️ P0-5: request_id 기록 (automation_actions와 execution_audit_runs 동일 형식)
          dedup_key: dedupKey,
          execution_context: {
            intent_key: draft.intent_key,
            draft_params: draft.draft_params,
            executed_at: executedAt,
            // Resolve 스냅샷 (draft 생성 시점의 intentCandidates 정보)
            resolve_snapshot: draft.resolve_snapshot || null,
            // Apply 입력 스냅샷 (PII 마스킹)
            apply_input: {
              params: maskPII(handlerParams), // PII 마스킹 필수
              target_count: plan.plan_snapshot?.target_count,
              target_ids_sample: plan.plan_snapshot?.targets?.student_ids?.slice(0, 5),
            },
            // Policy 판정 스냅샷 (L2-A인 경우)
            policy_verdict: plan.automation_level === 'L2' && plan.execution_class === 'A' ? {
              enabled: policyEnabled,
              path: `auto_notification.${eventType}.enabled`,
              checked_at: executedAt,
              event_type: eventType,
            } : null,
            // 멱등성 정보
            idempotency: {
              request_id: requestId,
              dedup_key: dedupKey,
              ...(jobId && { job_id: jobId }),
            },
          },
        });

        if (insertError) {
          // 중복 키 오류인 경우 기존 레코드 조회
          if (insertError.code === '23505') { // unique_violation
            const { data: retryAction } = await supabase
              .from('automation_actions')
              .select('id, result, executed_at')
              .eq('tenant_id', tenant_id)
              .eq('dedup_key', dedupKey)
              .single();

            if (retryAction) {
              console.log('[ChatOps] 중복 실행 감지 (race condition), 기존 결과 반환');
              return new Response(
                JSON.stringify({
                  response: '이미 처리된 요청입니다.',
                  draft_id: draft_id,
                  draft_status: 'executed',
                  intent: {
                    intent_key: draft.intent_key,
                    automation_level: intent.automation_level,
                    ...(intent.execution_class && { execution_class: intent.execution_class }),
                  },
                  result: retryAction.result,
                }),
                {
                  status: 200,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
              );
            }
          }
          // 다른 오류는 throw
          throw insertError;
        }

        // ⚠️ P0-10: Execution Audit 기록 (액티비티.md 12)
        // automation_actions 기록 후 execution_audit_runs도 생성되어야 함
        // intent_key → operation_type 매핑은 meta.operation_registry 테이블에서 조회
        let operationType = 'unknown_operation';
        // HandlerResult.status는 'success' | 'failed' | 'partial' 중 하나
        let auditStatus: 'success' | 'failed' | 'partial' = handlerResult.status;
        let errorCode: string | undefined = handlerResult.error_code;
        let errorSummary: string | undefined = handlerResult.message;
        let allowedDetailsKeys: Record<string, boolean> | null = null;

        // intent_key → operation_type 매핑 (액티비티.md 8.A.2 매핑 규칙)
        if (draft.intent_key) {
          try {
            const { data: registryEntry, error: registryError } = await supabase
              .from('meta.operation_registry')
              .select('operation_type, is_enabled, allowed_details_keys')
              .eq('intent_key', draft.intent_key)
              .single();

            if (registryError) {
              const maskedRegistryError = maskPII(registryError);
              console.error('[ChatOps] Failed to query operation_registry:', maskedRegistryError);
              operationType = 'unknown_operation';
              auditStatus = 'failed';
              errorCode = 'unknown_operation';
              errorSummary = 'operation_registry 조회 실패';
            } else if (registryEntry && registryEntry.is_enabled !== false) {
              operationType = registryEntry.operation_type;
              allowedDetailsKeys = registryEntry.allowed_details_keys as Record<string, boolean> | null;
            } else {
              operationType = 'unknown_operation';
              auditStatus = 'failed';
              errorCode = 'unknown_operation';
              errorSummary = `Intent '${draft.intent_key}'에 대한 operation_type이 meta.operation_registry에 등록되지 않았습니다.`;
            }
          } catch (registryError) {
            const maskedRegistryError = maskPII(registryError);
            console.error('[ChatOps] Failed to query operation_registry:', maskedRegistryError);
            operationType = 'unknown_operation';
            auditStatus = 'failed';
            errorCode = 'unknown_operation';
            errorSummary = 'operation_registry 조회 실패';
          }
        }

        // execution_audit_runs 생성 (액티비티.md 8.1, 12 참조)
        // ⚠️ P0-10: Correlation Key 필수 (request_id 우선, 액티비티.md 7.2 참조)
        // request_id는 위에서 이미 생성됨 (automation_actions와 동일한 값 사용)

        // duration_ms: handlerResult에 있으면 사용, 없으면 전체 실행 시간 계산 (Worker 사용 시 null)
        const durationMs = handlerResult.duration_ms || (useWorker ? null : (Date.now() - executionStartTime));

        await createExecutionAuditRecord(supabase, {
          tenant_id: tenant_id,
          operation_type: operationType,
          status: auditStatus,
          source: 'ai', // ChatOps는 source='ai' (액티비티.md 12 참조)
          actor_type: 'user',
          actor_id: `user:${user_id}`,
          summary: plan.plan_snapshot?.summary || handlerResult.message || `Intent '${draft.intent_key}' 실행 완료`,
          details: (() => {
            // ⚠️ P0-10: details allowlist 적용
            // partial 상태도 details 저장 (성공한 부분에 대한 정보)
            if (handlerResult.status === 'failed') {
              return null;
            }

            const rawDetails: Record<string, unknown> = {
              intent_key: draft.intent_key,
            };

            // allowlist 적용: allowed_details_keys에 있는 키만 저장
            if (allowedDetailsKeys && typeof allowedDetailsKeys === 'object') {
              const filteredDetails: Record<string, unknown> = {};
              for (const key in rawDetails) {
                if (allowedDetailsKeys[key] === true) {
                  filteredDetails[key] = rawDetails[key];
                }
              }
              return Object.keys(filteredDetails).length > 0 ? filteredDetails : null;
            }

            return rawDetails;
          })(),
          reference: {
            request_id: requestId, // ⚠️ P0-10: correlation key 필수 (request_id 우선, 액티비티.md 7.2 참조)
            draft_id: draft_id,
            entity_type: plan.plan_snapshot?.targets?.kind === 'student_id_list' ? 'student' : undefined,
            entity_id: plan.plan_snapshot?.targets?.student_ids?.[0] || undefined,
            source_event_id: dedupKey,
          },
          counts: plan.plan_snapshot?.target_count ? { affected: plan.plan_snapshot.target_count } :
                  (handlerResult.result?.total_count ? {
                    affected: handlerResult.result.total_count,
                    ...(handlerResult.result.success_count !== undefined && { success: handlerResult.result.success_count }),
                    ...(handlerResult.result.error_count !== undefined && { failed: handlerResult.result.error_count })
                  } : null),
          duration_ms: durationMs,
          error_code: errorCode,
          error_summary: errorSummary,
          version: plan.schema_version || 'chatops.plan.v1',
        });

        return new Response(
          JSON.stringify({
            response: handlerResult.message || '실행이 완료되었습니다.',
            draft_id: draft_id,
            draft_status: 'executed',
            intent: {
              intent_key: draft.intent_key,
              automation_level: intent.automation_level,
              ...(intent.execution_class && { execution_class: intent.execution_class }),
            },
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (execError) {
        const maskedError = maskPII(execError);
        console.error('[ChatOps] Handler execution error:', maskedError);
        return new Response(
          JSON.stringify({
            error: '실행 중 오류가 발생했습니다.',
            error_code: 'EXECUTION_FAILED',
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // ⚠️ 중요: draft_confirm/cancel 액션일 때는 OpenAI API 호출 스킵
    // (이미 Draft가 ready 상태이므로 Intent 파싱 불필요)
    // draft_confirm/cancel은 위에서 이미 처리되었으므로 여기 도달하지 않음

    // ⚠️ Resolver 구조 고정: 후보 추출 → LLM 선택
    // Registry 기반 후보 추출 (나중에 임베딩으로 교체 가능하도록 구조 고정)
    // resolve_snapshot 저장을 위해 상위 스코프 변수로 선언
    const candidates = extractIntentCandidates(message, 10);
    console.log('[ChatOps] Intent 후보 추출 완료:', {
      candidate_count: candidates.length,
      top_candidates: candidates.slice(0, 5).map(c => ({
        intent_key: c.intent_key,
        score: c.score,
        reason_preview: c.reason.substring(0, 50),
      })),
    });

    // ChatGPT API 호출 (상담일지 요약과 동일한 모델 설정)
    // ⚠️ 업종 중립: "학원" 대신 "기관" 또는 일반적인 용어 사용
    // ⚠️ 개선: System prompt를 간결하게 재구성하고 Few-shot 예시 추가
    // ⚠️ 구조적 제약: Registry의 Intent만 선택 가능하도록 후보 목록 주입
    const candidateList = candidates.length > 0
      ? candidates.map((c, idx) => `  ${idx + 1}. ${c.intent_key} (점수: ${c.score}, 이유: ${c.reason.substring(0, 100)})`).join('\n')
      : '  (후보 없음 - 모든 Intent 검토 필요)';

    const systemPrompt = `당신은 기관 관리 시스템의 AI 어시스턴트입니다.

⚠️⚠️⚠️ 맥락 유지 규칙 (매우 중요) ⚠️⚠️⚠️:

이 대화는 세션 기반으로 진행되며, 이전 대화 내용이 포함되어 있습니다.
**반드시 이전 대화를 참조하여 맥락을 이해하세요.**

특히 다음 경우를 주의하세요:
- 사용자가 "도", "또한", "그리고" 등의 단어를 사용하면 이전 대화를 참조하는 것입니다.
- 이전 대화에서 언급된 학생 이름, 반, 날짜 등을 현재 요청에도 적용해야 합니다.
- 예: 이전에 "박소영 퇴원시켜"라고 했다면, "전화번호도 확인"은 "박소영의 전화번호 확인"을 의미합니다.
- 예: 이전에 "오늘 지각한 학생"이라고 했다면, "그 학생들 전화번호"는 "오늘 지각한 학생들의 전화번호"를 의미합니다.

⚠️⚠️⚠️ 구조적 제약 (절대 준수 필수) ⚠️⚠️⚠️:

다음은 사용자 메시지와 유사한 Intent 후보 목록입니다.
**반드시 이 후보 목록에서만 Intent를 선택하세요.**
후보 목록에 없는 Intent는 절대 생성하지 마세요!

Intent 후보 목록:
${candidateList}

⚠️ 중요:
- 후보 목록이 비어있지 않으면, 반드시 후보 중 하나를 선택하세요.
- 후보 목록이 비어있으면, 아래 "사용 가능한 Intent 목록" 전체를 검토하여 선택하세요.
- Registry에 등록되지 않은 Intent는 절대 생성하지 마세요!

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
2. **이전 대화 참조 규칙 (매우 중요)**:
   - 사용자 메시지에 "도", "또한", "그리고" 등의 단어가 있으면 이전 대화를 참조하는 것입니다.
   - 이전 대화에서 언급된 학생 이름, 반, 날짜 등을 현재 요청의 params에 포함해야 합니다.
   - 예: 이전에 "박소영 퇴원시켜"라고 했다면, "전화번호도 확인"은 { "name": "박소영" }을 params에 포함해야 합니다.
   - 예: 이전에 "오늘 지각한 학생"이라고 했다면, "그 학생들 전화번호"는 이전 대화의 학생 목록을 참조해야 합니다.
3. 학생 이름이 포함된 경우:
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
7. 위 Few-shot 예시를 참고하여 정확한 형식으로 응답하세요

⚠️⚠️⚠️ 동의어/유의어 처리 규칙 (매우 중요) ⚠️⚠️⚠️:

사용자가 다양한 표현으로 같은 의미를 전달할 수 있습니다.
다음과 같은 동의어 매핑을 이해하고 올바른 Intent를 선택하세요:

[수납/청구 도메인 - 미납/연체 관련]
- "미납", "연체", "돈 안낸", "돈 안낸 사람", "납부 안한", "결제 안한", "미결제", "미결제자"
  → billing.query.overdue_list (연체 목록 조회)
- "청구서", "인보이스", "납부서", "계산서" → billing.query.invoice_status (청구서 상태 조회)
- "결제", "납부", "입금", "수납" → billing.query.by_student (결제 내역 조회)

[출결 도메인]
- "지각", "늦은", "늦게 온", "지각한" → attendance.query.late (지각 조회)
- "결석", "안온", "안나온", "불참", "결석한" → attendance.query.absent (결석 조회)
- "출석", "나온", "참석" → attendance.query.by_student (출결 조회)

[학생 도메인]
- "학생", "대상", "회원", "원생", "수강생" → student.query.* (학생 관련 Intent)
- "전화번호", "연락처", "번호", "핸드폰", "폰번호" → student.query.profile (전화번호 조회 시)

⚠️ 중요: 사용자 메시지의 의미를 파악하여 올바른 Intent를 선택하세요.
예를 들어:
- "돈 안낸 사람" = "미납자" = billing.query.overdue_list
- "납부 안한 학생들" = "미납 학생들" = billing.query.overdue_list
- "미결제자 조회" = billing.query.overdue_list

의미가 동일하면 같은 Intent를 사용하세요!`;

    // OpenAI messages 배열 구성: system + summary(있으면) + recentHistory + current user message
    const openaiMessages: Array<{ role: string; content: string }> = [
      {
        role: 'system',
        content: systemPrompt,
      },
    ];

    // summary가 있으면 추가 (developer 역할로 추가하거나 system에 포함)
    if (session && session.summary && session.summary.trim().length > 0) {
      openaiMessages.push({
        role: 'system',
        content: `이전 대화 요약:\n${session.summary}\n\n위 요약을 참고하여 사용자의 현재 질문에 답변하세요.`,
      });
    }

    // 최근 메시지 히스토리 추가
    // ⚠️ 중요: 이전 대화가 있으면 명시적으로 맥락 참조 지시 추가
    if (recentMessages.length > 0) {
      // 이전 대화 히스토리 추가 전에 맥락 참조 지시 추가
      openaiMessages.push({
        role: 'system',
        content: `아래는 이전 대화 히스토리입니다. 사용자의 현재 요청이 "도", "또한", "그리고" 등의 단어를 포함하거나 명시적인 대상이 없으면, 반드시 이전 대화에서 언급된 학생 이름, 반, 날짜 등을 참조하여 params에 포함하세요.`,
      });
    }

    for (const msg of recentMessages) {
      openaiMessages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      });
    }

    // 현재 사용자 메시지 추가
    // ⚠️ 중요: 현재 요청의 사용자 메시지도 히스토리에 포함하여 빠른 연속 요청 시에도 맥락 유지
    openaiMessages.push({
      role: 'user',
      content: message,
    });

    console.log('[ChatOps] OpenAI messages 구성 완료:', {
      total_messages: openaiMessages.length,
      has_summary: !!session?.summary,
      recent_history_count: recentMessages.length,
      // PII 마스킹: messages 배열 구조만 로깅 (내용은 마스킹)
      messages_structure: openaiMessages.map((msg, idx) => ({
        index: idx,
        role: msg.role,
        content_length: msg.content.length,
        content_preview: maskPII(msg.content.substring(0, 50)),
      })),
    });

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // 상담일지 요약과 동일한 모델
        messages: openaiMessages,
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

        // ⚠️ 중요: Fallback을 여기서 즉시 실행 (L0/Inline Execution 전에)
        // Fallback: 사용자 요청에서 키워드를 분석하여 올바른 Intent 추론
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
            // user_id는 이미 위에서 추출했으므로 재사용
            const handlerContext = {
              tenant_id: tenant_id,
              user_id: user_id,
              supabase: supabase,
            };

            // 파라미터 정규화 (범용 변환 규칙 적용)
            const normalizedParams = await normalizeParamsShared(
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

    // Inline Execution 처리 (execution_mode === 'inline')
    let draftResponse: ChatOpsResponse['draft_id'] | undefined;
    let draftStatus: ChatOpsResponse['draft_status'] | undefined;
    let missingRequired: ChatOpsResponse['missing_required'] | undefined;
    let nextQuestion: ChatOpsResponse['next_question'] | undefined;
    let summary: ChatOpsResponse['summary'] | undefined;
    let confirmRequired: ChatOpsResponse['confirm_required'] | undefined;

    if (parsedIntent && (action === 'message' || action === 'draft_apply')) {
      const intent = intentRegistry[parsedIntent.intent_key];
      // ⚠️ 모든 L1/L2 Intent는 Inline Execution으로 처리 (TaskCard 생성 없이 대화만으로 처리)
      // L0는 조회/초안이므로 Inline Execution 불필요
      const isInlineExecution = intent && (
        parsedIntent.automation_level === 'L1' ||
        parsedIntent.automation_level === 'L2'
      );
      if (isInlineExecution) {
        console.log('[ChatOps] Inline Execution 시작:', {
          intent_key: parsedIntent.intent_key,
        });

        try {
          // Inline Execution 로직은 별도 파일로 분리 (파일 크기 제한)
          // 여기서는 기본 처리만 수행
          const { processInlineExecution } = await import('../_shared/inline-execution.ts');

          // student.exec.register의 경우: params를 form_values로 변환
          let draftParams = parsedIntent.params || {};
          if (intent.intent_key === 'student.exec.register') {
            // 사용자가 제공한 params를 form_values로 변환
            if (draftParams.name) {
              draftParams = { form_values: { name: draftParams.name } };
            } else {
              draftParams = { form_values: {} };
            }
          }

          // ⚠️ 중요: action이 'message'이고 parsedIntent.params에 값이 있으면
          // 자동으로 'apply' 액션으로 처리 (사용자가 질문에 답변한 경우)
          let inlineAction: 'start' | 'apply' = (action === 'draft_apply') ? 'apply' : 'start';
          // action이 'message'인 경우에만 자동 apply 체크 (타입 안전성)
          if (action === 'message' && draftParams && Object.keys(draftParams).length > 0) {
            // draftParams에 실제 값이 있으면 (빈 객체가 아니면) 'apply'로 처리
            const hasValues = Object.values(draftParams).some(v => {
              if (typeof v === 'object' && v !== null) {
                return Object.keys(v).length > 0;
              }
              return v !== undefined && v !== null && v !== '';
            });
            if (hasValues) {
              inlineAction = 'apply';
              console.log('[ChatOps] 자동으로 apply 액션으로 전환 (사용자 답변 감지):', {
                draft_params: draftParams,
              });
            }
          }

          const inlineResult = await processInlineExecution(
            supabase,
            session_id,
            tenant_id,
            user_id,
            intent,
            draftParams,
            inlineAction,
            candidates // resolve_snapshot으로 저장
          );

          draftResponse = inlineResult.draft_id;
          draftStatus = inlineResult.draft_status;
          missingRequired = inlineResult.missing_required;
          nextQuestion = inlineResult.next_question;
          summary = inlineResult.summary;
          confirmRequired = inlineResult.confirm_required;

          if (inlineResult.response) {
            cleanResponse = inlineResult.response;
          }

          console.log('[ChatOps] Inline Execution 처리 완료:', {
            draft_id: draftResponse,
            status: draftStatus,
            missing_count: missingRequired?.length || 0,
          });

          // Inline Execution이면 TaskCard 생성하지 않고 종료
          // (confirm 단계에서 실제 실행)
        } catch (inlineError) {
          const maskedError = maskPII(inlineError);
          console.error('[ChatOps] Inline Execution error:', maskedError);
          cleanResponse = `${cleanResponse}\n\n[오류] Inline Execution 처리 중 오류가 발생했습니다.`;
        }
      }
    }

    // ⚠️ 모든 L1/L2 Intent는 Inline Execution으로 처리하므로 TaskCard 생성하지 않음
    // 모든 Intent는 대화만으로 처리 (TaskCard 기반 프로세스 완전 제거)
    // ⚠️ 참고: Fallback은 이미 Intent 파싱 실패 시점에 실행되었음

    // DB에 메시지 저장 (원자적으로 가능하면 트랜잭션)
    try {
      // 사용자 메시지 저장
      const { error: userMsgError } = await supabase
        .from('chatops_messages')
        .insert({
          session_id: session_id,
          tenant_id: tenant_id,
          user_id: user_id,
          role: 'user',
          content: message,
        });

      if (userMsgError) {
        throw userMsgError;
      }

      // Assistant 응답 저장
      const { error: assistantMsgError } = await supabase
        .from('chatops_messages')
        .insert({
          session_id: session_id,
          tenant_id: tenant_id,
          user_id: user_id,
          role: 'assistant',
          content: cleanResponse,
          intent_key: parsedIntent?.intent_key,
          automation_level: parsedIntent?.automation_level,
          execution_class: parsedIntent?.execution_class,
        });

      if (assistantMsgError) {
        throw assistantMsgError;
      }
    } catch (dbError) {
      const maskedDbError = maskPII(dbError);
      console.error('[ChatOps] DB 저장 실패:', maskedDbError);
      // DB 저장 실패는 사용자에게 영향을 주지 않도록 함 (응답은 반환)
    }

    console.log('[ChatOps] ===== 최종 응답 반환 =====');
    console.log('[ChatOps] 최종 응답:', {
      response_length: cleanResponse.length,
      has_intent: !!parsedIntent,
      intent_key: parsedIntent?.intent_key,
      automation_level: parsedIntent?.automation_level,
    });

    // 응답 객체 구성 (ChatOpsResponse 인터페이스 준수)
    const response: ChatOpsResponse = {
      response: cleanResponse,
      ...(parsedIntent && {
        intent: {
          intent_key: parsedIntent.intent_key,
          automation_level: parsedIntent.automation_level,
          ...(parsedIntent.execution_class && { execution_class: parsedIntent.execution_class }),
          ...(parsedIntent.params && { params: parsedIntent.params }),
        },
      }),
      ...(l0ExecutionResult !== undefined && { l0_result: l0ExecutionResult }),
      ...(draftResponse && { draft_id: draftResponse }),
      ...(draftStatus && { draft_status: draftStatus }),
      ...(missingRequired && missingRequired.length > 0 && { missing_required: missingRequired }),
      ...(nextQuestion && { next_question: nextQuestion }),
      ...(summary && { summary: summary }),
      ...(confirmRequired !== undefined && { confirm_required: confirmRequired }),
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const maskedError = maskPII(error);
    console.error('[ChatOps] 최상위 에러:', maskedError);
    return new Response(
      JSON.stringify({
        error: '챗봇 처리 중 오류가 발생했습니다.',
        details: maskedError,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
