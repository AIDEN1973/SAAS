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
    title: '재무관리',
    description: '재무/현금흐름/수납/매출 KPI',
    order: 1,
  },
  capacity_optimization: {
    title: '정원 최적화',
    description: '정원/시간표/수업 운영 최적화',
    order: 2,
  },
  customer_retention: {
    title: '고객유지',
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
    title: '인력운영',
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
      label: '수납률 경고 기준 (%)',
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
      label: '미납 경고 금액 (원)',
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
  top_overdue_customers_digest: [
    {
      field: 'min_amount',
      label: '최소 미납액 (원)',
      type: 'number',
      policyPath: 'auto_notification.top_overdue_customers_digest.min_amount',
      min: 0,
      defaultValue: 100000,
    },
    {
      field: 'top_count',
      label: '상위 고객 수',
      type: 'number',
      policyPath: 'auto_notification.top_overdue_customers_digest.top_count',
      min: 1,
      max: 50,
      defaultValue: 10,
    },
    {
      field: 'channel',
      label: '알림 채널',
      type: 'select',
      policyPath: 'auto_notification.top_overdue_customers_digest.channel',
      options: [
        { value: 'sms', label: 'SMS' },
        { value: 'kakao_at', label: '카카오 알림톡' },
      ],
      defaultValue: 'kakao_at',
    },
  ],
  refund_spike: [
    {
      field: 'threshold',
      label: '환불 급증 감지 배수 (평소 대비)',
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
      label: '정원 충족률 기준 (%)',
      type: 'number',
      policyPath: 'auto_notification.class_fill_rate_low_persistent.threshold',
      min: 0,
      max: 100,
      defaultValue: 50,
    },
    {
      field: 'persistent_days',
      label: '연속 미달 일수',
      type: 'number',
      policyPath: 'auto_notification.class_fill_rate_low_persistent.persistent_days',
      min: 1,
      defaultValue: 7,
    },
  ],
  ai_suggest_class_merge: [
    {
      field: 'min_capacity',
      label: '수업 최소 정원 (명)',
      type: 'number',
      policyPath: 'auto_notification.ai_suggest_class_merge.min_capacity',
      min: 1,
      defaultValue: 10,
    },
    {
      field: 'fill_rate_threshold',
      label: '통합 검토 기준 정원률 (%)',
      type: 'number',
      policyPath: 'auto_notification.ai_suggest_class_merge.fill_rate_threshold',
      min: 0,
      max: 100,
      defaultValue: 50,
    },
    {
      field: 'channel',
      label: '알림 채널',
      type: 'select',
      policyPath: 'auto_notification.ai_suggest_class_merge.channel',
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
      policyPath: 'auto_notification.ai_suggest_class_merge.require_approval',
      defaultValue: true,
    },
  ],
  time_slot_fill_rate_low: [
    {
      field: 'threshold',
      label: '시간대 정원 충족률 기준 (%)',
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
      label: '확장 검토 기준 정원률 (%)',
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
      label: '미운영 연속 일수',
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
      label: '이탈 급증 감지 배수 (평소 대비)',
      type: 'number',
      policyPath: 'auto_notification.churn_increase.threshold',
      min: 1,
      defaultValue: 2,
    },
  ],
  ai_suggest_churn_focus: [
    {
      field: 'ai_threshold',
      label: '이탈 위험 기준 점수 (0~100)',
      type: 'number',
      policyPath: 'auto_notification.ai_suggest_churn_focus.ai_threshold',
      min: 0,
      max: 100,
      defaultValue: 70,
    },
    {
      field: 'risk_window_days',
      label: '분석 기간 (일)',
      type: 'number',
      policyPath: 'auto_notification.ai_suggest_churn_focus.risk_window_days',
      min: 1,
      defaultValue: 30,
    },
    {
      field: 'channel',
      label: '알림 채널',
      type: 'select',
      policyPath: 'auto_notification.ai_suggest_churn_focus.channel',
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
      policyPath: 'auto_notification.ai_suggest_churn_focus.require_approval',
      defaultValue: true,
    },
  ],
  attendance_rate_drop_weekly: [
    {
      field: 'threshold',
      label: '출석률 하락 경고 기준 (%)',
      type: 'number',
      policyPath: 'auto_notification.attendance_rate_drop_weekly.threshold',
      min: 0,
      defaultValue: 10,
    },
  ],
  risk_students_weekly_kpi: [
    {
      field: 'risk_score_threshold',
      label: '위험 학생 기준 점수 (0~100)',
      type: 'number',
      policyPath: 'auto_notification.risk_students_weekly_kpi.risk_score_threshold',
      min: 0,
      max: 100,
      defaultValue: 60,
    },
    {
      field: 'include_categories',
      label: '포함 카테고리',
      type: 'select',
      policyPath: 'auto_notification.risk_students_weekly_kpi.include_categories',
      options: [
        { value: 'all', label: '전체' },
        { value: 'attendance', label: '출결' },
        { value: 'payment', label: '수납' },
        { value: 'behavioral', label: '행동' },
      ],
      defaultValue: 'all',
    },
    {
      field: 'channel',
      label: '알림 채널',
      type: 'select',
      policyPath: 'auto_notification.risk_students_weekly_kpi.channel',
      options: [
        { value: 'sms', label: 'SMS' },
        { value: 'kakao_at', label: '카카오 알림톡' },
      ],
      defaultValue: 'kakao_at',
    },
  ],

  // growth_marketing (6)
  new_member_drop: [
    {
      field: 'threshold',
      label: '신규 회원 감소 경고 기준 (%)',
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
      label: '상담→등록 전환율 하락 기준 (%)',
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
      label: '지역 평균 대비 성과 격차 (%)',
      type: 'number',
      policyPath: 'auto_notification.regional_underperformance.threshold',
      min: 0,
      defaultValue: 20,
    },
  ],
  regional_rank_drop: [
    {
      field: 'threshold',
      label: '순위 하락 경고 기준 (위)',
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
      label: '이상 패턴 감지 연속 일수',
      type: 'number',
      policyPath: 'auto_notification.attendance_pattern_anomaly.threshold',
      min: 1,
      defaultValue: 3,
    },
    {
      field: 'priority',
      label: '알림 중요도 (0~100)',
      type: 'number',
      policyPath: 'auto_notification.attendance_pattern_anomaly.priority',
      min: 0,
      max: 100,
      defaultValue: 50,
    },
    {
      field: 'ttl_days',
      label: '알림 표시 기간 (일)',
      type: 'number',
      policyPath: 'auto_notification.attendance_pattern_anomaly.ttl_days',
      min: 1,
      defaultValue: 7,
    },
    {
      field: 'throttle_daily_limit',
      label: '하루 최대 알림 수',
      type: 'number',
      policyPath: 'auto_notification.attendance_pattern_anomaly.throttle.daily_limit',
      min: 1,
      defaultValue: 20,
    },
    {
      field: 'throttle_student_limit',
      label: '학생당 최대 알림 수',
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
  student_onboarding_message: [
    {
      field: 'channel',
      label: '알림 채널',
      type: 'select',
      policyPath: 'auto_notification.student_onboarding_message.channel',
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
      policyPath: 'auto_notification.student_onboarding_message.require_approval',
      defaultValue: false,
    },
  ],
  bulk_message_send: [
    {
      field: 'channel',
      label: '알림 채널',
      type: 'select',
      policyPath: 'auto_notification.bulk_message_send.channel',
      options: [
        { value: 'sms', label: 'SMS' },
        { value: 'kakao_at', label: '카카오 알림톡' },
      ],
      defaultValue: 'kakao_at',
    },
    {
      field: 'max_per_hour',
      label: '시간당 최대 발송 건수',
      type: 'number',
      policyPath: 'auto_notification.bulk_message_send.max_per_hour',
      min: 1,
      defaultValue: 100,
    },
    {
      field: 'require_approval',
      label: '승인 필요',
      type: 'boolean',
      policyPath: 'auto_notification.bulk_message_send.require_approval',
      defaultValue: true,
    },
  ],
  message_approval_workflow: [
    {
      field: 'channel',
      label: '알림 채널',
      type: 'select',
      policyPath: 'auto_notification.message_approval_workflow.channel',
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
      policyPath: 'auto_notification.message_approval_workflow.require_approval',
      defaultValue: true,
    },
  ],

  // workforce_ops (2)
  teacher_workload_imbalance: [
    {
      field: 'threshold',
      label: '강사 간 수업 수 차이 (개)',
      type: 'number',
      policyPath: 'auto_notification.teacher_workload_imbalance.threshold',
      min: 1,
      defaultValue: 5,
    },
  ],
  staff_absence_schedule_risk: [
    {
      field: 'advance_notice_days',
      label: '결근 예고 알림 (일 전)',
      type: 'number',
      policyPath: 'auto_notification.staff_absence_schedule_risk.advance_notice_days',
      min: 1,
      defaultValue: 7,
    },
    {
      field: 'critical_absence_hours',
      label: '대체 필요 결근 시간 (시간)',
      type: 'number',
      policyPath: 'auto_notification.staff_absence_schedule_risk.critical_absence_hours',
      min: 1,
      defaultValue: 8,
    },
    {
      field: 'channel',
      label: '알림 채널',
      type: 'select',
      policyPath: 'auto_notification.staff_absence_schedule_risk.channel',
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
      policyPath: 'auto_notification.staff_absence_schedule_risk.require_approval',
      defaultValue: true,
    },
  ],
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
    title: '수업료 납부 안내',
    description: '수업료 납부일이 다가오면 학부모님께 미리 알려드립니다. 예: 납부일 3일 전과 1일 전에 "○○ 학생 수업료 납부일이 ○월 ○일입니다"라는 안내를 발송합니다.',
    policyKey: 'financial_health',
  },
  invoice_partial_balance: {
    title: '미납 잔액 안내',
    description: '수업료 일부만 납부된 경우 남은 금액을 안내합니다. 예: 30만원 중 20만원만 납부된 경우 "잔여 수업료 10만원이 남아있습니다"라는 안내를 발송합니다.',
    policyKey: 'financial_health',
  },
  recurring_payment_failed: {
    title: '자동결제 실패 안내',
    description: '등록된 카드로 자동결제가 실패했을 때 학부모님께 안내합니다. 예: 카드 한도 초과, 유효기간 만료 등으로 결제가 안 된 경우 "자동결제가 실패했습니다. 카드 정보를 확인해주세요"라는 안내를 발송합니다.',
    policyKey: 'financial_health',
  },
  revenue_target_under: {
    title: '월 매출 목표 미달 알림',
    description: '이번 달 매출이 목표에 못 미칠 때 원장님께 알려드립니다. 예: 목표 1,000만원 대비 현재 700만원일 경우 "이번 달 매출이 목표 대비 70% 수준입니다"라는 알림을 보냅니다.',
    policyKey: 'financial_health',
  },
  collection_rate_drop: {
    title: '수납률 하락 경고',
    description: '수업료 수납률이 기준 이하로 떨어지면 원장님께 알려드립니다. 예: 수납률이 90% 아래로 내려가면 "이번 달 수납률이 85%입니다. 미납 현황을 확인해주세요"라는 알림을 보냅니다.',
    policyKey: 'financial_health',
  },
  overdue_outstanding_over_limit: {
    title: '고액 미납 알림',
    description: '특정 금액 이상 미납이 발생하면 원장님께 즉시 알려드립니다. 예: 미납액이 50만원을 초과하면 "○○ 학생의 미납액이 52만원입니다"라는 알림을 보냅니다.',
    policyKey: 'financial_health',
  },
  revenue_required_per_day: {
    title: '일일 필요 매출 안내',
    description: '월 목표 달성을 위해 매일 필요한 매출을 계산해 알려드립니다. 예: 남은 기간 동안 하루 평균 33만원의 매출이 필요하다면 "목표 달성을 위해 일일 33만원의 매출이 필요합니다"라고 안내합니다.',
    policyKey: 'financial_health',
  },
  top_overdue_customers_digest: {
    title: '미납 현황 요약 리포트',
    description: '미납 금액이 많은 순서대로 정리된 리스트를 보내드립니다. 예: "미납 상위 10명: 1위 ○○학생 52만원, 2위 ○○학생 38만원..."과 같은 요약 리포트를 제공합니다.',
    policyKey: 'financial_health',
  },
  refund_spike: {
    title: '환불 급증 경고',
    description: '환불이 평소보다 많이 발생하면 원장님께 알려드립니다. 예: 지난달 대비 환불이 2배 이상 늘어나면 "이번 주 환불 건수가 평소의 2.5배입니다. 원인을 파악해보세요"라는 알림을 보냅니다.',
    policyKey: 'financial_health',
  },
  monthly_business_report: {
    title: '월간 경영 리포트',
    description: '매월 초에 지난달 매출, 수납률, 학생 증감 등을 한눈에 볼 수 있는 리포트를 자동으로 생성합니다. 예: "○월 리포트: 매출 1,200만원(전월 대비 +5%), 신규 등록 8명, 퇴원 3명"',
    policyKey: 'financial_health',
  },

  // capacity_optimization (6)
  class_fill_rate_low_persistent: {
    title: '저정원 수업 지속 알림',
    description: '정원 대비 수강생이 적은 수업이 계속되면 알려드립니다. 예: "초급 영어반"이 정원 10명 중 3명만 수강하는 상태가 7일 이상 지속되면 "초급 영어반 정원 충족률이 30%입니다. 수업 조정을 검토해보세요"라는 알림을 보냅니다.',
    policyKey: 'capacity_optimization',
  },
  ai_suggest_class_merge: {
    title: 'AI 수업 통합 제안',
    description: 'AI가 비슷한 수준의 저정원 수업들을 분석해 통합을 제안합니다. 예: "월요일 초급A반(3명)과 수요일 초급B반(4명)을 통합하면 정원 활용도가 70%로 개선됩니다"와 같은 구체적인 제안을 드립니다.',
    policyKey: 'capacity_optimization',
  },
  time_slot_fill_rate_low: {
    title: '비인기 시간대 알림',
    description: '특정 시간대에 수강생이 적으면 알려드립니다. 예: "오후 2-4시 시간대 수업들의 평균 수강률이 25%입니다"라는 알림으로 시간표 조정 필요성을 파악할 수 있습니다.',
    policyKey: 'capacity_optimization',
  },
  high_fill_rate_expand_candidate: {
    title: '인기 수업 확장 제안',
    description: '정원이 거의 찬 인기 수업을 파악해 추가 개설을 제안합니다. 예: "중급 수학반이 정원의 95%가 찼습니다. 추가 반 개설을 고려해보세요"라는 알림을 보냅니다.',
    policyKey: 'capacity_optimization',
  },
  unused_class_persistent: {
    title: '장기 미운영 수업 알림',
    description: '오랫동안 수업이 진행되지 않는 반을 감지해 알려드립니다. 예: "고급 영어반이 30일 이상 수업이 없습니다. 폐강 여부를 검토해보세요"라는 알림을 보냅니다.',
    policyKey: 'capacity_optimization',
  },
  weekly_ops_summary: {
    title: '주간 운영 현황 리포트',
    description: '매주 초에 지난주 수업 운영 현황을 정리해 보내드립니다. 예: "지난주 운영 현황: 총 수업 48회, 평균 출석률 89%, 저정원 수업 3개, 인기 수업 5개"와 같은 요약을 제공합니다.',
    policyKey: 'capacity_optimization',
  },

  // customer_retention (8)
  class_reminder_today: {
    title: '오늘 수업 안내',
    description: '수업 시작 전에 학부모님께 알림을 보내 결석을 예방합니다. 예: 수업 30분 전에 "오늘 15시 수학 수업이 있습니다"라는 안내를 발송합니다.',
    policyKey: 'customer_retention',
  },
  class_schedule_tomorrow: {
    title: '내일 수업 일정 안내',
    description: '전날 저녁에 내일 수업 일정을 미리 알려드립니다. 예: 매일 오후 8시에 "내일 ○○ 학생의 수업 일정: 15시 영어, 17시 수학"이라는 안내를 발송합니다.',
    policyKey: 'customer_retention',
  },
  consultation_reminder: {
    title: '상담 일정 알림',
    description: '예약된 상담 일정을 잊지 않도록 미리 알려드립니다. 예: 상담 하루 전에 "내일 14시 상담이 예정되어 있습니다", 2시간 전에 "2시간 후 상담이 있습니다"라는 알림을 보냅니다.',
    policyKey: 'customer_retention',
  },
  absence_first_day: {
    title: '결석 즉시 알림',
    description: '학생이 수업에 불참하면 바로 학부모님께 알려드립니다. 예: "○○ 학생이 오늘 15시 수학 수업에 출석하지 않았습니다"라는 알림으로 빠른 확인이 가능합니다.',
    policyKey: 'customer_retention',
  },
  churn_increase: {
    title: '퇴원 급증 경고',
    description: '퇴원하는 학생이 평소보다 많이 늘어나면 알려드립니다. 예: "이번 달 퇴원이 지난달 대비 2배 증가했습니다. 원인 분석이 필요합니다"라는 알림을 보냅니다.',
    policyKey: 'customer_retention',
  },
  ai_suggest_churn_focus: {
    title: 'AI 이탈 위험 학생 관리',
    description: 'AI가 출결 패턴, 수납 이력, 수업 참여도 등을 종합 분석하여 퇴원 가능성이 높은 학생을 조기에 감지합니다. 예: "○○ 학생이 최근 30일간 결석 4회, 수납 지연 2회로 이탈 위험이 높습니다. 상담을 권장합니다"라는 알림으로 선제적 관리가 가능합니다.',
    policyKey: 'customer_retention',
  },
  attendance_rate_drop_weekly: {
    title: '주간 출석률 하락 알림',
    description: '이번 주 전체 출석률이 저번 주보다 떨어지면 알려드립니다. 예: "이번 주 출석률이 85%로, 지난주(92%) 대비 7%p 하락했습니다"라는 알림을 보냅니다.',
    policyKey: 'customer_retention',
  },
  risk_students_weekly_kpi: {
    title: '관리 필요 학생 주간 리포트',
    description: '출결, 수납, 성적 등 여러 지표를 종합해 관리가 필요한 학생 목록을 매주 정리해 보내드립니다. 예: "이번 주 관리 필요 학생 5명: ○○(출결 불량), ○○(수납 지연)..."과 같은 리포트를 제공합니다.',
    policyKey: 'customer_retention',
  },

  // growth_marketing (6)
  new_member_drop: {
    title: '신규 등록 감소 알림',
    description: '신규 등록 학생이 줄어들면 알려드립니다. 예: "이번 달 신규 등록이 8명으로, 지난달(10명) 대비 20% 감소했습니다. 마케팅 활동을 점검해보세요"라는 알림을 보냅니다.',
    policyKey: 'growth_marketing',
  },
  inquiry_conversion_drop: {
    title: '상담→등록 전환율 하락 알림',
    description: '상담을 했지만 등록으로 이어지는 비율이 낮아지면 알려드립니다. 예: "이번 달 상담 20건 중 등록 6건(30%)으로, 지난달(50%) 대비 전환율이 하락했습니다"라는 알림을 보냅니다.',
    policyKey: 'growth_marketing',
  },
  birthday_greeting: {
    title: '생일 축하 메시지',
    description: '학생 생일에 자동으로 축하 메시지를 보내 유대감을 높입니다. 예: "○○ 학생, 생일을 진심으로 축하합니다! 🎂"라는 메시지를 학부모님께 발송합니다.',
    policyKey: 'growth_marketing',
  },
  enrollment_anniversary: {
    title: '등록 기념일 메시지',
    description: '학원 등록 1주년 등 기념일에 감사 메시지를 보냅니다. 예: "○○ 학생이 저희 학원과 함께한 지 1년이 되었습니다. 항상 감사드립니다"라는 메시지를 발송합니다.',
    policyKey: 'growth_marketing',
  },
  regional_underperformance: {
    title: '지역 내 성과 비교 알림',
    description: '같은 지역의 다른 학원들과 비교해 성과가 낮으면 알려드립니다. 예: "우리 학원의 이번 달 등록률이 지역 평균(15%) 대비 20% 낮습니다"라는 알림을 보냅니다.',
    policyKey: 'growth_marketing',
  },
  regional_rank_drop: {
    title: '지역 순위 변동 알림',
    description: '지역 내 순위가 크게 변동되면 알려드립니다. 예: "우리 학원의 지역 내 순위가 지난달 3위에서 8위로 하락했습니다. 경쟁 현황을 분석해보세요"라는 알림을 보냅니다.',
    policyKey: 'growth_marketing',
  },

  // safety_compliance (10)
  class_change_or_cancel: {
    title: '수업 변경/취소 알림',
    description: '수업이 변경되거나 취소되면 즉시 학부모에게 알림을 발송합니다. 예: "○○ 학생의 오후 3시 영어 수업이 오후 4시로 변경되었습니다" 또는 "오늘 수학 수업이 취소되었습니다"라는 안내를 발송합니다.',
    policyKey: 'safety_compliance',
  },
  checkin_reminder: {
    title: '체크인 알림',
    description: '수업 시작 전에 체크인을 안내하는 알림을 발송합니다. 예: 수업 시작 10분 전에 "○○ 학생의 수학 수업이 15시에 시작됩니다. 도착하시면 체크인해 주세요"라는 안내를 발송합니다.',
    policyKey: 'safety_compliance',
  },
  checkout_missing_alert: {
    title: '체크아웃 누락 알림',
    description: '수업 종료 후 체크아웃이 누락되면 학부모에게 알림을 발송합니다. 예: 수업 종료 30분 후에도 체크아웃이 없으면 "○○ 학생의 체크아웃이 확인되지 않았습니다. 확인 부탁드립니다"라는 안내를 발송합니다.',
    policyKey: 'safety_compliance',
  },
  announcement_urgent: {
    title: '긴급 공지 알림',
    description: '긴급 공지가 등록되면 즉시 학부모에게 알림을 발송합니다. 예: 원장님이 "폭설로 인한 휴원 안내"를 긴급 공지로 등록하면 전체 학부모에게 즉시 알림이 발송됩니다.',
    policyKey: 'safety_compliance',
  },
  announcement_digest: {
    title: '공지 요약',
    description: '주간 또는 월간 공지를 요약하여 학부모에게 제공합니다. 예: 매주 월요일에 "지난주 공지 요약: 1. 시간표 변경 안내 2. 여름방학 특강 안내"와 같은 요약 메시지를 발송합니다.',
    policyKey: 'safety_compliance',
  },
  consultation_summary_ready: {
    title: '상담 요약 완료 알림',
    description: '상담 요약이 완료되면 학부모에게 알림을 발송합니다. 예: 상담 후 AI가 요약을 생성하면 "○○ 학생 상담 요약이 준비되었습니다. 앱에서 확인해 주세요"라는 안내를 발송합니다.',
    policyKey: 'safety_compliance',
  },
  attendance_pattern_anomaly: {
    title: '출결 패턴 이상 감지',
    description: '학생의 출결 패턴에 이상이 감지되면 학부모에게 알림을 발송합니다. 예: 평소 출석하던 학생이 3일 연속 결석하면 "○○ 학생의 출결에 이상 패턴이 감지되었습니다. 확인해 주세요"라는 알림을 보냅니다.',
    policyKey: 'safety_compliance',
  },
  student_onboarding_message: {
    title: '신규 학생 환영 메시지',
    description: '신규 학생 등록 시 자동으로 환영 메시지를 발송합니다. 예: 등록 완료 후 "○○ 학생의 등록을 환영합니다! 첫 수업은 ○월 ○일입니다"라는 환영 메시지를 학부모에게 발송합니다.',
    policyKey: 'safety_compliance',
  },
  bulk_message_send: {
    title: '대량 메시지 발송',
    description: '대량 메시지를 예약된 시간에 자동으로 발송합니다. 예: "여름방학 특강 안내" 메시지를 100명의 학부모에게 예약 발송하면, 설정된 시간에 자동으로 발송됩니다.',
    policyKey: 'safety_compliance',
  },
  message_approval_workflow: {
    title: '메시지 승인 워크플로',
    description: '중요한 메시지 발송 전 승인 과정을 자동화합니다. 예: 직원이 작성한 "수업료 인상 안내" 메시지가 발송 전에 원장님에게 승인 요청으로 전송되어, 검토 후 승인하면 발송됩니다.',
    policyKey: 'safety_compliance',
  },

  // workforce_ops (2)
  teacher_workload_imbalance: {
    title: '강사 업무량 불균형 알림',
    description: '강사 간 업무량이 불균형할 때 관리자에게 알림을 발송합니다. 예: "김강사 주간 수업 20회, 이강사 주간 수업 10회로 업무량 차이가 10회입니다. 수업 배정을 조정해 보세요"라는 알림을 보냅니다.',
    policyKey: 'workforce_ops',
  },
  staff_absence_schedule_risk: {
    title: '직원 결근 일정 리스크 알림',
    description: '직원 결근으로 인한 일정 리스크가 발생할 때 관리자에게 알림을 발송합니다. 예: "박강사가 내일 휴가로 8시간 결근 예정입니다. 수학반 3개 수업에 대체 강사 배정이 필요합니다"라는 알림을 보냅니다.',
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
