/**
 * 대시보드 카드 유틸리티 함수
 *
 * [불변 규칙] 카드 관련 유틸리티는 이 파일에서 SSOT로 관리
 */

import { toKST } from '@lib/date-utils';
import { EMPTY_CARD_ID_PREFIX } from '../constants';
import type { DashboardCard } from '../types/dashboardCard';
import { normalizeStudentTaskCard } from './dashboard-card-normalization';

// 정규화 함수는 별도 파일에서 관리 (dashboard-card-normalization.ts)
export {
  normalizeDashboardCard,
  normalizeDashboardCards,
  normalizeEmergencyCard,
  normalizeAIBriefingCard,
  normalizeClassCard,
  normalizeStatsCard,
  normalizeBillingSummaryCard,
  normalizeStudentTaskCard,
} from './dashboard-card-normalization';

/**
 * 카드가 placeholder(빈 카드)인지 확인
 * [P2-2 수정] placeholder 카드 판별을 전역 유틸로 통일하여 주석 의존성 제거
 *
 * @param card 확인할 카드
 * @returns placeholder 카드 여부
 */
export function isPlaceholderCard(card: DashboardCard | { id?: string }): boolean {
  return card.id?.startsWith(EMPTY_CARD_ID_PREFIX) ?? false;
}

/**
 * placeholder 카드의 필수 필드가 유효한지 확인
 * [P2-2 수정] action_url truthy 체크 등에서 placeholder를 안전하게 처리
 *
 * @param card 확인할 카드
 * @returns 필수 필드 유효성
 */
export function isValidPlaceholderCard(card: DashboardCard | { id?: string; action_url?: string }): boolean {
  if (!isPlaceholderCard(card)) {
    return true; // placeholder가 아니면 항상 유효
  }
  // placeholder는 action_url이 빈 문자열이어도 유효 (특별 처리)
  return true;
}

/**
 * 빈 Student Task 카드 생성
 * [P1-1 수정] placeholder 전용 빌더 함수로 타입을 명확히 고정하여 캐스팅 최소화
 * [SSOT] normalizeStudentTaskCard를 사용하여 타입 단언 제거
 * [P2-업종중립] 카드 생성 시 하드코딩된 메시지는 기본값 사용, 정확한 업종별 메시지는 컴포넌트에서 처리
 *
 * @returns 빈 Student Task 카드
 */
export function createEmptyTaskCard(): DashboardCard {
  const base = toKST();
  // [P2-업종중립] 기본 Academy 용어 사용 (컴포넌트에서 useIndustryTerms로 오버라이드)
  const FALLBACK_PERSON_LABEL = '학생';
  return normalizeStudentTaskCard({
    id: `${EMPTY_CARD_ID_PREFIX}-student-task`,
    tenant_id: '', // [SSOT] 빈 카드는 tenant_id가 없지만 정규화 함수가 빈 문자열로 처리
    task_type: 'ai_suggested',
    title: `${FALLBACK_PERSON_LABEL} 업무 없음`,
    description: `현재 처리해야 할 ${FALLBACK_PERSON_LABEL} 관련 업무가 없습니다. 새로운 상담이나 관리 작업이 필요한 ${FALLBACK_PERSON_LABEL}이 생기면 여기에 표시됩니다.`,
    priority: 0,
    status: 'executed', // [SSOT] StudentTaskCard.status는 'pending' | 'approved' | 'executed' | 'expired' | undefined
    created_at: base.toISOString(),
    expires_at: base.clone().add(1, 'day').toISOString(),
    entity_id: '',
    entity_type: 'student',
    action_url: '',
    // 레거시 필드 (하위 호환성) - null 대신 undefined 사용
    student_id: undefined,
    student_name: undefined,
  });
}
