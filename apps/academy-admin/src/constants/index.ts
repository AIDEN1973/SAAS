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

// 서브 사이드바 메뉴 상수
export {
  // 출결관리 페이지
  ATTENDANCE_SUB_MENU_ITEMS,
  DEFAULT_ATTENDANCE_SUB_MENU,
  // 매뉴얼 페이지
  MANUAL_SUB_MENU_ITEMS,
  DEFAULT_MANUAL_SUB_MENU,
  // 학생관리 페이지
  STUDENTS_SUB_MENU_ITEMS,
  DEFAULT_STUDENTS_SUB_MENU,
  STUDENTS_RELATED_MENUS,
  // 문자발송 페이지
  NOTIFICATIONS_SUB_MENU_ITEMS,
  DEFAULT_NOTIFICATIONS_SUB_MENU,
  NOTIFICATIONS_RELATED_MENUS,
  // 통계분석 페이지
  ANALYTICS_SUB_MENU_ITEMS,
  DEFAULT_ANALYTICS_SUB_MENU,
  // 인공지능 페이지
  AI_SUB_MENU_ITEMS,
  DEFAULT_AI_SUB_MENU,
  // 수업관리 페이지
  CLASSES_SUB_MENU_ITEMS,
  DEFAULT_CLASSES_SUB_MENU,
  CLASSES_RELATED_MENUS,
  // 강사관리 페이지
  TEACHERS_SUB_MENU_ITEMS,
  DEFAULT_TEACHERS_SUB_MENU,
  TEACHERS_RELATED_MENUS,
  // 수납관리 페이지
  BILLING_SUB_MENU_ITEMS,
  DEFAULT_BILLING_SUB_MENU,
  BILLING_RELATED_MENUS,
  // 자동화 설정 페이지
  AUTOMATION_SUB_MENU_ITEMS,
  DEFAULT_AUTOMATION_SUB_MENU,
  // 알림톡 설정 페이지
  ALIMTALK_SUB_MENU_ITEMS,
  DEFAULT_ALIMTALK_SUB_MENU,
  // 공통
  SUB_SIDEBAR_WIDTH,
  SUB_MENU_QUERY_PARAM,
  getSubMenuFromUrl,
  setSubMenuToUrl,
} from './sub-sidebar-menus';
export type {
  AttendanceSubMenuId,
  ManualSubMenuId,
  StudentsSubMenuId,
  NotificationsSubMenuId,
  AnalyticsSubMenuId,
  AISubMenuId,
  ClassesSubMenuId,
  TeachersSubMenuId,
  BillingSubMenuId,
  AutomationSubMenuId,
  AlimtalkSubMenuId,
} from './sub-sidebar-menus';
