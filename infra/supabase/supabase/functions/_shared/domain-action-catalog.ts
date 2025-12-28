/**
 * Domain Action Catalog (SSOT) - Edge Function용
 *
 * L2-B Intent 자동 실행을 위한 action_key 카탈로그 정본(SSOT)
 * [불변 규칙] 이 카탈로그에 없는 action_key는 실행/추가할 수 없습니다.
 * [불변 규칙] 카탈로그 수정 시 문서(챗봇.md)와 동기화 필수
 *
 * 참고: docu/챗봇.md Section 12.1.3
 *
 * ⚠️ 동기화 필수: 이 파일은 다음 파일들과 동일한 내용을 유지해야 합니다:
 * - packages/core/core-automation/src/domain-action-catalog.ts (최상위 정본)
 * - infra/supabase/functions/_shared/domain-action-catalog.ts (이 파일, Edge Function 구현)
 *
 * 수정 시 2개 파일(packages + infra/functions/_shared)만 업데이트하면 됩니다.
 * (향후 자동 동기화 스크립트 또는 CI 검증 추가 권장)
 */

/**
 * Domain Action Key 카탈로그 (48개)
 *
 * 문서 SSOT: docu/챗봇.md Section 12.1.3
 * - attendance (4)
 * - billing (9)
 * - message (3)
 * - student (12)
 * - class (4)
 * - schedule (4)
 * - note (2)
 * - report (2)
 * - system (4)
 * - policy (3)
 */
export const DOMAIN_ACTION_CATALOG = [
  // attendance (4)
  'attendance.correct_record',
  'attendance.mark_excused',
  'attendance.bulk_update',
  'attendance.schedule_recheck',

  // billing (9)
  'billing.issue_invoices',
  'billing.reissue_invoice',
  'billing.record_manual_payment',
  'billing.apply_discount',
  'billing.apply_refund',
  'billing.create_installment_plan',
  'billing.fix_duplicate_invoices',
  'billing.sync_gateway',
  'billing.close_month',

  // message (3)
  'message.cancel_scheduled',
  'message.create_template',
  'message.update_template',

  // student (12)
  'student.register',
  'student.update_profile',
  'student.change_class',
  'student.pause',
  'student.resume',
  'student.discharge',
  'student.merge_duplicates',
  'student.update_guardian_contact',
  'student.assign_tags',
  'student.bulk_register',
  'student.bulk_update',
  'student.data_quality_apply_fix',
  'student.reactivate_from_discharged',

  // class (4)
  'class.create',
  'class.update',
  'class.close',
  'class.bulk_reassign_teacher',

  // schedule (4)
  'schedule.add_session',
  'schedule.move_session',
  'schedule.cancel_session',
  'schedule.bulk_shift',

  // note (2)
  'note.create',
  'note.update',

  // report (2)
  'report.generate_monthly_report',
  'report.generate_daily_brief',

  // system (4)
  'system.run_healthcheck',
  'system.rebuild_search_index',
  'system.backfill_reports',
  'system.retry_failed_actions',

  // policy (3)
  'policy.enable_automation',
  'policy.update_threshold',
  'rbac.assign_role',
] as const;

/**
 * Domain Action Key 유니온 타입
 */
export type DomainActionKey = (typeof DOMAIN_ACTION_CATALOG)[number];

/**
 * Domain Action Catalog Set (성능 최적화용)
 *
 * O(1) 검증을 위한 Set 자료구조. 배열의 includes()는 O(n)이지만 Set의 has()는 O(1)입니다.
 */
const DOMAIN_ACTION_CATALOG_SET = new Set<string>(DOMAIN_ACTION_CATALOG);

/**
 * action_key 검증 가드 함수
 *
 * 성능 최적화: Set을 사용하여 O(1) 시간 복잡도로 검증합니다.
 * @param v 검증할 문자열
 * @returns v가 유효한 DomainActionKey인지 여부
 */
export function isDomainActionKey(v: string): v is DomainActionKey {
  return DOMAIN_ACTION_CATALOG_SET.has(v);
}

/**
 * action_key 검증 assert 함수 (Fail-Closed)
 * @param v 검증할 문자열
 * @throws Error v가 유효한 DomainActionKey가 아닌 경우
 */
export function assertDomainActionKey(v: string): asserts v is DomainActionKey {
  if (!isDomainActionKey(v)) {
    throw new Error(
      `Invalid domain action_key: "${v}". ` +
      `Must be one of: ${DOMAIN_ACTION_CATALOG.join(', ')}`
    );
  }
}

