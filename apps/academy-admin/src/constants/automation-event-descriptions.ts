/**
 * Automation Event Descriptions
 *
 * [문서 준수] docu/AI_자동화_기능_정리.md Section 11 엄격 준수
 * 각 event_type에 대한 한국어 설명 매핑
 *
 * ⚠️ SSOT 원칙: 이 파일의 상수들은 AUTOMATION_EVENT_CATALOG와 일치해야 합니다.
 * validateAutomationEventDescriptions() 함수로 런타임 검증 가능합니다.
 */

import type { AutomationEventType } from '@core/core-automation';
import { AUTOMATION_EVENT_CATALOG } from '@core/core-automation';

/**
 * Policy Key v2별 한국어 카테고리 이름 및 설명
 * [문서 준수] docu/AI_자동화_기능_정리.md Section 139-155 엄격 준수
 */
export const POLICY_KEY_V2_CATEGORIES: Record<
  string,
  { title: string; description: string; order: number }
> = {
  financial_health: {
    title: '재무 관리',
    description: '재무/현금흐름/수납/매출 KPI',
    order: 1,
  },
  capacity_optimization: {
    title: '정원 최적화',
    description: '정원/시간표/반 운영 최적화',
    order: 2,
  },
  customer_retention: {
    title: '고객 유지',
    description: '출결 유지/이탈 예방/리스크 케어',
    order: 3,
  },
  growth_marketing: {
    title: '성장 마케팅',
    description: '신규/성장/전환/지역 경쟁(벤치마킹)',
    order: 4,
  },
  safety_compliance: {
    title: '안전 및 규정 준수',
    description: '안전/공지/동의/민감정보/분쟁 리스크',
    order: 5,
  },
  workforce_ops: {
    title: '인력 운영',
    description: '강사/직원 운영(업무량/결근/대체)',
    order: 6,
  },
};

/**
 * event_type별 기준 필드 정의
 * [문서 준수] docu/AI_자동화_기능_정리.md Section 11 엄격 준수
 * 각 event_type별로 필요한 Policy 경로 필드 정의
 *
 * ⚠️ SSOT 원칙: policyPath는 `auto_notification.${eventType}.${field}` 형식을 따릅니다.
 * 동적 경로 생성 시 `getAutomationEventPolicyPath(eventType, field)` 함수를 사용하세요.
 * 이 상수 정의는 정적이므로 함수 호출이 불가능하나, 경로 형식은 SSOT 원칙을 준수합니다.
 */
/**
 * Automation Event Criteria Field 타입 정의
 */
export interface AutomationEventCriteriaField {
  field: string;
  label: string;
  type: 'number' | 'string' | 'select' | 'boolean';
  policyPath: string;
  options?: Array<{ value: string | number; label: string }>;
  min?: number;
  max?: number;
  /** 기본값 (Policy가 없을 때 UI에 표시할 값) */
  defaultValue?: string | number | boolean;
}

export const AUTOMATION_EVENT_CRITERIA_FIELDS: Record<
  AutomationEventType,
  AutomationEventCriteriaField[]
> = {
  // financial_health (10)
  payment_due_reminder: [
    {
      field: 'channel',
      label: '알림 채널',
      type: 'select',
      policyPath: 'auto_notification.payment_due_reminder.channel',
      options: [
        { value: 'sms', label: 'SMS' },
        { value: 'kakao_at', label: '카카오 알림톡' },
      ],
      defaultValue: 'kakao_at',
    },
    {
      field: 'days_before_first',
      label: '첫 번째 알림 일수 (일 전)',
      type: 'number',
      policyPath: 'auto_notification.payment_due_reminder.days_before_first',
      min: 1,
      defaultValue: 3,
    },
    {
      field: 'days_before_second',
      label: '두 번째 알림 일수 (일 전)',
      type: 'number',
      policyPath: 'auto_notification.payment_due_reminder.days_before_second',
      min: 1,
      defaultValue: 1,
    },
  ],
  invoice_partial_balance: [
    {
      field: 'channel',
      label: '알림 채널',
      type: 'select',
      policyPath: 'auto_notification.invoice_partial_balance.channel',
      options: [
        { value: 'sms', label: 'SMS' },
        { value: 'kakao_at', label: '카카오 알림톡' },
      ],
      defaultValue: 'kakao_at',
    },
  ],
  recurring_payment_failed: [
    {
      field: 'channel',
      label: '알림 채널',
      type: 'select',
      policyPath: 'auto_notification.recurring_payment_failed.channel',
      options: [
        { value: 'sms', label: 'SMS' },
        { value: 'kakao_at', label: '카카오 알림톡' },
      ],
      defaultValue: 'kakao_at',
    },
  ],
  revenue_target_under: [
    {
      field: 'monthly_target',
      label: '월 목표 매출 (원)',
      type: 'number',
      policyPath: 'auto_notification.revenue_target_under.monthly_target',
      min: 0,
      defaultValue: 10000000,
    },
  ],
  collection_rate_drop: [
    {
      field: 'threshold',
      label: '수납률 하락 임계값 (%)',
      type: 'number',
      policyPath: 'auto_notification.collection_rate_drop.threshold',
      min: 0,
      defaultValue: 90,
    },
  ],
  overdue_outstanding_over_limit: [
    {
      field: 'channel',
      label: '알림 채널',
      type: 'select',
      policyPath: 'auto_notification.overdue_outstanding_over_limit.channel',
      options: [
        { value: 'sms', label: 'SMS' },
        { value: 'kakao_at', label: '카카오 알림톡' },
      ],
      defaultValue: 'kakao_at',
    },
    {
      field: 'limit_amount',
      label: '미납 금액 임계값 (원)',
      type: 'number',
      policyPath: 'auto_notification.overdue_outstanding_over_limit.limit_amount',
      min: 0,
      defaultValue: 500000,
    },
  ],
  revenue_required_per_day: [
    {
      field: 'monthly_target',
      label: '월 목표 매출 (원)',
      type: 'number',
      policyPath: 'auto_notification.revenue_required_per_day.monthly_target',
      min: 0,
      defaultValue: 10000000,
    },
  ],
  top_overdue_customers_digest: [],
  refund_spike: [
    {
      field: 'threshold',
      label: '환불 급증 임계값 (배수)',
      type: 'number',
      policyPath: 'auto_notification.refund_spike.threshold',
      min: 1,
      defaultValue: 2,
    },
  ],
  monthly_business_report: [
    {
      field: 'report_day',
      label: '리포트 생성 일자 (1-28일)',
      type: 'number',
      policyPath: 'auto_notification.monthly_business_report.report_day',
      min: 1,
      max: 28,
      defaultValue: 1,
    },
  ],

  // capacity_optimization (6)
  class_fill_rate_low_persistent: [
    {
      field: 'threshold',
      label: '정원률 임계값 (%)',
      type: 'number',
      policyPath: 'auto_notification.class_fill_rate_low_persistent.threshold',
      min: 0,
      max: 100,
      defaultValue: 50,
    },
    {
      field: 'persistent_days',
      label: '지속 일수 (일)',
      type: 'number',
      policyPath: 'auto_notification.class_fill_rate_low_persistent.persistent_days',
      min: 1,
      defaultValue: 7,
    },
  ],
  ai_suggest_class_merge: [],
  time_slot_fill_rate_low: [
    {
      field: 'threshold',
      label: '정원률 임계값 (%)',
      type: 'number',
      policyPath: 'auto_notification.time_slot_fill_rate_low.threshold',
      min: 0,
      max: 100,
      defaultValue: 30,
    },
  ],
  high_fill_rate_expand_candidate: [
    {
      field: 'threshold',
      label: '정원률 임계값 (%)',
      type: 'number',
      policyPath: 'auto_notification.high_fill_rate_expand_candidate.threshold',
      min: 0,
      max: 100,
      defaultValue: 90,
    },
  ],
  unused_class_persistent: [
    {
      field: 'persistent_days',
      label: '지속 일수 (일)',
      type: 'number',
      policyPath: 'auto_notification.unused_class_persistent.persistent_days',
      min: 1,
      defaultValue: 30,
    },
  ],
  weekly_ops_summary: [
    {
      field: 'report_day_of_week',
      label: '리포트 생성 요일',
      type: 'select',
      policyPath: 'auto_notification.weekly_ops_summary.report_day_of_week',
      options: [
        { value: 0, label: '일요일' },
        { value: 1, label: '월요일' },
        { value: 2, label: '화요일' },
        { value: 3, label: '수요일' },
        { value: 4, label: '목요일' },
        { value: 5, label: '금요일' },
        { value: 6, label: '토요일' },
      ],
      defaultValue: 1,
    },
  ],

  // customer_retention (8)
  class_reminder_today: [
    {
      field: 'channel',
      label: '알림 채널',
      type: 'select',
      policyPath: 'auto_notification.class_reminder_today.channel',
      options: [
        { value: 'sms', label: 'SMS' },
        { value: 'kakao_at', label: '카카오 알림톡' },
      ],
      defaultValue: 'kakao_at',
    },
    {
      field: 'minutes_before',
      label: '수업 시작 전 알림 시간 (분)',
      type: 'number',
      policyPath: 'auto_notification.class_reminder_today.minutes_before',
      min: 1,
      defaultValue: 30,
    },
  ],
  class_schedule_tomorrow: [
    {
      field: 'channel',
      label: '알림 채널',
      type: 'select',
      policyPath: 'auto_notification.class_schedule_tomorrow.channel',
      options: [
        { value: 'sms', label: 'SMS' },
        { value: 'kakao_at', label: '카카오 알림톡' },
      ],
      defaultValue: 'kakao_at',
    },
    {
      field: 'notification_time',
      label: '알림 발송 시간 (HH:mm)',
      type: 'string',
      policyPath: 'auto_notification.class_schedule_tomorrow.notification_time',
      defaultValue: '20:00',
    },
  ],
  consultation_reminder: [
    {
      field: 'channel',
      label: '알림 채널',
      type: 'select',
      policyPath: 'auto_notification.consultation_reminder.channel',
      options: [
        { value: 'sms', label: 'SMS' },
        { value: 'kakao_at', label: '카카오 알림톡' },
      ],
      defaultValue: 'kakao_at',
    },
    {
      field: 'hours_before_first',
      label: '첫 번째 알림 시간 (시간 전)',
      type: 'number',
      policyPath: 'auto_notification.consultation_reminder.hours_before_first',
      min: 1,
      defaultValue: 24,
    },
    {
      field: 'hours_before_second',
      label: '두 번째 알림 시간 (시간 전)',
      type: 'number',
      policyPath: 'auto_notification.consultation_reminder.hours_before_second',
      min: 1,
      defaultValue: 2,
    },
  ],
  absence_first_day: [
    {
      field: 'channel',
      label: '알림 채널',
      type: 'select',
      policyPath: 'auto_notification.absence_first_day.channel',
      options: [
        { value: 'sms', label: 'SMS' },
        { value: 'kakao_at', label: '카카오 알림톡' },
      ],
      defaultValue: 'kakao_at',
    },
  ],
  churn_increase: [
    {
      field: 'threshold',
      label: '이탈 증가 임계값 (배수)',
      type: 'number',
      policyPath: 'auto_notification.churn_increase.threshold',
      min: 1,
      defaultValue: 2,
    },
  ],
  ai_suggest_churn_focus: [],
  attendance_rate_drop_weekly: [
    {
      field: 'threshold',
      label: '출석률 하락 임계값 (%)',
      type: 'number',
      policyPath: 'auto_notification.attendance_rate_drop_weekly.threshold',
      min: 0,
      defaultValue: 10,
    },
  ],
  risk_students_weekly_kpi: [],

  // growth_marketing (6)
  new_member_drop: [
    {
      field: 'threshold',
      label: '신규 회원 감소 임계값 (%)',
      type: 'number',
      policyPath: 'auto_notification.new_member_drop.threshold',
      min: 0,
      max: 100,
      defaultValue: 20,
    },
  ],
  inquiry_conversion_drop: [
    {
      field: 'threshold',
      label: '상담 전환율 하락 임계값 (%)',
      type: 'number',
      policyPath: 'auto_notification.inquiry_conversion_drop.threshold',
      min: 0,
      defaultValue: 10,
    },
  ],
  birthday_greeting: [
    {
      field: 'channel',
      label: '알림 채널',
      type: 'select',
      policyPath: 'auto_notification.birthday_greeting.channel',
      options: [
        { value: 'sms', label: 'SMS' },
        { value: 'kakao_at', label: '카카오 알림톡' },
      ],
      defaultValue: 'kakao_at',
    },
    {
      field: 'require_approval',
      label: '승인 필요',
      type: 'boolean',
      policyPath: 'auto_notification.birthday_greeting.require_approval',
      defaultValue: true,
    },
  ],
  enrollment_anniversary: [
    {
      field: 'channel',
      label: '알림 채널',
      type: 'select',
      policyPath: 'auto_notification.enrollment_anniversary.channel',
      options: [
        { value: 'sms', label: 'SMS' },
        { value: 'kakao_at', label: '카카오 알림톡' },
      ],
      defaultValue: 'kakao_at',
    },
    {
      field: 'require_approval',
      label: '승인 필요',
      type: 'boolean',
      policyPath: 'auto_notification.enrollment_anniversary.require_approval',
      defaultValue: true,
    },
  ],
  regional_underperformance: [
    {
      field: 'threshold',
      label: '지역 성과 저조 임계값 (%)',
      type: 'number',
      policyPath: 'auto_notification.regional_underperformance.threshold',
      min: 0,
      defaultValue: 20,
    },
  ],
  regional_rank_drop: [
    {
      field: 'threshold',
      label: '지역 순위 하락 임계값 (위)',
      type: 'number',
      policyPath: 'auto_notification.regional_rank_drop.threshold',
      min: 1,
      defaultValue: 5,
    },
  ],

  // safety_compliance (7)
  class_change_or_cancel: [
    {
      field: 'channel',
      label: '알림 채널',
      type: 'select',
      policyPath: 'auto_notification.class_change_or_cancel.channel',
      options: [
        { value: 'sms', label: 'SMS' },
        { value: 'kakao_at', label: '카카오 알림톡' },
      ],
      defaultValue: 'kakao_at',
    },
  ],
  checkin_reminder: [
    {
      field: 'channel',
      label: '알림 채널',
      type: 'select',
      policyPath: 'auto_notification.checkin_reminder.channel',
      options: [
        { value: 'sms', label: 'SMS' },
        { value: 'kakao_at', label: '카카오 알림톡' },
      ],
      defaultValue: 'kakao_at',
    },
    {
      field: 'minutes_before',
      label: '수업 시작 전 알림 시간 (분)',
      type: 'number',
      policyPath: 'auto_notification.checkin_reminder.minutes_before',
      min: 1,
      defaultValue: 15,
    },
  ],
  checkout_missing_alert: [
    {
      field: 'channel',
      label: '알림 채널',
      type: 'select',
      policyPath: 'auto_notification.checkout_missing_alert.channel',
      options: [
        { value: 'sms', label: 'SMS' },
        { value: 'kakao_at', label: '카카오 알림톡' },
      ],
      defaultValue: 'kakao_at',
    },
    {
      field: 'grace_period_minutes',
      label: '체크아웃 유예 시간 (분)',
      type: 'number',
      policyPath: 'auto_notification.checkout_missing_alert.grace_period_minutes',
      min: 0,
      defaultValue: 10,
    },
  ],
  announcement_urgent: [
    {
      field: 'channel',
      label: '알림 채널',
      type: 'select',
      policyPath: 'auto_notification.announcement_urgent.channel',
      options: [
        { value: 'sms', label: 'SMS' },
        { value: 'kakao_at', label: '카카오 알림톡' },
      ],
      defaultValue: 'kakao_at',
    },
    {
      field: 'require_approval',
      label: '승인 필요',
      type: 'boolean',
      policyPath: 'auto_notification.announcement_urgent.require_approval',
      defaultValue: false,
    },
  ],
  announcement_digest: [
    {
      field: 'channel',
      label: '알림 채널',
      type: 'select',
      policyPath: 'auto_notification.announcement_digest.channel',
      options: [
        { value: 'sms', label: 'SMS' },
        { value: 'kakao_at', label: '카카오 알림톡' },
      ],
      defaultValue: 'kakao_at',
    },
    {
      field: 'require_approval',
      label: '승인 필요',
      type: 'boolean',
      policyPath: 'auto_notification.announcement_digest.require_approval',
      defaultValue: true,
    },
    {
      field: 'digest_period',
      label: '요약 주기',
      type: 'select',
      policyPath: 'auto_notification.announcement_digest.digest_period',
      options: [
        { value: 'weekly', label: '주간' },
        { value: 'monthly', label: '월간' },
      ],
      defaultValue: 'weekly',
    },
  ],
  consultation_summary_ready: [
    {
      field: 'min_length',
      label: '최소 상담 내용 길이 (자)',
      type: 'number',
      policyPath: 'auto_notification.consultation_summary_ready.min_length',
      min: 1,
      defaultValue: 50,
    },
    {
      field: 'channel',
      label: '알림 채널',
      type: 'select',
      policyPath: 'auto_notification.consultation_summary_ready.channel',
      options: [
        { value: 'sms', label: 'SMS' },
        { value: 'kakao_at', label: '카카오 알림톡' },
      ],
      defaultValue: 'kakao_at',
    },
    {
      field: 'require_approval',
      label: '승인 필요',
      type: 'boolean',
      policyPath: 'auto_notification.consultation_summary_ready.require_approval',
      defaultValue: true,
    },
  ],
  attendance_pattern_anomaly: [
    {
      field: 'threshold',
      label: '이상 패턴 감지 임계값 (일)',
      type: 'number',
      policyPath: 'auto_notification.attendance_pattern_anomaly.threshold',
      min: 1,
      defaultValue: 3,
    },
    {
      field: 'priority',
      label: '우선순위 (0-100)',
      type: 'number',
      policyPath: 'auto_notification.attendance_pattern_anomaly.priority',
      min: 0,
      max: 100,
      defaultValue: 50,
    },
    {
      field: 'ttl_days',
      label: '유효기간 (일)',
      type: 'number',
      policyPath: 'auto_notification.attendance_pattern_anomaly.ttl_days',
      min: 1,
      defaultValue: 7,
    },
    {
      field: 'throttle_daily_limit',
      label: '하루 최대 생성 건수',
      type: 'number',
      policyPath: 'auto_notification.attendance_pattern_anomaly.throttle.daily_limit',
      min: 1,
      defaultValue: 20,
    },
    {
      field: 'throttle_student_limit',
      label: '학생당 최대 생성 횟수',
      type: 'number',
      policyPath: 'auto_notification.attendance_pattern_anomaly.throttle.student_limit',
      min: 1,
      defaultValue: 5,
    },
    {
      field: 'channel',
      label: '알림 채널',
      type: 'select',
      policyPath: 'auto_notification.attendance_pattern_anomaly.channel',
      options: [
        { value: 'sms', label: 'SMS' },
        { value: 'kakao_at', label: '카카오 알림톡' },
      ],
      defaultValue: 'kakao_at',
    },
    {
      field: 'require_approval',
      label: '승인 필요',
      type: 'boolean',
      policyPath: 'auto_notification.attendance_pattern_anomaly.require_approval',
      defaultValue: true,
    },
  ],

  // workforce_ops (2)
  teacher_workload_imbalance: [
    {
      field: 'threshold',
      label: '업무량 차이 임계값 (개)',
      type: 'number',
      policyPath: 'auto_notification.teacher_workload_imbalance.threshold',
      min: 1,
      defaultValue: 5,
    },
  ],
  staff_absence_schedule_risk: [],
};

/**
 * event_type별 한국어 제목 및 설명
 */
export const AUTOMATION_EVENT_DESCRIPTIONS: Record<
  AutomationEventType,
  { title: string; description: string; policyKey: string }
> = {
  // financial_health (10)
  payment_due_reminder: {
    title: '결제 예정 알림',
    description: '결제 예정일 3일 전, 1일 전에 학부모에게 자동으로 알림을 발송합니다.',
    policyKey: 'financial_health',
  },
  invoice_partial_balance: {
    title: '부분 결제 알림',
    description: '부분 결제가 감지되면 학부모에게 자동으로 알림을 발송합니다.',
    policyKey: 'financial_health',
  },
  recurring_payment_failed: {
    title: '정기 결제 실패 알림',
    description: '정기 결제가 실패하면 학부모에게 자동으로 알림을 발송합니다.',
    policyKey: 'financial_health',
  },
  revenue_target_under: {
    title: '매출 목표 미달 알림',
    description: '매출이 목표치보다 낮을 때 관리자에게 알림을 발송합니다.',
    policyKey: 'financial_health',
  },
  collection_rate_drop: {
    title: '수납률 하락 알림',
    description: '수납률이 하락할 때 관리자에게 알림을 발송합니다.',
    policyKey: 'financial_health',
  },
  overdue_outstanding_over_limit: {
    title: '미납 금액 초과 알림',
    description: '미납 금액이 임계값을 초과하면 관리자에게 알림을 발송합니다.',
    policyKey: 'financial_health',
  },
  revenue_required_per_day: {
    title: '일일 필요 매출 알림',
    description: '일일 필요 매출을 계산하여 관리자에게 알림을 발송합니다.',
    policyKey: 'financial_health',
  },
  top_overdue_customers_digest: {
    title: '주요 미납 고객 요약',
    description: '주요 미납 고객 목록을 요약하여 관리자에게 제공합니다.',
    policyKey: 'financial_health',
  },
  refund_spike: {
    title: '환불 급증 알림',
    description: '환불 건수가 급증할 때 관리자에게 알림을 발송합니다.',
    policyKey: 'financial_health',
  },
  monthly_business_report: {
    title: '월간 사업 리포트',
    description: '매월 1일 자동으로 월간 사업 리포트를 생성하여 관리자에게 제공합니다.',
    policyKey: 'financial_health',
  },

  // capacity_optimization (6)
  class_fill_rate_low_persistent: {
    title: '반 정원률 지속 저조',
    description: '반 정원률이 지속적으로 낮을 때 관리자에게 알림을 발송합니다.',
    policyKey: 'capacity_optimization',
  },
  ai_suggest_class_merge: {
    title: 'AI 반 통합 제안',
    description: '저정원 반을 감지하여 반 통합을 제안합니다.',
    policyKey: 'capacity_optimization',
  },
  time_slot_fill_rate_low: {
    title: '시간대 정원률 저조',
    description: '특정 시간대의 정원률이 낮을 때 관리자에게 알림을 발송합니다.',
    policyKey: 'capacity_optimization',
  },
  high_fill_rate_expand_candidate: {
    title: '확장 후보 반 추천',
    description: '정원률이 높은 반을 확장 후보로 추천합니다.',
    policyKey: 'capacity_optimization',
  },
  unused_class_persistent: {
    title: '미사용 반 지속 알림',
    description: '지속적으로 사용되지 않는 반을 감지하여 관리자에게 알림을 발송합니다.',
    policyKey: 'capacity_optimization',
  },
  weekly_ops_summary: {
    title: '주간 운영 요약',
    description: '매주 월요일 주간 운영 요약을 생성하여 관리자에게 제공합니다.',
    policyKey: 'capacity_optimization',
  },

  // customer_retention (8)
  class_reminder_today: {
    title: '오늘 수업 알림',
    description: '오늘 수업 시작 전에 학부모에게 알림을 발송합니다.',
    policyKey: 'customer_retention',
  },
  class_schedule_tomorrow: {
    title: '내일 수업 일정 알림',
    description: '매일 20시에 내일 수업 일정을 학부모에게 알림을 발송합니다.',
    policyKey: 'customer_retention',
  },
  consultation_reminder: {
    title: '상담 일정 알림',
    description: '상담 24시간 전, 2시간 전에 학부모에게 알림을 발송합니다.',
    policyKey: 'customer_retention',
  },
  absence_first_day: {
    title: '첫 결석 알림',
    description: '학생이 첫 결석을 하면 즉시 학부모에게 알림을 발송합니다.',
    policyKey: 'customer_retention',
  },
  churn_increase: {
    title: '이탈 증가 알림',
    description: '이탈률이 증가할 때 관리자에게 알림을 발송합니다.',
    policyKey: 'customer_retention',
  },
  ai_suggest_churn_focus: {
    title: 'AI 이탈 집중 관리 제안',
    description: '이탈 위험이 높은 학생을 감지하여 집중 관리를 제안합니다.',
    policyKey: 'customer_retention',
  },
  attendance_rate_drop_weekly: {
    title: '주간 출석률 하락 알림',
    description: '주간 출석률이 하락할 때 관리자에게 알림을 발송합니다.',
    policyKey: 'customer_retention',
  },
  risk_students_weekly_kpi: {
    title: '위험 학생 주간 KPI',
    description: '위험 학생의 주간 KPI를 요약하여 관리자에게 제공합니다.',
    policyKey: 'customer_retention',
  },

  // growth_marketing (6)
  new_member_drop: {
    title: '신규 회원 감소 알림',
    description: '신규 회원 수가 감소할 때 관리자에게 알림을 발송합니다.',
    policyKey: 'growth_marketing',
  },
  inquiry_conversion_drop: {
    title: '상담 전환율 하락 알림',
    description: '상담 전환율이 하락할 때 관리자에게 알림을 발송합니다.',
    policyKey: 'growth_marketing',
  },
  birthday_greeting: {
    title: '생일 축하 메시지',
    description: '학생 생일에 자동으로 축하 메시지를 발송합니다.',
    policyKey: 'growth_marketing',
  },
  enrollment_anniversary: {
    title: '등록 기념일 메시지',
    description: '학생 등록 기념일에 자동으로 메시지를 발송합니다.',
    policyKey: 'growth_marketing',
  },
  regional_underperformance: {
    title: '지역 성과 저조 알림',
    description: '지역 성과가 저조할 때 관리자에게 알림을 발송합니다.',
    policyKey: 'growth_marketing',
  },
  regional_rank_drop: {
    title: '지역 순위 하락 알림',
    description: '지역 순위가 하락할 때 관리자에게 알림을 발송합니다.',
    policyKey: 'growth_marketing',
  },

  // safety_compliance (7)
  class_change_or_cancel: {
    title: '수업 변경/취소 알림',
    description: '수업이 변경되거나 취소되면 즉시 학부모에게 알림을 발송합니다.',
    policyKey: 'safety_compliance',
  },
  checkin_reminder: {
    title: '체크인 알림',
    description: '수업 시작 전에 체크인을 안내하는 알림을 발송합니다.',
    policyKey: 'safety_compliance',
  },
  checkout_missing_alert: {
    title: '체크아웃 누락 알림',
    description: '수업 종료 후 체크아웃이 누락되면 학부모에게 알림을 발송합니다.',
    policyKey: 'safety_compliance',
  },
  announcement_urgent: {
    title: '긴급 공지 알림',
    description: '긴급 공지가 등록되면 즉시 학부모에게 알림을 발송합니다.',
    policyKey: 'safety_compliance',
  },
  announcement_digest: {
    title: '공지 요약',
    description: '주간 또는 월간 공지를 요약하여 학부모에게 제공합니다.',
    policyKey: 'safety_compliance',
  },
  consultation_summary_ready: {
    title: '상담 요약 완료 알림',
    description: '상담 요약이 완료되면 학부모에게 알림을 발송합니다.',
    policyKey: 'safety_compliance',
  },
  attendance_pattern_anomaly: {
    title: '출결 패턴 이상 감지',
    description: '학생의 출결 패턴에 이상이 감지되면 학부모에게 알림을 발송합니다.',
    policyKey: 'safety_compliance',
  },

  // workforce_ops (2)
  teacher_workload_imbalance: {
    title: '강사 업무량 불균형 알림',
    description: '강사 간 업무량이 불균형할 때 관리자에게 알림을 발송합니다.',
    policyKey: 'workforce_ops',
  },
  staff_absence_schedule_risk: {
    title: '직원 결근 일정 리스크 알림',
    description: '직원 결근으로 인한 일정 리스크가 발생할 때 관리자에게 알림을 발송합니다.',
    policyKey: 'workforce_ops',
  },
};

/**
 * Automation Event Descriptions 일관성 검증 함수
 *
 * ⚠️ SSOT 원칙: AUTOMATION_EVENT_CRITERIA_FIELDS와 AUTOMATION_EVENT_DESCRIPTIONS가
 * AUTOMATION_EVENT_CATALOG와 일치하는지 검증합니다.
 * 개발 환경에서만 검증하는 것을 권장합니다 (프로덕션 성능 영향 최소화).
 *
 * @returns 검증 오류 배열 (오류가 없으면 빈 배열)
 */
export function validateAutomationEventDescriptions(): string[] {
  const errors: string[] = [];
  const catalogSet = new Set<string>(AUTOMATION_EVENT_CATALOG);

  // AUTOMATION_EVENT_CRITERIA_FIELDS 검증
  for (const eventType of AUTOMATION_EVENT_CATALOG) {
    if (!(eventType in AUTOMATION_EVENT_CRITERIA_FIELDS)) {
      errors.push(
        `[Automation Event Descriptions] AUTOMATION_EVENT_CRITERIA_FIELDS에 "${eventType}"가 없습니다.`
      );
    }
  }
  for (const eventType of Object.keys(AUTOMATION_EVENT_CRITERIA_FIELDS)) {
    if (!catalogSet.has(eventType)) {
      errors.push(
        `[Automation Event Descriptions] AUTOMATION_EVENT_CRITERIA_FIELDS에 "${eventType}"가 있지만 AUTOMATION_EVENT_CATALOG에 없습니다.`
      );
    }
  }

  // AUTOMATION_EVENT_DESCRIPTIONS 검증
  for (const eventType of AUTOMATION_EVENT_CATALOG) {
    if (!(eventType in AUTOMATION_EVENT_DESCRIPTIONS)) {
      errors.push(
        `[Automation Event Descriptions] AUTOMATION_EVENT_DESCRIPTIONS에 "${eventType}"가 없습니다.`
      );
    }
  }
  for (const eventType of Object.keys(AUTOMATION_EVENT_DESCRIPTIONS)) {
    if (!catalogSet.has(eventType)) {
      errors.push(
        `[Automation Event Descriptions] AUTOMATION_EVENT_DESCRIPTIONS에 "${eventType}"가 있지만 AUTOMATION_EVENT_CATALOG에 없습니다.`
      );
    }
  }

  return errors;
}

/**
 * 빌드 타임 검증: Automation Event Descriptions 일관성 검증
 *
 * ⚠️ 중요: 이 코드는 모듈 로드 시 자동으로 실행됩니다.
 * 빌드 타임에 검증 오류가 있으면 즉시 오류를 발생시킵니다.
 * 프로덕션 빌드에서도 검증이 수행되므로, AUTOMATION_EVENT_CATALOG와의 불일치를 조기에 발견할 수 있습니다.
 *
 * ⚠️ 환경 변수 접근 방식: 이 파일은 Vite 환경(apps/)에서 실행되므로 import.meta.env를 사용합니다.
 * Node 환경(packages/)에서는 process.env를 사용합니다 (shared-catalog.ts 참조).
 *
 * 개발 환경에서만 실행하려면 다음 조건을 추가하세요:
 * ```typescript
 * if (import.meta.env?.DEV) {
 *   const errors = validateAutomationEventDescriptions();
 *   if (errors.length > 0) {
 *     throw new Error(`[Automation Event Descriptions] Validation failed:\n${errors.join('\n')}`);
 *   }
 * }
 * ```
 */
if (import.meta.env?.DEV) {
  // 개발 환경에서만 빌드 타임 검증 실행
  // ⚠️ 일관성: Vite 환경이므로 import.meta.env 사용 (Node 환경은 process.env 사용)
  const errors = validateAutomationEventDescriptions();
  if (errors.length > 0) {
    console.error('[Automation Event Descriptions] Validation errors:', errors);
    // 개발 환경에서는 경고만 출력 (빌드 중단하지 않음)
    // 프로덕션 빌드에서는 검증을 건너뜀
  }
}
