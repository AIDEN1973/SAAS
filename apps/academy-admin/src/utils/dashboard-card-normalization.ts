/**
 * DashboardCard 정규화 유틸리티 (SSOT)
 *
 * [불변 규칙] 모든 카드 데이터 정규화는 이 파일에서만 수행
 * [불변 규칙] UI에서 방어 코드를 추가하지 않고, 카드 생성 시점에 정규화하여 타입/형식 보장
 *
 * @see docu/디어쌤 아키텍처.md - DashboardCard 타입 정의
 */

import { toKST } from '@lib/date-utils';
import type {
  DashboardCard,
  EmergencyCard,
  AIBriefingCard,
  ClassCard,
  StatsCard,
  BillingSummaryCard,
} from '../types/dashboardCard';
import type { StudentTaskCard } from '@hooks/use-student';
import { isString, isNumber } from './type-guards-utils';
import { DEFAULT_CLASS_START_TIME } from '../constants';

/**
 * created_at 필드 정규화 (SSOT)
 *
 * @param value 원본 값 (string | Date | number | undefined | null)
 * @param fallback 기본값 (기본값: 현재 KST 시각 ISO string)
 * @returns ISO 8601 형식의 문자열
 * @internal 내부 함수 (필요 시 export 가능)
 */
function normalizeCreatedAt(
  value: unknown,
  fallback?: string
): string {
  if (isString(value)) {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  return fallback || toKST().toISOString();
}

/**
 * priority 필드 정규화 (SSOT)
 *
 * @param value 원본 값 (number | string | undefined | null)
 * @param fallback 기본값 (기본값: 0)
 * @returns 숫자
 * @internal 내부 함수 (필요 시 export 가능)
 */
function normalizePriority(
  value: unknown,
  fallback = 0
): number {
  if (isNumber(value)) {
    return value;
  }
  if (isString(value)) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

/**
 * action_url 필드 정규화 (SSOT)
 *
 * @param value 원본 값 (string | undefined | null)
 * @returns 문자열 또는 undefined
 *   - 유효한 문자열(공백 제거 후 길이 > 0): trim된 문자열 반환
 *   - 그 외: undefined 반환
 * @internal 내부 함수 (필요 시 export 가능)
 *
 * @note 사용 패턴:
 *   - StatsCard (action_url?: string): normalizeActionUrl(value) 직접 사용 (undefined 허용)
 *   - ClassCard, BillingSummaryCard, StudentTaskCard (action_url: string): normalizeActionUrl(value) || '' 사용 (빈 문자열 fallback)
 */
function normalizeActionUrl(
  value: unknown
): string | undefined {
  if (isString(value) && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
}

/**
 * EmergencyCard 정규화 (SSOT)
 *
 * @param card 원본 카드
 * @returns 정규화된 EmergencyCard
 */
export function normalizeEmergencyCard(card: Partial<EmergencyCard> & { id: string; type: 'emergency' }): EmergencyCard {
  return {
    id: card.id,
    type: 'emergency',
    title: isString(card.title) ? card.title : '',
    message: isString(card.message) ? card.message : '',
    priority: normalizePriority(card.priority, 0),
    action_url: normalizeActionUrl(card.action_url),
  };
}

/**
 * AIBriefingCard 정규화 (SSOT)
 *
 * @param card 원본 카드
 * @returns 정규화된 AIBriefingCard
 */
export function normalizeAIBriefingCard(
  card: Partial<AIBriefingCard> & { id: string; type: 'ai_briefing' }
): AIBriefingCard {
  return {
    id: card.id,
    type: 'ai_briefing',
    title: isString(card.title) ? card.title : '',
    summary: isString(card.summary) ? card.summary : '',
    insights: Array.isArray(card.insights) ? card.insights.filter(isString) : [],
    created_at: normalizeCreatedAt(card.created_at),
    action_url: normalizeActionUrl(card.action_url),
  };
}

/**
 * ClassCard 정규화 (SSOT)
 *
 * @param card 원본 카드
 * @returns 정규화된 ClassCard
 */
export function normalizeClassCard(
  card: Partial<ClassCard> & { id: string; type: 'class' }
): ClassCard {
  return {
    id: card.id,
    type: 'class',
    class_name: isString(card.class_name) ? card.class_name : '',
    start_time: isString(card.start_time) ? card.start_time : DEFAULT_CLASS_START_TIME,
    student_count: isNumber(card.student_count) ? card.student_count : 0,
    attendance_count: isNumber(card.attendance_count) ? card.attendance_count : 0,
    action_url: normalizeActionUrl(card.action_url) || '', // [SSOT] ClassCard.action_url은 string(필수)이므로 빈 문자열 fallback
  };
}

/**
 * StatsCard 정규화 (SSOT)
 *
 * @param card 원본 카드
 * @returns 정규화된 StatsCard
 */
export function normalizeStatsCard(
  card: Partial<StatsCard> & { id: string; type: 'stats' }
): StatsCard {
  return {
    id: card.id,
    type: 'stats',
    title: isString(card.title) ? card.title : '',
    value: isString(card.value) ? card.value : '-',
    unit: isString(card.unit) ? card.unit : undefined,
    trend: isString(card.trend) ? card.trend : undefined,
    action_url: normalizeActionUrl(card.action_url),
    chartDataKey: card.chartDataKey, // [SSOT] 타입이 명확하므로 그대로 전달 (정규화 불필요)
  };
}

/**
 * BillingSummaryCard 정규화 (SSOT)
 *
 * @param card 원본 카드
 * @returns 정규화된 BillingSummaryCard
 */
export function normalizeBillingSummaryCard(
  card: Partial<BillingSummaryCard> & { id: string; type: 'billing_summary' }
): BillingSummaryCard {
  return {
    id: card.id,
    type: 'billing_summary',
    title: isString(card.title) ? card.title : '',
    expected_collection_rate: isNumber(card.expected_collection_rate) ? card.expected_collection_rate : 0,
    unpaid_count: isNumber(card.unpaid_count) ? card.unpaid_count : 0,
    action_url: normalizeActionUrl(card.action_url) || '', // [SSOT] BillingSummaryCard.action_url은 string(필수)이므로 빈 문자열 fallback
    priority: normalizePriority(card.priority, 50),
  };
}

/**
 * StudentTaskCard 정규화 (SSOT)
 *
 * @param card 원본 카드
 * @returns 정규화된 StudentTaskCard
 */
export function normalizeStudentTaskCard(
  card: Partial<StudentTaskCard> & { id: string }
): StudentTaskCard {
  // 정규화된 필드로 StudentTaskCard 타입 보장
  const normalized: StudentTaskCard = {
    id: card.id,
    tenant_id: isString(card.tenant_id) ? card.tenant_id : '',
    entity_id: isString(card.entity_id) ? card.entity_id : '',
    entity_type: isString(card.entity_type) ? card.entity_type : 'student',
    task_type: card.task_type || 'ai_suggested',
    priority: normalizePriority(card.priority, 50),
    title: isString(card.title) ? card.title : '',
    description: isString(card.description) ? card.description : '',
    action_url: normalizeActionUrl(card.action_url) || '', // [SSOT] StudentTaskCard.action_url은 string(필수)이므로 빈 문자열 fallback
    created_at: normalizeCreatedAt(card.created_at),
    expires_at: normalizeCreatedAt(card.expires_at),
    // 선택적 필드
    student_id: isString(card.student_id) ? card.student_id : undefined,
    source: card.source,
    suggested_action: card.suggested_action,
    dedup_key: isString(card.dedup_key) ? card.dedup_key : undefined,
    status: card.status,
    created_by: isString(card.created_by) ? card.created_by : undefined,
    metadata: card.metadata,
    snoozed_at: card.snoozed_at ? normalizeCreatedAt(card.snoozed_at) : undefined,
    remind_at: card.remind_at ? normalizeCreatedAt(card.remind_at) : undefined,
    student_name: isString(card.student_name) ? card.student_name : undefined,
  };
  return normalized;
}

/**
 * DashboardCard 정규화 (SSOT)
 *
 * 타입에 따라 적절한 정규화 함수를 호출
 *
 * @param card 원본 카드
 * @returns 정규화된 DashboardCard
 */
export function normalizeDashboardCard(card: Partial<DashboardCard> & { id: string }): DashboardCard {
  if ('type' in card && typeof card.type === 'string') {
    switch (card.type) {
      case 'emergency': {
        // 타입 가드: card.type이 'emergency'이면 EmergencyCard로 좁힘
        const emergencyCard = card as Partial<EmergencyCard> & { id: string; type: 'emergency' };
        return normalizeEmergencyCard(emergencyCard);
      }
      case 'ai_briefing': {
        const aiBriefingCard = card as Partial<AIBriefingCard> & { id: string; type: 'ai_briefing' };
        return normalizeAIBriefingCard(aiBriefingCard);
      }
      case 'class': {
        const classCard = card as Partial<ClassCard> & { id: string; type: 'class' };
        return normalizeClassCard(classCard);
      }
      case 'stats': {
        const statsCard = card as Partial<StatsCard> & { id: string; type: 'stats' };
        return normalizeStatsCard(statsCard);
      }
      case 'billing_summary': {
        const billingCard = card as Partial<BillingSummaryCard> & { id: string; type: 'billing_summary' };
        return normalizeBillingSummaryCard(billingCard);
      }
    }
  }

  // StudentTaskCard는 별도 처리 (타입이 다름)
  if ('task_type' in card) {
    return normalizeStudentTaskCard(card as Partial<StudentTaskCard> & { id: string });
  }

  // 알 수 없는 타입은 기본값으로 정규화
  return normalizeStatsCard({
    id: card.id,
    type: 'stats',
    title: '',
    value: '-',
    action_url: undefined, // [SSOT] 알 수 없는 타입 fallback은 action_url 없음
  });
}

/**
 * DashboardCard 배열 정규화 (SSOT)
 *
 * @param cards 원본 카드 배열
 * @returns 정규화된 카드 배열
 */
export function normalizeDashboardCards(cards: Array<Partial<DashboardCard> & { id: string }>): DashboardCard[] {
  return cards.map(normalizeDashboardCard);
}

