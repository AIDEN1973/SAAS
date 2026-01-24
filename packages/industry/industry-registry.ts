/**
 * Industry Terms Registry (SSOT)
 *
 * 모든 업종별 용어 매핑의 단일 정본(Single Source of Truth)
 *
 * [불변 규칙] 업종 특화 용어는 모두 이 레지스트리를 통해 접근
 * [불변 규칙] 하드코딩된 용어 사용 금지
 *
 * 사용 방법:
 * ```typescript
 * import { getIndustryTerms } from '@industry/registry';
 *
 * const terms = getIndustryTerms('academy');
 * console.log(terms.PERSON_TYPE_PRIMARY); // 'student'
 * console.log(terms.PERSON_LABEL_PRIMARY); // '학생'
 * ```
 */

/**
 * 페이지 가시성 설정 인터페이스
 *
 * [불변 규칙] 업종별로 필요한 페이지만 표시
 * [불변 규칙] 새로운 업종 추가 시 이 설정만 추가하면 자동으로 메뉴/라우팅 반영
 */
export interface VisiblePages {
  /** 주요 관리 대상 페이지 (학생/회원/고객/수혜자 관리) */
  primary: boolean;
  /** 출석/방문 관리 페이지 */
  attendance: boolean;
  /** 수업/서비스/프로그램 관리 페이지 */
  classes: boolean;
  /** 강사/트레이너/스타일리스트/직원 관리 페이지 */
  teachers: boolean;
  /** 수납/결제 관리 페이지 */
  billing: boolean;
  /** 통계 분석 페이지 */
  analytics: boolean;
  /** AI 기능 페이지 */
  ai: boolean;
  /** 자동화 설정 페이지 */
  automation: boolean;
  /** 알림톡 설정 페이지 */
  alimtalk: boolean;
  /** 예약 관리 페이지 (salon, real_estate 등) */
  appointments?: boolean;
  /** 매물 관리 페이지 (real_estate 전용) */
  properties?: boolean;
}

/**
 * 업종별 용어 정의 인터페이스
 */
export interface IndustryTerms {
  // 주요 관리 대상 (Primary Person)
  /** 주요 관리 대상 타입 (DB 저장용 - person_type 필터값) */
  PERSON_TYPE_PRIMARY: string;
  /** 주요 관리 대상 단수 라벨 (UI 표시용) */
  PERSON_LABEL_PRIMARY: string;
  /** 주요 관리 대상 복수 라벨 (UI 표시용) */
  PERSON_LABEL_PLURAL: string;

  // 보조 관리 대상 (Secondary Person - 강사, 트레이너 등)
  /** 보조 관리 대상 타입 (DB 저장용) */
  PERSON_TYPE_SECONDARY: string;
  /** 보조 관리 대상 단수 라벨 (UI 표시용) */
  PERSON_LABEL_SECONDARY: string;
  /** 보조 관리 대상 복수 라벨 (UI 표시용) */
  PERSON_LABEL_SECONDARY_PLURAL: string;

  // 보호자/고객 (Guardian/Customer)
  /** 보호자/법정대리인/고객 라벨 (학부모/보호자/회원/고객) */
  GUARDIAN_LABEL: string;

  // 그룹/클래스 개념
  /** 그룹 타입 (DB 저장용) */
  GROUP_TYPE: string;
  /** 그룹 단수 라벨 (UI 표시용) */
  GROUP_LABEL: string;
  /** 그룹 복수 라벨 (UI 표시용) */
  GROUP_LABEL_PLURAL: string;

  // 출석 관련
  /** 출결/출석 라벨 */
  ATTENDANCE_LABEL: string;
  /** 결석 라벨 */
  ABSENCE_LABEL: string;
  /** 지각 라벨 */
  LATE_LABEL: string;
  /** 출석 라벨 */
  PRESENT_LABEL: string;
  /** 사유 라벨 */
  EXCUSED_LABEL: string;
  /** 등원/입장 라벨 */
  CHECK_IN_LABEL: string;
  /** 하원/퇴장 라벨 */
  CHECK_OUT_LABEL: string;
  /** 총원 라벨 */
  TOTAL_LABEL: string;
  /** 수업/세션 라벨 */
  SESSION_LABEL: string;

  // 상담/컨설팅 개념
  /** 상담 라벨 */
  CONSULTATION_LABEL: string;
  /** 상담 복수 라벨 */
  CONSULTATION_LABEL_PLURAL: string;
  /** 상담 타입 라벨 (상담일지, 학습일지, 행동일지, 기타) */
  CONSULTATION_TYPE_LABELS: {
    counseling: string;
    learning: string;
    behavior: string;
    other: string;
  };

  // 통계 카드 제목
  /** "총 {대상} 수" */
  STATS_TOTAL_COUNT_TITLE: string;
  /** "이번 달 신규 등록" */
  STATS_NEW_THIS_MONTH_TITLE: string;
  /** "활성 {대상} 수" */
  STATS_ACTIVE_COUNT_TITLE: string;
  /** "비활성 {대상} 수" */
  STATS_INACTIVE_COUNT_TITLE: string;
  /** "월간 {대상} 성장률" */
  STATS_GROWTH_RATE_TITLE: string;
  /** "이번 주 신규 등록" */
  STATS_WEEKLY_NEW_TITLE: string;
  /** "{대상} 유지율" */
  STATS_RETENTION_RATE_TITLE: string;

  // Emergency Card 메시지
  /** "이탈 위험 단계" */
  EMERGENCY_RISK_LABEL: string;
  /** "결석 상태" */
  EMERGENCY_ABSENT_LABEL: string;
  /** "상담 대기 중" */
  EMERGENCY_CONSULTATION_PENDING_LABEL: string;

  // 태그 관련
  /** 태그 라벨 */
  TAG_LABEL: string;

  // 메시지 관련
  /** 메시지 라벨 */
  MESSAGE_LABEL: string;

  // Dashboard 카드 그룹 라벨
  /** Dashboard 카드 그룹 제목들 */
  CARD_GROUP_LABELS: {
    /** AI 브리핑/인사이트 섹션 */
    briefing: string;
    /** 주요 관리 대상 업무 섹션 (학생/회원/고객) */
    student_task: string;
    /** 수업/서비스/그룹 관련 섹션 */
    class: string;
    /** 출석/방문 통계 섹션 */
    attendance_stats: string;
    /** 주요 관리 대상 성장 지표 섹션 (학생/회원/고객 성장) */
    student_growth_stats: string;
    /** 수익/매출 통계 섹션 */
    revenue_stats: string;
    /** 수납/회비/결제 통계 섹션 */
    collection_stats: string;
  };

  // Task Card 타입 라벨
  TASK_TYPE_LABELS: {
    ai_suggested: string;
    risk: string;
    absence: string;
    counseling: string;
    new_signup: string;
  };

  // 스태프/강사 관련
  /** 스태프 상태: 재직중/활동중 */
  STAFF_ACTIVE: string;
  /** 스태프 상태: 휴직/휴가 */
  STAFF_LEAVE: string;
  /** 스태프 상태: 퇴직/퇴사 */
  STAFF_RESIGNED: string;
  /** 담임/주담당 역할 */
  HOMEROOM_TEACHER: string;
  /** 부담임/부담당 역할 */
  ASSISTANT_TEACHER: string;
  /** 사원번호/직원번호 라벨 */
  STAFF_ID_LABEL: string;
  /** 강사/스태프 매출 배분 라벨 */
  STAFF_REVENUE_DISTRIBUTION: string;

  // 공통 UI 메시지
  MESSAGES: {
    LOADING: string;
    ERROR: string;
    SUCCESS: string;
    ALERT: string;
    CANCEL: string;
    SAVE: string;
    DELETE_CONFIRM: string;
    NO_DATA: string;
    SAVE_SUCCESS: string;
    SAVE_ERROR: string;
  };

  // 수납/청구 관련 (Billing)
  /** 수납/회비/결제 라벨 */
  BILLING_LABEL: string;
  /** 수납/회비 홈 라벨 */
  BILLING_HOME_LABEL: string;
  /** 청구서/회비청구서/결제내역 라벨 */
  INVOICE_LABEL: string;
  /** 청구서 복수 라벨 */
  INVOICE_LABEL_PLURAL: string;
  /** 납부자 라벨 (학부모/회원/고객) */
  PAYER_LABEL: string;
  /** 결제/납부 라벨 */
  PAYMENT_LABEL: string;
  /** 미납/연체 라벨 */
  OVERDUE_LABEL: string;
  /** 수납률/납부율/결제율 라벨 */
  COLLECTION_RATE_LABEL: string;
  /** 마감일/납부기한 라벨 */
  DUE_DATE_LABEL: string;
  /** 금액 라벨 */
  AMOUNT_LABEL: string;

  // 수업/서비스 관련 (Classes/Services)
  /** 과목/서비스종류 라벨 */
  SUBJECT_LABEL: string;
  /** 학년/레벨/등급 라벨 */
  GRADE_LABEL: string;
  /** 정원/수용인원 라벨 */
  CAPACITY_LABEL: string;
  /** 강의실/룸/공간 라벨 */
  ROOM_LABEL: string;

  // 라우팅 경로
  ROUTES: {
    /** 주요 관리 대상 목록 페이지 */
    PRIMARY_LIST: string;
    /** 위험 관리 대상 필터 */
    PRIMARY_RISK: string;
    /** 결석 관리 대상 필터 */
    PRIMARY_ABSENT: string;
    /** 상담 대기 필터 */
    PRIMARY_CONSULTATION: string;
    /** 수업/서비스 관리 페이지 */
    CLASSES: string;
    /** 강사/스태프 관리 페이지 */
    TEACHERS: string;
    /** 예약 관리 페이지 (salon, real_estate 등) */
    APPOINTMENTS?: string;
  };

  // 페이지 가시성 설정
  /** 업종별로 표시할 페이지 설정 */
  VISIBLE_PAGES: VisiblePages;
}

/**
 * Academy (학원) 업종 용어
 */
const ACADEMY_TERMS: IndustryTerms = {
  // Primary: 학생
  PERSON_TYPE_PRIMARY: 'student',
  PERSON_LABEL_PRIMARY: '학생',
  PERSON_LABEL_PLURAL: '학생들',

  // Secondary: 강사
  PERSON_TYPE_SECONDARY: 'teacher',
  PERSON_LABEL_SECONDARY: '강사',
  PERSON_LABEL_SECONDARY_PLURAL: '강사들',

  // Guardian: 학부모
  GUARDIAN_LABEL: '학부모',

  // Group: 수업
  GROUP_TYPE: 'class',
  GROUP_LABEL: '수업',
  GROUP_LABEL_PLURAL: '수업들',

  // 출석
  ATTENDANCE_LABEL: '출결',
  ABSENCE_LABEL: '결석',
  LATE_LABEL: '지각',
  PRESENT_LABEL: '출석',
  EXCUSED_LABEL: '사유',
  CHECK_IN_LABEL: '등원',
  CHECK_OUT_LABEL: '하원',
  TOTAL_LABEL: '총원',
  SESSION_LABEL: '수업',

  // 상담
  CONSULTATION_LABEL: '상담',
  CONSULTATION_LABEL_PLURAL: '상담 내역',
  CONSULTATION_TYPE_LABELS: {
    counseling: '상담일지',
    learning: '학습일지',
    behavior: '행동일지',
    other: '기타',
  },

  // 통계 카드
  STATS_TOTAL_COUNT_TITLE: '총 학생 수',
  STATS_NEW_THIS_MONTH_TITLE: '이번 달 신규 등록',
  STATS_ACTIVE_COUNT_TITLE: '활성 학생 수',
  STATS_INACTIVE_COUNT_TITLE: '비활성 학생 수',
  STATS_GROWTH_RATE_TITLE: '월간 학생 성장률',
  STATS_WEEKLY_NEW_TITLE: '이번 주 신규 등록',
  STATS_RETENTION_RATE_TITLE: '학생 유지율',

  // Emergency Cards
  EMERGENCY_RISK_LABEL: '이탈 위험 단계',
  EMERGENCY_ABSENT_LABEL: '결석 상태',
  EMERGENCY_CONSULTATION_PENDING_LABEL: '상담 대기 중',

  // Tags
  TAG_LABEL: '태그',

  // Messages
  MESSAGE_LABEL: '메시지',

  // Dashboard Card Groups
  CARD_GROUP_LABELS: {
    briefing: 'AI 브리핑',
    student_task: '학생 업무',
    class: '오늘 수업',
    attendance_stats: '출결 통계',
    student_growth_stats: '학생 성장 지표',
    revenue_stats: '매출 통계',
    collection_stats: '수납 통계',
  },

  // Task Types
  TASK_TYPE_LABELS: {
    ai_suggested: 'AI 제안',
    risk: '이탈 위험',
    absence: '결석',
    counseling: '상담 필요',
    new_signup: '신규 등록',
  },

  // Staff/Teacher
  STAFF_ACTIVE: '재직중',
  STAFF_LEAVE: '휴직',
  STAFF_RESIGNED: '퇴직',
  HOMEROOM_TEACHER: '담임',
  ASSISTANT_TEACHER: '부담임',
  STAFF_ID_LABEL: '사원번호',
  STAFF_REVENUE_DISTRIBUTION: '강사 매출 배분',

  // Common UI Messages
  MESSAGES: {
    LOADING: '로딩 중...',
    ERROR: '오류',
    SUCCESS: '성공',
    ALERT: '알림',
    CANCEL: '취소',
    SAVE: '저장',
    DELETE_CONFIRM: '삭제하시겠습니까?',
    NO_DATA: '데이터가 없습니다',
    SAVE_SUCCESS: '저장되었습니다',
    SAVE_ERROR: '저장에 실패했습니다',
  },

  // Billing
  BILLING_LABEL: '수납',
  BILLING_HOME_LABEL: '수납 홈',
  INVOICE_LABEL: '청구서',
  INVOICE_LABEL_PLURAL: '청구서들',
  PAYER_LABEL: '학부모',
  PAYMENT_LABEL: '납부',
  OVERDUE_LABEL: '미납',
  COLLECTION_RATE_LABEL: '수납률',
  DUE_DATE_LABEL: '납부 기한',
  AMOUNT_LABEL: '금액',

  // Classes/Services
  SUBJECT_LABEL: '과목',
  GRADE_LABEL: '대상 학년',
  CAPACITY_LABEL: '정원',
  ROOM_LABEL: '강의실',

  // Routes
  ROUTES: {
    PRIMARY_LIST: '/students/list',
    PRIMARY_RISK: '/students/list?filter=risk',
    PRIMARY_ABSENT: '/students/list?filter=absent',
    PRIMARY_CONSULTATION: '/students/list?filter=consultation',
    CLASSES: '/classes',
    TEACHERS: '/teachers',
  },

  // Visible Pages (Academy는 모든 전통적인 학원 기능 사용)
  VISIBLE_PAGES: {
    primary: true, // 학생 관리
    attendance: true, // 출결 관리
    classes: true, // 수업 관리
    teachers: true, // 강사 관리
    billing: true, // 수납 관리
    analytics: true, // 통계 분석
    ai: true, // AI 기능
    automation: true, // 자동화 설정
    alimtalk: true, // 알림톡 설정
    appointments: false, // 예약 관리 불필요
  },
};

/**
 * Gym (헬스장/피트니스) 업종 용어
 */
const GYM_TERMS: IndustryTerms = {
  // Primary: 회원
  PERSON_TYPE_PRIMARY: 'member',
  PERSON_LABEL_PRIMARY: '회원',
  PERSON_LABEL_PLURAL: '회원들',

  // Secondary: 트레이너
  PERSON_TYPE_SECONDARY: 'trainer',
  PERSON_LABEL_SECONDARY: '트레이너',
  PERSON_LABEL_SECONDARY_PLURAL: '트레이너들',

  // Guardian: 회원 (본인)
  GUARDIAN_LABEL: '회원',

  // Group: 수업
  GROUP_TYPE: 'session',
  GROUP_LABEL: '수업',
  GROUP_LABEL_PLURAL: '수업들',

  // 출석
  ATTENDANCE_LABEL: '출석',
  ABSENCE_LABEL: '결석',
  LATE_LABEL: '지각',
  PRESENT_LABEL: '출석',
  EXCUSED_LABEL: '사유',
  CHECK_IN_LABEL: '입장',
  CHECK_OUT_LABEL: '퇴장',
  TOTAL_LABEL: '총원',
  SESSION_LABEL: '세션',

  // 상담
  CONSULTATION_LABEL: '상담',
  CONSULTATION_LABEL_PLURAL: '상담 내역',
  CONSULTATION_TYPE_LABELS: {
    counseling: '상담 내역',
    learning: '운동 기록',
    behavior: '특이사항',
    other: '기타',
  },

  // 통계 카드
  STATS_TOTAL_COUNT_TITLE: '총 회원 수',
  STATS_NEW_THIS_MONTH_TITLE: '이번 달 신규 등록',
  STATS_ACTIVE_COUNT_TITLE: '활성 회원 수',
  STATS_INACTIVE_COUNT_TITLE: '비활성 회원 수',
  STATS_GROWTH_RATE_TITLE: '월간 회원 성장률',
  STATS_WEEKLY_NEW_TITLE: '이번 주 신규 등록',
  STATS_RETENTION_RATE_TITLE: '회원 유지율',

  // Emergency Cards
  EMERGENCY_RISK_LABEL: '이탈 위험',
  EMERGENCY_ABSENT_LABEL: '결석 상태',
  EMERGENCY_CONSULTATION_PENDING_LABEL: '상담 대기 중',

  // Tags
  TAG_LABEL: '태그',

  // Messages
  MESSAGE_LABEL: '메시지',

  // Dashboard Card Groups
  CARD_GROUP_LABELS: {
    briefing: 'AI 브리핑',
    student_task: '회원 업무',
    class: '오늘 수업',
    attendance_stats: '출석 통계',
    student_growth_stats: '회원 성장 지표',
    revenue_stats: '매출 통계',
    collection_stats: '회비 통계',
  },

  // Task Types
  TASK_TYPE_LABELS: {
    ai_suggested: 'AI 제안',
    risk: '이탈 위험',
    absence: '결석',
    counseling: '상담 필요',
    new_signup: '신규 등록',
  },

  // Staff/Teacher
  STAFF_ACTIVE: '활동중',
  STAFF_LEAVE: '휴가',
  STAFF_RESIGNED: '퇴사',
  HOMEROOM_TEACHER: '주담당',
  ASSISTANT_TEACHER: '부담당',
  STAFF_ID_LABEL: '직원번호',
  STAFF_REVENUE_DISTRIBUTION: '트레이너 수익 배분',

  // Common UI Messages
  MESSAGES: {
    LOADING: '로딩 중...',
    ERROR: '오류',
    SUCCESS: '성공',
    ALERT: '알림',
    CANCEL: '취소',
    SAVE: '저장',
    DELETE_CONFIRM: '삭제하시겠습니까?',
    NO_DATA: '데이터가 없습니다',
    SAVE_SUCCESS: '저장되었습니다',
    SAVE_ERROR: '저장에 실패했습니다',
  },

  // Billing
  BILLING_LABEL: '회비',
  BILLING_HOME_LABEL: '회비 홈',
  INVOICE_LABEL: '회비 청구서',
  INVOICE_LABEL_PLURAL: '회비 청구서들',
  PAYER_LABEL: '회원',
  PAYMENT_LABEL: '납부',
  OVERDUE_LABEL: '미납',
  COLLECTION_RATE_LABEL: '납부율',
  DUE_DATE_LABEL: '납부 기한',
  AMOUNT_LABEL: '금액',

  // Classes/Services
  SUBJECT_LABEL: '프로그램',
  GRADE_LABEL: '레벨',
  CAPACITY_LABEL: '정원',
  ROOM_LABEL: '룸',

  // Routes
  ROUTES: {
    PRIMARY_LIST: '/members/list',
    PRIMARY_RISK: '/members/list?filter=risk',
    PRIMARY_ABSENT: '/members/list?filter=absent',
    PRIMARY_CONSULTATION: '/members/list?filter=consultation',
    CLASSES: '/classes',
    TEACHERS: '/trainers',
  },

  // Visible Pages (Gym은 회원/수업/출석 중심)
  VISIBLE_PAGES: {
    primary: true, // 회원 관리
    attendance: true, // 출석 관리
    classes: true, // 수업 관리
    teachers: true, // 트레이너 관리
    billing: true, // 수납 관리
    analytics: true, // 통계 분석
    ai: true, // AI 기능
    automation: true, // 자동화 설정
    alimtalk: true, // 알림톡 설정
    appointments: false, // 예약 관리 불필요 (수업 시스템 사용)
  },
};

/**
 * Salon (미용실) 업종 용어
 */
const SALON_TERMS: IndustryTerms = {
  // Primary: 고객
  PERSON_TYPE_PRIMARY: 'customer',
  PERSON_LABEL_PRIMARY: '고객',
  PERSON_LABEL_PLURAL: '고객들',

  // Secondary: 스타일리스트
  PERSON_TYPE_SECONDARY: 'stylist',
  PERSON_LABEL_SECONDARY: '스타일리스트',
  PERSON_LABEL_SECONDARY_PLURAL: '스타일리스트들',

  // Guardian: 고객 (본인)
  GUARDIAN_LABEL: '고객',

  // Group: 서비스
  GROUP_TYPE: 'service',
  GROUP_LABEL: '서비스',
  GROUP_LABEL_PLURAL: '서비스들',

  // 출석 (미용실은 출석 개념 없음)
  ATTENDANCE_LABEL: '방문',
  ABSENCE_LABEL: '부재',
  LATE_LABEL: '지각',
  PRESENT_LABEL: '방문',
  EXCUSED_LABEL: '사유',
  CHECK_IN_LABEL: '입장',
  CHECK_OUT_LABEL: '퇴장',
  TOTAL_LABEL: '총 고객',
  SESSION_LABEL: '시술',

  // 상담
  CONSULTATION_LABEL: '상담',
  CONSULTATION_LABEL_PLURAL: '상담 내역',
  CONSULTATION_TYPE_LABELS: {
    counseling: '상담 내역',
    learning: '스타일 기록',
    behavior: '특이사항',
    other: '기타',
  },

  // 통계 카드
  STATS_TOTAL_COUNT_TITLE: '총 고객 수',
  STATS_NEW_THIS_MONTH_TITLE: '이번 달 신규 등록',
  STATS_ACTIVE_COUNT_TITLE: '활성 고객 수',
  STATS_INACTIVE_COUNT_TITLE: '비활성 고객 수',
  STATS_GROWTH_RATE_TITLE: '월간 고객 성장률',
  STATS_WEEKLY_NEW_TITLE: '이번 주 신규 등록',
  STATS_RETENTION_RATE_TITLE: '고객 유지율',

  // Emergency Cards
  EMERGENCY_RISK_LABEL: '이탈 위험',
  EMERGENCY_ABSENT_LABEL: '방문 중단',
  EMERGENCY_CONSULTATION_PENDING_LABEL: '상담 대기 중',

  // Tags
  TAG_LABEL: '태그',

  // Messages
  MESSAGE_LABEL: '메시지',

  // Dashboard Card Groups
  CARD_GROUP_LABELS: {
    briefing: 'AI 브리핑',
    student_task: '고객 업무',
    class: '오늘 예약',
    attendance_stats: '방문 통계',
    student_growth_stats: '고객 성장 지표',
    revenue_stats: '매출 통계',
    collection_stats: '결제 통계',
  },

  // Task Types
  TASK_TYPE_LABELS: {
    ai_suggested: 'AI 제안',
    risk: '이탈 위험',
    absence: '방문 중단',
    counseling: '상담 필요',
    new_signup: '신규 등록',
  },

  // Staff/Teacher
  STAFF_ACTIVE: '근무중',
  STAFF_LEAVE: '휴가',
  STAFF_RESIGNED: '퇴사',
  HOMEROOM_TEACHER: '주담당',
  ASSISTANT_TEACHER: '보조',
  STAFF_ID_LABEL: '직원번호',
  STAFF_REVENUE_DISTRIBUTION: '스태프 수익 배분',

  // Common UI Messages
  MESSAGES: {
    LOADING: '로딩 중...',
    ERROR: '오류',
    SUCCESS: '성공',
    ALERT: '알림',
    CANCEL: '취소',
    SAVE: '저장',
    DELETE_CONFIRM: '삭제하시겠습니까?',
    NO_DATA: '데이터가 없습니다',
    SAVE_SUCCESS: '저장되었습니다',
    SAVE_ERROR: '저장에 실패했습니다',
  },

  // Billing
  BILLING_LABEL: '결제',
  BILLING_HOME_LABEL: '결제 홈',
  INVOICE_LABEL: '결제 내역',
  INVOICE_LABEL_PLURAL: '결제 내역들',
  PAYER_LABEL: '고객',
  PAYMENT_LABEL: '결제',
  OVERDUE_LABEL: '미결제',
  COLLECTION_RATE_LABEL: '결제율',
  DUE_DATE_LABEL: '결제 기한',
  AMOUNT_LABEL: '금액',

  // Classes/Services
  SUBJECT_LABEL: '서비스 종류',
  GRADE_LABEL: '고객 등급',
  CAPACITY_LABEL: '예약 정원',
  ROOM_LABEL: '룸',

  // Routes
  ROUTES: {
    PRIMARY_LIST: '/customers/list',
    PRIMARY_RISK: '/customers/list?filter=risk',
    PRIMARY_ABSENT: '/customers/list?filter=absent',
    PRIMARY_CONSULTATION: '/customers/list?filter=consultation',
    CLASSES: '/services',
    TEACHERS: '/stylists',
    APPOINTMENTS: '/appointments',
  },

  // Visible Pages (Salon은 예약 중심, 출석 불필요)
  VISIBLE_PAGES: {
    primary: true, // 고객 관리
    attendance: false, // 출석 관리 불필요
    classes: true, // 서비스 관리
    teachers: true, // 스타일리스트 관리
    billing: true, // 수납 관리
    analytics: true, // 통계 분석
    ai: true, // AI 기능
    automation: true, // 자동화 설정
    alimtalk: true, // 알림톡 설정
    appointments: true, // 예약 관리 필수
  },
};

/**
 * Nail Salon (네일샵) 업종 용어
 */
const NAIL_SALON_TERMS: IndustryTerms = {
  // Primary: 고객
  PERSON_TYPE_PRIMARY: 'customer',
  PERSON_LABEL_PRIMARY: '고객',
  PERSON_LABEL_PLURAL: '고객들',

  // Secondary: 네일 아티스트
  PERSON_TYPE_SECONDARY: 'nail_artist',
  PERSON_LABEL_SECONDARY: '네일 아티스트',
  PERSON_LABEL_SECONDARY_PLURAL: '네일 아티스트들',

  // Guardian: 고객 (본인)
  GUARDIAN_LABEL: '고객',

  // Group: 서비스
  GROUP_TYPE: 'service',
  GROUP_LABEL: '서비스',
  GROUP_LABEL_PLURAL: '서비스들',

  // 출석 (네일샵은 출석 개념 없음)
  ATTENDANCE_LABEL: '방문',
  ABSENCE_LABEL: '부재',
  LATE_LABEL: '지각',
  PRESENT_LABEL: '방문',
  EXCUSED_LABEL: '사유',
  CHECK_IN_LABEL: '입장',
  CHECK_OUT_LABEL: '퇴장',
  TOTAL_LABEL: '총 고객',
  SESSION_LABEL: '시술',

  // 상담
  CONSULTATION_LABEL: '상담',
  CONSULTATION_LABEL_PLURAL: '상담 내역',
  CONSULTATION_TYPE_LABELS: {
    counseling: '상담 내역',
    learning: '네일 기록',
    behavior: '특이사항',
    other: '기타',
  },

  // 통계 카드
  STATS_TOTAL_COUNT_TITLE: '총 고객 수',
  STATS_NEW_THIS_MONTH_TITLE: '이번 달 신규 등록',
  STATS_ACTIVE_COUNT_TITLE: '활성 고객 수',
  STATS_INACTIVE_COUNT_TITLE: '비활성 고객 수',
  STATS_GROWTH_RATE_TITLE: '월간 고객 성장률',
  STATS_WEEKLY_NEW_TITLE: '이번 주 신규 등록',
  STATS_RETENTION_RATE_TITLE: '고객 유지율',

  // Emergency Cards
  EMERGENCY_RISK_LABEL: '이탈 위험',
  EMERGENCY_ABSENT_LABEL: '방문 중단',
  EMERGENCY_CONSULTATION_PENDING_LABEL: '상담 대기 중',

  // Tags
  TAG_LABEL: '태그',

  // Messages
  MESSAGE_LABEL: '메시지',

  // Dashboard Card Groups
  CARD_GROUP_LABELS: {
    briefing: 'AI 브리핑',
    student_task: '고객 업무',
    class: '오늘 예약',
    attendance_stats: '방문 통계',
    student_growth_stats: '고객 성장 지표',
    revenue_stats: '매출 통계',
    collection_stats: '결제 통계',
  },

  // Task Types
  TASK_TYPE_LABELS: {
    ai_suggested: 'AI 제안',
    risk: '이탈 위험',
    absence: '방문 중단',
    counseling: '상담 필요',
    new_signup: '신규 등록',
  },

  // Staff/Teacher
  STAFF_ACTIVE: '근무중',
  STAFF_LEAVE: '휴가',
  STAFF_RESIGNED: '퇴사',
  HOMEROOM_TEACHER: '주담당',
  ASSISTANT_TEACHER: '보조',
  STAFF_ID_LABEL: '직원번호',
  STAFF_REVENUE_DISTRIBUTION: '스태프 수익 배분',

  // Common UI Messages
  MESSAGES: {
    LOADING: '로딩 중...',
    ERROR: '오류',
    SUCCESS: '성공',
    ALERT: '알림',
    CANCEL: '취소',
    SAVE: '저장',
    DELETE_CONFIRM: '삭제하시겠습니까?',
    NO_DATA: '데이터가 없습니다',
    SAVE_SUCCESS: '저장되었습니다',
    SAVE_ERROR: '저장에 실패했습니다',
  },

  // Billing
  BILLING_LABEL: '결제',
  BILLING_HOME_LABEL: '결제 홈',
  INVOICE_LABEL: '결제 내역',
  INVOICE_LABEL_PLURAL: '결제 내역들',
  PAYER_LABEL: '고객',
  PAYMENT_LABEL: '결제',
  OVERDUE_LABEL: '미결제',
  COLLECTION_RATE_LABEL: '결제율',
  DUE_DATE_LABEL: '결제 기한',
  AMOUNT_LABEL: '금액',

  // Classes/Services
  SUBJECT_LABEL: '서비스 종류',
  GRADE_LABEL: '고객 등급',
  CAPACITY_LABEL: '예약 정원',
  ROOM_LABEL: '네일 테이블',

  // Routes
  ROUTES: {
    PRIMARY_LIST: '/customers/list',
    PRIMARY_RISK: '/customers/list?filter=risk',
    PRIMARY_ABSENT: '/customers/list?filter=absent',
    PRIMARY_CONSULTATION: '/customers/list?filter=consultation',
    CLASSES: '/services',
    TEACHERS: '/nail-artists',
    APPOINTMENTS: '/appointments',
  },

  // Visible Pages (Nail Salon은 예약 중심, 출석 불필요)
  VISIBLE_PAGES: {
    primary: true, // 고객 관리
    attendance: false, // 출석 관리 불필요
    classes: true, // 서비스 관리
    teachers: true, // 네일 아티스트 관리
    billing: true, // 수납 관리
    analytics: true, // 통계 분석
    ai: true, // AI 기능
    automation: true, // 자동화 설정
    alimtalk: true, // 알림톡 설정
    appointments: true, // 예약 관리 필수
  },
};

/**
 * Real Estate (부동산) 업종 용어
 */
const REAL_ESTATE_TERMS: IndustryTerms = {
  // Primary: 고객
  PERSON_TYPE_PRIMARY: 'client',
  PERSON_LABEL_PRIMARY: '고객',
  PERSON_LABEL_PLURAL: '고객들',

  // Secondary: 중개인
  PERSON_TYPE_SECONDARY: 'agent',
  PERSON_LABEL_SECONDARY: '중개인',
  PERSON_LABEL_SECONDARY_PLURAL: '중개인들',

  // Guardian: 고객 (본인)
  GUARDIAN_LABEL: '고객',

  // Group: 매물
  GROUP_TYPE: 'property',
  GROUP_LABEL: '매물',
  GROUP_LABEL_PLURAL: '매물들',

  // 출석 (부동산은 출석 개념 없음)
  ATTENDANCE_LABEL: '방문',
  ABSENCE_LABEL: '부재',
  LATE_LABEL: '지각',
  PRESENT_LABEL: '방문',
  EXCUSED_LABEL: '사유',
  CHECK_IN_LABEL: '방문',
  CHECK_OUT_LABEL: '퇴장',
  TOTAL_LABEL: '총 고객',
  SESSION_LABEL: '상담',

  // 상담
  CONSULTATION_LABEL: '상담',
  CONSULTATION_LABEL_PLURAL: '상담 내역',
  CONSULTATION_TYPE_LABELS: {
    counseling: '상담 기록',
    learning: '매물 안내',
    behavior: '특이사항',
    other: '기타',
  },

  // 통계 카드
  STATS_TOTAL_COUNT_TITLE: '총 고객 수',
  STATS_NEW_THIS_MONTH_TITLE: '이번 달 신규 등록',
  STATS_ACTIVE_COUNT_TITLE: '활성 고객 수',
  STATS_INACTIVE_COUNT_TITLE: '비활성 고객 수',
  STATS_GROWTH_RATE_TITLE: '월간 고객 성장률',
  STATS_WEEKLY_NEW_TITLE: '이번 주 신규 등록',
  STATS_RETENTION_RATE_TITLE: '고객 유지율',

  // Emergency Cards
  EMERGENCY_RISK_LABEL: '이탈 위험',
  EMERGENCY_ABSENT_LABEL: '방문 중단',
  EMERGENCY_CONSULTATION_PENDING_LABEL: '상담 대기 중',

  // Tags
  TAG_LABEL: '태그',

  // Messages
  MESSAGE_LABEL: '메시지',

  // Dashboard Card Groups
  CARD_GROUP_LABELS: {
    briefing: 'AI 브리핑',
    student_task: '고객 업무',
    class: '오늘 상담',
    attendance_stats: '방문 통계',
    student_growth_stats: '고객 성장 지표',
    revenue_stats: '매출 통계',
    collection_stats: '계약금 통계',
  },

  // Task Types
  TASK_TYPE_LABELS: {
    ai_suggested: 'AI 제안',
    risk: '이탈 위험',
    absence: '방문 중단',
    counseling: '상담 필요',
    new_signup: '신규 등록',
  },

  // Staff/Teacher
  STAFF_ACTIVE: '근무중',
  STAFF_LEAVE: '휴가',
  STAFF_RESIGNED: '퇴사',
  HOMEROOM_TEACHER: '주담당',
  ASSISTANT_TEACHER: '보조',
  STAFF_ID_LABEL: '직원번호',
  STAFF_REVENUE_DISTRIBUTION: '스태프 수익 배분',

  // Common UI Messages
  MESSAGES: {
    LOADING: '로딩 중...',
    ERROR: '오류',
    SUCCESS: '성공',
    ALERT: '알림',
    CANCEL: '취소',
    SAVE: '저장',
    DELETE_CONFIRM: '삭제하시겠습니까?',
    NO_DATA: '데이터가 없습니다',
    SAVE_SUCCESS: '저장되었습니다',
    SAVE_ERROR: '저장에 실패했습니다',
  },

  // Billing (부동산은 별도 계약 시스템 사용, 표시만 위한 더미 데이터)
  BILLING_LABEL: '계약금',
  BILLING_HOME_LABEL: '계약금 홈',
  INVOICE_LABEL: '계약금 청구서',
  INVOICE_LABEL_PLURAL: '계약금 청구서들',
  PAYER_LABEL: '고객',
  PAYMENT_LABEL: '납부',
  OVERDUE_LABEL: '미납',
  COLLECTION_RATE_LABEL: '수납률',
  DUE_DATE_LABEL: '납부 기한',
  AMOUNT_LABEL: '금액',

  // Classes/Services
  SUBJECT_LABEL: '매물 유형',
  GRADE_LABEL: '등급',
  CAPACITY_LABEL: '수용 인원',
  ROOM_LABEL: '호실',

  // Routes
  ROUTES: {
    PRIMARY_LIST: '/clients/list',
    PRIMARY_RISK: '/clients/list?filter=risk',
    PRIMARY_ABSENT: '/clients/list?filter=absent',
    PRIMARY_CONSULTATION: '/clients/list?filter=consultation',
    CLASSES: '/properties',
    TEACHERS: '/agents',
    APPOINTMENTS: '/appointments',
  },

  // Visible Pages (Real Estate는 매물/예약 중심, 출석/수납 불필요)
  VISIBLE_PAGES: {
    primary: true, // 고객 관리
    attendance: false, // 출석 관리 불필요
    classes: false, // 수업 개념 없음
    teachers: true, // 중개인 관리
    billing: false, // 수납 관리 불필요 (별도 계약 시스템)
    analytics: true, // 통계 분석
    ai: true, // AI 기능
    automation: true, // 자동화 설정
    alimtalk: true, // 알림톡 설정
    appointments: true, // 방문 예약 필수
    properties: true, // 매물 관리 페이지
  },
};

/**
 * Industry Terms Registry (SSOT)
 *
 * [불변 규칙] 지원 업종: academy, gym, salon, nail_salon, real_estate
 * [불변 규칙] 백엔드 IndustryType과 정확히 일치해야 함
 */
const INDUSTRY_TERMS_REGISTRY: Record<string, IndustryTerms> = {
  academy: ACADEMY_TERMS,
  gym: GYM_TERMS,
  salon: SALON_TERMS,
  nail_salon: NAIL_SALON_TERMS,
  real_estate: REAL_ESTATE_TERMS,
};

/**
 * 지원되는 업종 타입 목록
 */
export const SUPPORTED_INDUSTRY_TYPES = Object.keys(INDUSTRY_TERMS_REGISTRY) as string[];

/**
 * 업종별 용어 조회 함수 (SSOT)
 *
 * @param industryType 업종 타입 ('academy', 'gym', 'salon', 'nail_salon', 'real_estate')
 * @returns 업종별 용어 객체
 * @throws Error 지원하지 않는 업종 타입인 경우 academy로 fallback
 *
 * @example
 * ```typescript
 * const terms = getIndustryTerms('academy');
 * console.log(terms.PERSON_LABEL_PRIMARY); // '학생'
 *
 * const salonTerms = getIndustryTerms('salon');
 * console.log(salonTerms.PERSON_LABEL_PRIMARY); // '고객'
 * console.log(salonTerms.VISIBLE_PAGES.attendance); // false (미용실은 출석 불필요)
 * ```
 */
export function getIndustryTerms(industryType: string): IndustryTerms {
  const terms = INDUSTRY_TERMS_REGISTRY[industryType];

  if (!terms) {
    // Fail Closed: 지원하지 않는 업종은 academy로 fallback
    if (import.meta.env?.DEV) {
      console.warn(
        `[Industry Registry] Unsupported industry type: "${industryType}". ` +
        `Falling back to "academy". ` +
        `Supported types: ${SUPPORTED_INDUSTRY_TYPES.join(', ')}`
      );
    }
    return ACADEMY_TERMS;
  }

  return terms;
}

/**
 * 업종 타입 검증 함수
 *
 * @param industryType 검증할 업종 타입
 * @returns 유효한 업종 타입이면 true, 아니면 false
 */
export function isValidIndustryType(industryType: string): boolean {
  return industryType in INDUSTRY_TERMS_REGISTRY;
}

/**
 * 기본 업종 타입 (Fallback)
 */
export const DEFAULT_INDUSTRY_TYPE = 'academy';

/**
 * 기본 용어 (Fallback)
 */
export const DEFAULT_TERMS = ACADEMY_TERMS;

/**
 * 업종 타입 라벨 매핑 (SSOT)
 *
 * UI에서 업종 타입을 표시할 때 사용하는 라벨
 *
 * @example
 * ```typescript
 * import { INDUSTRY_TYPE_LABELS } from '@industry/registry';
 *
 * const label = INDUSTRY_TYPE_LABELS['academy']; // '학원'
 * ```
 */
export const INDUSTRY_TYPE_LABELS: Record<string, string> = {
  academy: '학원',
  gym: '헬스장',
  salon: '미용실',
  nail_salon: '네일샵',
  real_estate: '부동산',
};
