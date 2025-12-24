/**
 * 대시보드 카드 관련 상수
 *
 * [불변 규칙] 하드코딩 금지, 모든 문자열은 상수로 관리
 * [불변 규칙] SSOT 원칙 준수: 빈 카드 메시지는 이 파일에만 존재
 */

export const EMPTY_CARD_MESSAGES = {
  EMERGENCY: {
    TITLE: '긴급 알림 없음',
    MESSAGE: '현재 긴급 알림이 없습니다.',
  },
  AI_BRIEFING: {
    TITLE: 'AI 브리핑 없음',
    SUMMARY: '현재 AI 브리핑 정보가 없습니다.',
  },
  STUDENT_TASK: {
    TITLE: '학생 업무 없음',
    DESCRIPTION: '현재 처리할 학생 업무가 없습니다.',
  },
  CLASS: {
    CLASS_NAME: '오늘 수업 없음',
    START_TIME: '-',
    ATTENDANCE: '출석: 0/0',
  },
  STATS: {
    TITLE: '통계 없음',
    VALUE: '-',
  },
  BILLING_SUMMARY: {
    TITLE: '청구 요약 없음',
    EXPECTED_COLLECTION_RATE: 0,
    UNPAID_COUNT: 0,
  },
} as const;

/**
 * 빈 카드 ID 접두사
 */
export const EMPTY_CARD_ID_PREFIX = 'empty';

/**
 * 카드 그룹별 최대 개수 제한
 */
export const CARD_GROUP_LIMITS = {
  EMERGENCY: 3,
  AI_BRIEFING: 2,
  TASKS: 3,
  CLASSES: 2,
  BILLING: 2,
  STATS: 20, // 정량적 지표 확장을 위해 제한 증가
} as const;

/**
 * 카드 타입별 라벨
 */
export const CARD_TYPE_LABELS = {
  EMERGENCY: '긴급 알림',
  AI_BRIEFING: 'AI 브리핑',
  PRIORITY_PREFIX: '우선순위',
} as const;

/**
 * 우선순위 배지 색상 임계값
 */
export const PRIORITY_THRESHOLDS = {
  HIGH: 70,
  MEDIUM: 40,
} as const;

/**
 * 기본값 상수
 *
 * [주의] opacity 값은 CSS 변수를 직접 사용해야 합니다:
 * - 빈 카드: var(--opacity-inactive)
 * - 일반: var(--opacity-full)
 *
 * 이 상수들은 CSS 변수를 사용할 수 없는 경우(예: JavaScript 계산)에만 사용합니다.
 */
export const DEFAULT_VALUES = {
  /** SVG strokeWidth fallback 값 (CSS 변수를 읽지 못할 때) */
  STROKE_WIDTH_FALLBACK: 2,
  /** AI Briefing 최대 인사이트 개수 */
  MAX_INSIGHTS: 3,
  /** 제로 값 (비교용) */
  ZERO: 0,
} as const;

/**
 * 텍스트 줄 수 제한
 */
export const TEXT_LINE_LIMITS = {
  TITLE: 2,
  DESCRIPTION: 3,
} as const;

/**
 * 카드 라벨 (ClassCard, BillingSummaryCard 등)
 */
export const CARD_LABELS = {
  ATTENDANCE_PREFIX: '출석:',
  EXPECTED_COLLECTION_RATE: '예상 수납률',
  UNPAID_PREFIX: '미납',
  UNPAID_SUFFIX: '건',
  IMMEDIATE_DELIVERY: '즉시',
  SCOPE_PARTIAL: '일부',
} as const;

/**
 * 빈 카드 메시지
 */
export const EMPTY_MESSAGES = {
  DATA: '데이터 없음',
  ALERT: '알림 없음',
} as const;

/**
 * 최근 활동 표시 개수 제한
 */
export const RECENT_ACTIVITY_LIMIT = 5;

/**
 * 날짜 포맷 문자열
 */
export const DATE_FORMATS = {
  SHORT: 'MM월 DD일',
  SHORT_WITH_TIME: 'MM월 DD일 HH:mm',
} as const;

