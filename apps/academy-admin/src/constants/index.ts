/**
 * Constants Barrel Export (SSOT)
 *
 * [불변 규칙] 모든 상수는 이 파일을 통해 export
 * [불변 규칙] 페이지에서는 이 파일 하나만 import하면 됨
 * [불변 규칙] Tree-shaking을 위해 명시적 export 사용
 */

// 라우트 상수
export { ROUTES } from './routes';
export type { RouteKey } from './routes';

// 카드 관련 상수
export {
  EMPTY_CARD_MESSAGES,
  EMPTY_CARD_ID_PREFIX,
  CARD_GROUP_LIMITS,
  CARD_TYPE_LABELS,
  PRIORITY_THRESHOLDS,
  DEFAULT_VALUES,
  TEXT_LINE_LIMITS,
  CARD_LABELS,
  EMPTY_MESSAGES,
  RECENT_ACTIVITY_LIMIT,
  DATE_FORMATS,
  DEFAULT_CLASS_START_TIME,
} from './dashboard-cards';

// 정책 경로 상수
// ⚠️ SSOT 원칙: EMERGENCY_CARDS_POLICY_PATHS는 POLICY_REGISTRY를 기반으로 하므로,
// 직접 POLICY_REGISTRY를 사용하는 것을 권장합니다.
// 하위 호환성을 위해 export는 유지하되, 신규 코드에서는 POLICY_REGISTRY 직접 사용 권장
export { EMERGENCY_CARDS_POLICY_PATHS } from './emergency-cards-policy';

// Automation Event Descriptions 상수
// ⚠️ SSOT 원칙: Automation Event 관련 상수와 검증 함수는 이 파일을 통해 export
export {
  POLICY_KEY_V2_CATEGORIES,
  AUTOMATION_EVENT_CRITERIA_FIELDS,
  AUTOMATION_EVENT_DESCRIPTIONS,
  validateAutomationEventDescriptions,
} from './automation-event-descriptions';
export type { AutomationEventCriteriaField } from './automation-event-descriptions';

