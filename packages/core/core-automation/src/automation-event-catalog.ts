/**
 * Automation Event Catalog (SSOT)
 *
 * 자동화 event_type 카탈로그 정본(SSOT)
 * [불변 규칙] 이 카탈로그에 없는 event_type은 실행/추가할 수 없습니다.
 * [불변 규칙] 카탈로그 수정 시 문서(AI_자동화_기능_정리.md)와 동기화 필수
 *
 * 참고: docu/AI_자동화_기능_정리.md Section 11
 */

/**
 * 자동화 event_type 카탈로그 (39개)
 *
 * 문서 SSOT: docu/AI_자동화_기능_정리.md Section 11
 * - financial_health (10)
 * - capacity_optimization (6)
 * - customer_retention (8)
 * - growth_marketing (6)
 * - safety_compliance (7)
 * - workforce_ops (2)
 */
export const AUTOMATION_EVENT_CATALOG = [
  // financial_health (10)
  'payment_due_reminder',
  'invoice_partial_balance',
  'recurring_payment_failed',
  'revenue_target_under',
  'collection_rate_drop',
  'overdue_outstanding_over_limit',
  'revenue_required_per_day',
  'top_overdue_customers_digest',
  'refund_spike',
  'monthly_business_report',

  // capacity_optimization (6)
  'class_fill_rate_low_persistent',
  'ai_suggest_class_merge',
  'time_slot_fill_rate_low',
  'high_fill_rate_expand_candidate',
  'unused_class_persistent',
  'weekly_ops_summary',

  // customer_retention (8)
  'class_reminder_today',
  'class_schedule_tomorrow',
  'consultation_reminder',
  'absence_first_day',
  'churn_increase',
  'ai_suggest_churn_focus',
  'attendance_rate_drop_weekly',
  'risk_students_weekly_kpi',

  // growth_marketing (6)
  'new_member_drop',
  'inquiry_conversion_drop',
  'birthday_greeting',
  'enrollment_anniversary',
  'regional_underperformance',
  'regional_rank_drop',

  // safety_compliance (7)
  'class_change_or_cancel',
  'checkin_reminder',
  'checkout_missing_alert',
  'announcement_urgent',
  'announcement_digest',
  'consultation_summary_ready',
  'attendance_pattern_anomaly',

  // workforce_ops (2)
  'teacher_workload_imbalance',
  'staff_absence_schedule_risk',
] as const;

/**
 * Automation Event Type 유니온 타입
 */
export type AutomationEventType = (typeof AUTOMATION_EVENT_CATALOG)[number];

/**
 * event_type 검증 가드 함수
 * @param v 검증할 문자열
 * @returns v가 유효한 AutomationEventType인지 여부
 */
export function isAutomationEventType(v: string): v is AutomationEventType {
  return (AUTOMATION_EVENT_CATALOG as readonly string[]).includes(v);
}

/**
 * event_type 검증 assert 함수 (Fail-Closed)
 * @param v 검증할 문자열
 * @throws Error v가 유효한 AutomationEventType이 아닌 경우
 */
export function assertAutomationEventType(v: string): asserts v is AutomationEventType {
  if (!isAutomationEventType(v)) {
    throw new Error(
      `Invalid automation event_type: "${v}". ` +
      `Must be one of: ${AUTOMATION_EVENT_CATALOG.join(', ')}`
    );
  }
}

