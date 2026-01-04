/**
 * Automation Event Catalog (SSOT) - Edge Function용
 *
 * 자동화 event_type 카탈로그 정본(SSOT)
 * [불변 규칙] 이 카탈로그에 없는 event_type은 실행/추가할 수 없습니다.
 * [불변 규칙] 카탈로그 수정 시 문서(AI_자동화_기능_정리.md)와 동기화 필수
 *
 * 참고: docu/AI_자동화_기능_정리.md Section 11
 *
 * ⚠️ 동기화 필수: 이 파일은 다음 파일들과 동일한 내용을 유지해야 합니다:
 * - packages/core/core-automation/src/automation-event-catalog.ts (최상위 정본)
 * - infra/supabase/functions/_shared/automation-event-catalog.ts (이 파일, Edge Function 구현)
 * - infra/supabase/supabase/functions/_shared/automation-event-catalog.ts (re-export, 자동 동기화됨)
 *
 * 수정 시 2개 파일(packages + infra/functions/_shared)만 업데이트하면 됩니다.
 * infra/supabase/functions/_shared/automation-event-catalog.ts는 re-export이므로 자동으로 동기화됩니다.
 * (향후 자동 동기화 스크립트 또는 CI 검증 추가 권장)
 */

/**
 * 자동화 event_type 카탈로그 (42개)
 *
 * 문서 SSOT: docu/AI_자동화_기능_정리.md Section 11
 * - financial_health (10)
 * - capacity_optimization (6)
 * - customer_retention (8)
 * - growth_marketing (6)
 * - safety_compliance (10)
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

  // safety_compliance (10)
  'class_change_or_cancel',
  'checkin_reminder',
  'checkout_missing_alert',
  'announcement_urgent',
  'announcement_digest',
  'consultation_summary_ready',
  'attendance_pattern_anomaly',
  'student_onboarding_message',
  'bulk_message_send',
  'message_approval_workflow',

  // workforce_ops (2)
  'teacher_workload_imbalance',
  'staff_absence_schedule_risk',
] as const;

/**
 * Automation Event Type 유니온 타입
 */
export type AutomationEventType = (typeof AUTOMATION_EVENT_CATALOG)[number];

/**
 * Automation Event Catalog Set (성능 최적화용)
 *
 * O(1) 검증을 위한 Set 자료구조. 배열의 includes()는 O(n)이지만 Set의 has()는 O(1)입니다.
 * 39개 항목이므로 성능 개선 효과가 있습니다.
 */
const AUTOMATION_EVENT_CATALOG_SET = new Set<string>(AUTOMATION_EVENT_CATALOG);

/**
 * event_type 검증 가드 함수
 *
 * 성능 최적화: Set을 사용하여 O(1) 시간 복잡도로 검증합니다.
 * @param v 검증할 문자열
 * @returns v가 유효한 AutomationEventType인지 여부
 */
export function isAutomationEventType(v: string): v is AutomationEventType {
  return AUTOMATION_EVENT_CATALOG_SET.has(v);
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

