/**
 * 출석 관리 시스템 상수
 * [불변 규칙] 모든 매직 넘버와 설정값은 이 파일에서 관리
 */

/**
 * 시간 관련 상수
 */
export const ATTENDANCE_TIME_CONFIG = {
  /** 지각 기준 (분 단위) - 수업 시작 후 이 시간 이상 지나면 지각 처리 */
  LATE_THRESHOLD_MINUTES: 10,
} as const;

/**
 * 시간대 필터 범위
 */
export const TIME_RANGE_CONFIG = {
  MORNING: { START: 0, END: 12, LABEL: '오전' },
  AFTERNOON: { START: 12, END: 18, LABEL: '오후' },
  EVENING: { START: 18, END: 24, LABEL: '저녁' },
} as const;

/**
 * 요일 이름 (일요일부터 시작)
 */
export const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;

/**
 * 요일 번호 -> 영문 키 맵
 */
export const DAY_OF_WEEK_MAP: Record<number, string> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
} as const;

/**
 * 데이터 조회 제한
 */
export const DATA_FETCH_LIMITS = {
  /** 학생-수업 관계 조회 제한 */
  STUDENT_CLASSES: 5000,
} as const;

/**
 * History 탭 기본 조회 기간 (일 단위)
 */
export const HISTORY_DEFAULT_DAYS = 30;

/**
 * 레이아웃 크기 상수
 */
export const LAYOUT_SIZES = {
  /** 시간 입력 필드 너비 (px) */
  TIME_INPUT_WIDTH: 90,

  /** 학생 정보 최소 너비 (px) */
  STUDENT_INFO_MIN_WIDTH: 120,

  /** 체크박스 레이블 최소 너비 (px) */
  CHECKBOX_LABEL_MIN_WIDTH: 32,

  /** 시간 배지 최소 너비 (px) */
  TIME_BADGE_MIN_WIDTH: 100,

  /** 아이콘 컨테이너 크기 (px) */
  ICON_CONTAINER_SIZE: 32,
} as const;

