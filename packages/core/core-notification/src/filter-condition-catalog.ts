/**
 * Filter Condition Catalog (SSOT)
 *
 * 태그 기반 회원 필터링을 위한 조건 정의
 * [불변 규칙] 모든 조건 타입은 이 파일에서 정의
 * [불변 규칙] 업종 중립적 설계 (동적 라벨은 UI에서 처리)
 */

/**
 * 필터 조건 타입 정의
 */
export type FilterConditionType =
  // 출석 기반
  | 'attendance.consecutive_late_3days'
  | 'attendance.absent_3times_in_week'
  | 'attendance.low_attendance_rate'
  | 'attendance.missing_checkin_today'
  | 'attendance.perfect_attendance'
  | 'attendance.frequent_late'
  | 'attendance.unexcused_absent'
  | 'attendance.no_visit'
  // 결제/청구 기반
  | 'billing.has_overdue_invoices'
  | 'billing.overdue_long_term'
  | 'billing.payment_due_soon'
  | 'billing.overdue_amount_threshold'
  | 'billing.no_payment_history'
  | 'billing.autopay_failed'
  | 'billing.paid_this_month'
  | 'billing.payment_failed_multiple'
  | 'billing.recent_payment'
  | 'billing.high_value_customer'
  // 등록/회원 상태
  | 'enrollment.new_student_30days'
  | 'enrollment.no_active_classes'
  | 'enrollment.on_leave'
  | 'enrollment.renewal_due_1year'
  | 'enrollment.multiple_classes'
  | 'enrollment.single_class_only'
  // 학적 정보
  | 'academic.grade_filter'
  | 'academic.birthday_this_month'
  | 'academic.age_range'
  | 'academic.school_filter'
  // 회원 상태
  | 'status.withdrawn'
  | 'status.gender_filter'
  | 'status.school_filter'
  // 수업 기반
  | 'class.specific_class'
  | 'class.specific_subject'
  | 'class.recently_enrolled'
  | 'class.about_to_leave'
  | 'class.no_active_class'
  // 복합 조건
  | 'combined.churn_risk_high'
  | 'combined.vip_students'
  | 'combined.needs_attention'
  | 'combined.inactive_30days';

/**
 * 필터 조건 카테고리
 */
export type FilterConditionCategory =
  | 'popular'
  | 'attendance'
  | 'billing'
  | 'enrollment'
  | 'academic'
  | 'combined'
  | 'class'
  | 'status';

/**
 * 파라미터 타입 정의
 */
export type FilterParamType = 'number' | 'string' | 'boolean' | 'date' | 'select' | 'multiselect' | 'uuid';

/**
 * 파라미터 옵션 정의
 */
export interface FilterParamOption {
  value: string;
  label: string;
}

/**
 * 파라미터 설정 정의
 */
export interface FilterParamConfig {
  type: FilterParamType;
  label: string;
  description?: string;
  default?: unknown;
  options?: FilterParamOption[];
  min?: number;
  max?: number;
  required?: boolean;
  placeholder?: string;
}

/**
 * 필터 조건 설정 정의
 */
export interface FilterConditionConfig {
  type: FilterConditionType;
  category: FilterConditionCategory;
  name: string;
  description: string;
  params: Record<string, FilterParamConfig>;
  sqlFunctionName: string;
  icon?: string;
  defaultColor: string;
}

/**
 * 카테고리 설정
 */
export interface FilterCategoryConfig {
  id: FilterConditionCategory;
  label: string;
  description: string;
  icon: string;
  sortOrder: number;
}

/**
 * 카테고리 목록 (SSOT)
 */
export const FILTER_CATEGORY_CONFIG: Record<FilterConditionCategory, FilterCategoryConfig> = {
  popular: {
    id: 'popular',
    label: '인기태그',
    description: '자주 사용되는 태그',
    icon: 'Star',
    sortOrder: 0,
  },
  attendance: {
    id: 'attendance',
    label: '출석',
    description: '출석 관련 필터',
    icon: 'CalendarCheck',
    sortOrder: 1,
  },
  billing: {
    id: 'billing',
    label: '결제/청구',
    description: '결제 및 청구 관련 필터',
    icon: 'CreditCard',
    sortOrder: 2,
  },
  enrollment: {
    id: 'enrollment',
    label: '등록',
    description: '등록 상태 관련 필터',
    icon: 'UserPlus',
    sortOrder: 3,
  },
  academic: {
    id: 'academic',
    label: '학적',
    description: '학적 정보 관련 필터',
    icon: 'GraduationCap',
    sortOrder: 4,
  },
  class: {
    id: 'class',
    label: '수업',
    description: '수업 관련 필터',
    icon: 'BookOpen',
    sortOrder: 5,
  },
  status: {
    id: 'status',
    label: '회원상태',
    description: '회원 상태 관련 필터',
    icon: 'Users',
    sortOrder: 6,
  },
  combined: {
    id: 'combined',
    label: '복합조건',
    description: '여러 조건을 조합한 필터',
    icon: 'Layers',
    sortOrder: 7,
  },
};

/**
 * 기간 선택 옵션
 */
export const PERIOD_OPTIONS: FilterParamOption[] = [
  { value: '7days', label: '최근 7일' },
  { value: '30days', label: '최근 30일' },
  { value: '90days', label: '최근 90일' },
];

/**
 * 학년 선택 옵션
 */
export const GRADE_OPTIONS: FilterParamOption[] = [
  { value: '초등1', label: '초등 1학년' },
  { value: '초등2', label: '초등 2학년' },
  { value: '초등3', label: '초등 3학년' },
  { value: '초등4', label: '초등 4학년' },
  { value: '초등5', label: '초등 5학년' },
  { value: '초등6', label: '초등 6학년' },
  { value: '중1', label: '중 1학년' },
  { value: '중2', label: '중 2학년' },
  { value: '중3', label: '중 3학년' },
  { value: '고1', label: '고 1학년' },
  { value: '고2', label: '고 2학년' },
  { value: '고3', label: '고 3학년' },
];

/**
 * 성별 선택 옵션
 */
export const GENDER_OPTIONS: FilterParamOption[] = [
  { value: 'male', label: '남성' },
  { value: 'female', label: '여성' },
];

/**
 * 필터 조건 카탈로그 (SSOT)
 */
export const FILTER_CONDITION_CATALOG: Partial<Record<FilterConditionType, FilterConditionConfig>> = {
  // ============================================================================
  // 출석 기반
  // ============================================================================
  'attendance.consecutive_late_3days': {
    type: 'attendance.consecutive_late_3days',
    category: 'attendance',
    name: '연속 지각',
    description: '연속으로 지각한 회원 필터링',
    params: {
      days: {
        type: 'number',
        label: '연속 일수',
        default: 3,
        min: 1,
        max: 10,
        required: true,
      },
      period: {
        type: 'select',
        label: '기간',
        default: '30days',
        options: PERIOD_OPTIONS,
      },
    },
    sqlFunctionName: 'filter_consecutive_late_students',
    defaultColor: '#FFC107',
  },
  'attendance.absent_3times_in_week': {
    type: 'attendance.absent_3times_in_week',
    category: 'attendance',
    name: '다회 결석',
    description: '기간 내 다회 결석한 회원 필터링',
    params: {
      count: {
        type: 'number',
        label: '결석 횟수',
        default: 3,
        min: 1,
        max: 10,
        required: true,
      },
      period: {
        type: 'select',
        label: '기간',
        default: '7days',
        options: PERIOD_OPTIONS,
      },
    },
    sqlFunctionName: 'filter_absent_students',
    defaultColor: '#FF6B6B',
  },
  'attendance.low_attendance_rate': {
    type: 'attendance.low_attendance_rate',
    category: 'attendance',
    name: '낮은 출석률',
    description: '출석률이 기준 미만인 회원 필터링',
    params: {
      rate: {
        type: 'number',
        label: '출석률 기준 (%)',
        default: 70,
        min: 0,
        max: 100,
        required: true,
      },
      period: {
        type: 'select',
        label: '기간',
        default: '30days',
        options: PERIOD_OPTIONS,
      },
    },
    sqlFunctionName: 'filter_low_attendance_rate_students',
    defaultColor: '#FF8787',
  },
  'attendance.perfect_attendance': {
    type: 'attendance.perfect_attendance',
    category: 'attendance',
    name: '개근',
    description: '기간 내 개근한 회원 필터링',
    params: {
      period: {
        type: 'select',
        label: '기간',
        default: '30days',
        options: PERIOD_OPTIONS,
      },
    },
    sqlFunctionName: 'filter_perfect_attendance_students',
    defaultColor: '#51CF66',
  },
  'attendance.frequent_late': {
    type: 'attendance.frequent_late',
    category: 'attendance',
    name: '잦은 지각',
    description: '지각이 잦은 회원 필터링',
    params: {
      count: {
        type: 'number',
        label: '지각 횟수',
        default: 3,
        min: 1,
        max: 10,
        required: true,
      },
      period: {
        type: 'select',
        label: '기간',
        default: '7days',
        options: PERIOD_OPTIONS,
      },
    },
    sqlFunctionName: 'filter_consecutive_late_students',
    defaultColor: '#FFD43B',
  },
  'attendance.no_visit': {
    type: 'attendance.no_visit',
    category: 'attendance',
    name: '미방문',
    description: '일정 기간 미방문한 회원 필터링',
    params: {
      days: {
        type: 'number',
        label: '미방문 일수',
        default: 30,
        min: 1,
        max: 365,
        required: true,
      },
    },
    sqlFunctionName: 'filter_no_visit_students',
    defaultColor: '#ADB5BD',
  },

  // ============================================================================
  // 결제/청구 기반
  // ============================================================================
  'billing.has_overdue_invoices': {
    type: 'billing.has_overdue_invoices',
    category: 'billing',
    name: '미납',
    description: '미납 금액이 있는 회원 필터링',
    params: {},
    sqlFunctionName: 'filter_overdue_students',
    defaultColor: '#F03E3E',
  },
  'billing.overdue_long_term': {
    type: 'billing.overdue_long_term',
    category: 'billing',
    name: '장기 미납',
    description: '장기간 미납 상태인 회원 필터링',
    params: {
      months: {
        type: 'number',
        label: '미납 개월 수',
        default: 2,
        min: 1,
        max: 12,
        required: true,
      },
    },
    sqlFunctionName: 'filter_overdue_long_term_students',
    defaultColor: '#C92A2A',
  },
  'billing.payment_due_soon': {
    type: 'billing.payment_due_soon',
    category: 'billing',
    name: '결제 예정',
    description: '결제 예정일이 임박한 회원 필터링',
    params: {
      days: {
        type: 'number',
        label: '결제 예정일까지 일수',
        default: 3,
        min: 1,
        max: 30,
        required: true,
      },
    },
    sqlFunctionName: 'filter_payment_due_soon_students',
    defaultColor: '#FAB005',
  },
  'billing.payment_failed_multiple': {
    type: 'billing.payment_failed_multiple',
    category: 'billing',
    name: '결제 실패',
    description: '결제가 여러 번 실패한 회원 필터링',
    params: {
      min_failures: {
        type: 'number',
        label: '최소 실패 횟수',
        default: 3,
        min: 1,
        max: 10,
        required: true,
      },
    },
    sqlFunctionName: 'filter_payment_failed_multiple_students',
    defaultColor: '#E03131',
  },

  // ============================================================================
  // 등록/회원 상태
  // ============================================================================
  'enrollment.new_student_30days': {
    type: 'enrollment.new_student_30days',
    category: 'enrollment',
    name: '신규 회원',
    description: '최근 가입한 신규 회원 필터링',
    params: {
      days: {
        type: 'number',
        label: '가입 일수',
        default: 30,
        min: 1,
        max: 365,
        required: true,
      },
    },
    sqlFunctionName: 'filter_new_students',
    defaultColor: '#4DABF7',
  },

  // ============================================================================
  // 학적 정보
  // ============================================================================
  'academic.grade_filter': {
    type: 'academic.grade_filter',
    category: 'academic',
    name: '특정 학년',
    description: '선택한 학년의 회원만 필터링',
    params: {
      grades: {
        type: 'multiselect',
        label: '학년 선택',
        options: GRADE_OPTIONS,
        required: true,
      },
    },
    sqlFunctionName: 'filter_students_by_grade',
    defaultColor: '#74C0FC',
  },
  'academic.birthday_this_month': {
    type: 'academic.birthday_this_month',
    category: 'academic',
    name: '이번 달 생일',
    description: '이번 달 생일인 회원 필터링',
    params: {},
    sqlFunctionName: 'filter_birthday_this_month_students',
    defaultColor: '#FF6B6B',
  },
  'academic.age_range': {
    type: 'academic.age_range',
    category: 'academic',
    name: '연령대',
    description: '특정 연령대의 회원 필터링',
    params: {
      min: {
        type: 'number',
        label: '최소 연령',
        default: 7,
        min: 0,
        max: 100,
        required: true,
      },
      max: {
        type: 'number',
        label: '최대 연령',
        default: 14,
        min: 0,
        max: 100,
        required: true,
      },
    },
    sqlFunctionName: 'filter_students_by_age_range',
    defaultColor: '#FFD43B',
  },

  // ============================================================================
  // 회원 상태
  // ============================================================================
  'status.withdrawn': {
    type: 'status.withdrawn',
    category: 'status',
    name: '퇴원 회원',
    description: '퇴원한 회원 필터링',
    params: {},
    sqlFunctionName: 'filter_withdrawn_students',
    defaultColor: '#868E96',
  },
  'status.gender_filter': {
    type: 'status.gender_filter',
    category: 'status',
    name: '성별',
    description: '특정 성별의 회원 필터링',
    params: {
      gender: {
        type: 'select',
        label: '성별',
        options: GENDER_OPTIONS,
        required: true,
      },
    },
    sqlFunctionName: 'filter_students_by_gender',
    defaultColor: '#339AF0',
  },
  'status.school_filter': {
    type: 'status.school_filter',
    category: 'status',
    name: '특정 학교',
    description: '특정 학교 재학생 필터링',
    params: {
      school_name: {
        type: 'string',
        label: '학교명',
        placeholder: '학교명 입력',
        required: true,
      },
    },
    sqlFunctionName: 'filter_students_by_school',
    defaultColor: '#20C997',
  },

  // ============================================================================
  // 수업 기반
  // ============================================================================
  'class.specific_class': {
    type: 'class.specific_class',
    category: 'class',
    name: '특정 수업',
    description: '특정 수업 수강생 필터링',
    params: {
      class_id: {
        type: 'uuid',
        label: '수업 선택',
        required: true,
      },
    },
    sqlFunctionName: 'filter_students_by_class',
    defaultColor: '#7950F2',
  },
  'class.specific_subject': {
    type: 'class.specific_subject',
    category: 'class',
    name: '특정 과목',
    description: '특정 과목 수강생 필터링',
    params: {
      subject: {
        type: 'string',
        label: '과목명',
        placeholder: '과목명 입력',
        required: true,
      },
    },
    sqlFunctionName: 'filter_students_by_subject',
    defaultColor: '#9775FA',
  },
  'class.no_active_class': {
    type: 'class.no_active_class',
    category: 'class',
    name: '활성 수업 없음',
    description: '현재 수강 중인 수업이 없는 회원 필터링',
    params: {},
    sqlFunctionName: 'filter_students_no_active_class',
    defaultColor: '#DEE2E6',
  },
  'class.recently_enrolled': {
    type: 'class.recently_enrolled',
    category: 'class',
    name: '최근 등록',
    description: '최근 수업에 등록한 회원 필터링',
    params: {
      days: {
        type: 'number',
        label: '등록 일수',
        default: 7,
        min: 1,
        max: 90,
        required: true,
      },
    },
    sqlFunctionName: 'filter_recently_enrolled_students',
    defaultColor: '#66D9E8',
  },
};

/**
 * 조건 타입으로 설정 조회
 */
export function getConditionConfig(conditionType: FilterConditionType): FilterConditionConfig | undefined {
  return FILTER_CONDITION_CATALOG[conditionType];
}

/**
 * 카테고리별 조건 목록 조회
 */
export function getConditionsByCategory(category: FilterConditionCategory): FilterConditionConfig[] {
  return Object.values(FILTER_CONDITION_CATALOG)
    .filter((config): config is FilterConditionConfig => config !== undefined && config.category === category);
}

/**
 * 모든 카테고리 목록 조회 (정렬됨)
 */
export function getSortedCategories(): FilterCategoryConfig[] {
  return Object.values(FILTER_CATEGORY_CONFIG).sort((a, b) => a.sortOrder - b.sortOrder);
}
