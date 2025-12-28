/**
 * Intent Registry for Edge Functions
 *
 * 챗봇.md 8.2, 12.1 참조
 * 목적: Edge Function에서 사용할 수 있는 간소화된 Intent Registry
 *
 * [SSOT] packages/chatops-intents/src/registry.ts가 Intent Registry의 SSOT입니다.
 * 이 파일은 환경 제약(Deno)으로 인한 간소화된 버전이며, SSOT와 동기화되어야 합니다.
 *
 * [불변 규칙] 새로운 Intent를 추가할 때는 SSOT(packages/chatops-intents/src/registry.ts)에
 * 먼저 추가한 후, 이 파일에도 동일한 intent_key로 추가해야 합니다.
 *
 * 주의: Edge Function은 Deno 환경이므로, npm 패키지를 직접 import하기 어렵습니다.
 * 따라서 이 파일은 registry의 핵심 정보만 포함합니다.
 * 실제 스키마 검증은 서버 측에서 수행해야 합니다.
 *
 * ⚠️ 자동 생성 파일: 이 파일은 scripts/generate-edge-intent-registry.ts에 의해 자동 생성됩니다.
 * 수동 수정 금지: SSOT Registry를 수정한 후 이 스크립트를 실행하여 동기화하세요.
 */

import type { IntentRegistryItem } from './intent-parser.ts';

/**
 * Intent Registry (간소화된 버전)
 *
 * [SSOT] packages/chatops-intents/src/registry.ts가 SSOT입니다.
 * 이 registry는 SSOT와 동기화되어야 하며, 새로운 Intent를 추가할 때는
 * SSOT에 먼저 추가한 후 이 파일에도 동일한 intent_key로 추가해야 합니다.
 */
export const intentRegistry: Record<string, IntentRegistryItem> = {
  // 출결(Attendance) 도메인

  'attendance.query.late': {
    intent_key: 'attendance.query.late',
    automation_level: 'L0',
  },

  'attendance.create.notify_guardians_late': {
    intent_key: 'attendance.create.notify_guardians_late',
    automation_level: 'L1',
  },

  'attendance.exec.notify_guardians_late': {
    intent_key: 'attendance.exec.notify_guardians_late',
    automation_level: 'L2',
    execution_class: 'A',
  },

  'attendance.exec.notify_guardians_absent': {
    intent_key: 'attendance.exec.notify_guardians_absent',
    automation_level: 'L2',
    execution_class: 'A',
  },

  'attendance.exec.request_reason_message': {
    intent_key: 'attendance.exec.request_reason_message',
    automation_level: 'L2',
    execution_class: 'A',
  },

  'attendance.exec.send_staff_summary': {
    intent_key: 'attendance.exec.send_staff_summary',
    automation_level: 'L2',
    execution_class: 'A',
  },



  // 학생 라이프사이클(Student) 도메인

  'student.query.search': {
    intent_key: 'student.query.search',
    automation_level: 'L0',
  },



  // 출결(Attendance) 도메인

  'attendance.query.by_student': {
    intent_key: 'attendance.query.by_student',
    automation_level: 'L0',
  },

  'attendance.query.absent': {
    intent_key: 'attendance.query.absent',
    automation_level: 'L0',
  },

  'attendance.query.early_leave': {
    intent_key: 'attendance.query.early_leave',
    automation_level: 'L0',
  },

  'attendance.query.unchecked': {
    intent_key: 'attendance.query.unchecked',
    automation_level: 'L0',
  },

  'attendance.query.by_class': {
    intent_key: 'attendance.query.by_class',
    automation_level: 'L0',
  },

  'attendance.query.streak_absent': {
    intent_key: 'attendance.query.streak_absent',
    automation_level: 'L0',
  },

  'attendance.query.rate_summary': {
    intent_key: 'attendance.query.rate_summary',
    automation_level: 'L0',
  },

  'attendance.query.rate_drop': {
    intent_key: 'attendance.query.rate_drop',
    automation_level: 'L0',
  },

  'attendance.query.late_rank': {
    intent_key: 'attendance.query.late_rank',
    automation_level: 'L0',
  },

  'attendance.query.export_csv': {
    intent_key: 'attendance.query.export_csv',
    automation_level: 'L0',
  },

  'attendance.task.flag_absence_followup': {
    intent_key: 'attendance.task.flag_absence_followup',
    automation_level: 'L1',
  },

  'attendance.task.flag_late_followup': {
    intent_key: 'attendance.task.flag_late_followup',
    automation_level: 'L1',
  },

  'attendance.task.create_contact_list': {
    intent_key: 'attendance.task.create_contact_list',
    automation_level: 'L1',
  },

  'attendance.exec.correct_record': {
    intent_key: 'attendance.exec.correct_record',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'attendance.exec.mark_excused': {
    intent_key: 'attendance.exec.mark_excused',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'attendance.exec.bulk_update': {
    intent_key: 'attendance.exec.bulk_update',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'attendance.exec.schedule_recheck': {
    intent_key: 'attendance.exec.schedule_recheck',
    automation_level: 'L2',
    execution_class: 'B',
  },



  // 수납/청구(Billing) 도메인

  'billing.query.overdue_month': {
    intent_key: 'billing.query.overdue_month',
    automation_level: 'L0',
  },

  'billing.query.overdue_list': {
    intent_key: 'billing.query.overdue_list',
    automation_level: 'L0',
  },

  'billing.query.by_student': {
    intent_key: 'billing.query.by_student',
    automation_level: 'L0',
  },

  'billing.query.invoice_status': {
    intent_key: 'billing.query.invoice_status',
    automation_level: 'L0',
  },

  'billing.query.failed_payments': {
    intent_key: 'billing.query.failed_payments',
    automation_level: 'L0',
  },

  'billing.query.refund_candidates': {
    intent_key: 'billing.query.refund_candidates',
    automation_level: 'L0',
  },

  'billing.query.kpi_summary': {
    intent_key: 'billing.query.kpi_summary',
    automation_level: 'L0',
  },

  'billing.query.unissued_invoices': {
    intent_key: 'billing.query.unissued_invoices',
    automation_level: 'L0',
  },

  'billing.query.partial_payments': {
    intent_key: 'billing.query.partial_payments',
    automation_level: 'L0',
  },

  'billing.query.export_statement': {
    intent_key: 'billing.query.export_statement',
    automation_level: 'L0',
  },

  'billing.task.flag_overdue_followup': {
    intent_key: 'billing.task.flag_overdue_followup',
    automation_level: 'L1',
  },

  'billing.task.prepare_invoice_batch': {
    intent_key: 'billing.task.prepare_invoice_batch',
    automation_level: 'L1',
  },

  'billing.task.prepare_refund_review': {
    intent_key: 'billing.task.prepare_refund_review',
    automation_level: 'L1',
  },

  'billing.task.prepare_payment_link_batch': {
    intent_key: 'billing.task.prepare_payment_link_batch',
    automation_level: 'L1',
  },

  'billing.task.flag_churn_risk_from_billing': {
    intent_key: 'billing.task.flag_churn_risk_from_billing',
    automation_level: 'L1',
  },

  'billing.exec.send_payment_link': {
    intent_key: 'billing.exec.send_payment_link',
    automation_level: 'L2',
    execution_class: 'A',
  },

  'billing.exec.schedule_overdue_notice': {
    intent_key: 'billing.exec.schedule_overdue_notice',
    automation_level: 'L2',
    execution_class: 'A',
  },

  'billing.exec.issue_invoices': {
    intent_key: 'billing.exec.issue_invoices',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'billing.exec.reissue_invoice': {
    intent_key: 'billing.exec.reissue_invoice',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'billing.exec.record_manual_payment': {
    intent_key: 'billing.exec.record_manual_payment',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'billing.exec.apply_discount': {
    intent_key: 'billing.exec.apply_discount',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'billing.exec.apply_refund': {
    intent_key: 'billing.exec.apply_refund',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'billing.exec.create_installment_plan': {
    intent_key: 'billing.exec.create_installment_plan',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'billing.exec.fix_duplicate_invoices': {
    intent_key: 'billing.exec.fix_duplicate_invoices',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'billing.exec.sync_gateway': {
    intent_key: 'billing.exec.sync_gateway',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'billing.exec.close_month': {
    intent_key: 'billing.exec.close_month',
    automation_level: 'L2',
    execution_class: 'B',
  },



  // 메시지/공지(Messaging) 도메인

  'message.query.sent_log': {
    intent_key: 'message.query.sent_log',
    automation_level: 'L0',
  },

  'message.query.failed_log': {
    intent_key: 'message.query.failed_log',
    automation_level: 'L0',
  },

  'message.draft.absence_notice': {
    intent_key: 'message.draft.absence_notice',
    automation_level: 'L0',
  },

  'message.draft.overdue_notice': {
    intent_key: 'message.draft.overdue_notice',
    automation_level: 'L0',
  },

  'message.draft.general_notice': {
    intent_key: 'message.draft.general_notice',
    automation_level: 'L0',
  },

  'message.preview.audience': {
    intent_key: 'message.preview.audience',
    automation_level: 'L0',
  },

  'message.preview.template_render': {
    intent_key: 'message.preview.template_render',
    automation_level: 'L0',
  },

  'message.draft.payment_link_notice': {
    intent_key: 'message.draft.payment_link_notice',
    automation_level: 'L0',
  },

  'message.query.variables_check': {
    intent_key: 'message.query.variables_check',
    automation_level: 'L0',
  },

  'message.task.prepare_bulk_send': {
    intent_key: 'message.task.prepare_bulk_send',
    automation_level: 'L1',
  },

  'message.task.test_send_request': {
    intent_key: 'message.task.test_send_request',
    automation_level: 'L1',
  },

  'message.exec.send_to_guardian': {
    intent_key: 'message.exec.send_to_guardian',
    automation_level: 'L2',
    execution_class: 'A',
  },

  'message.exec.send_bulk': {
    intent_key: 'message.exec.send_bulk',
    automation_level: 'L2',
    execution_class: 'A',
  },

  'message.exec.schedule_bulk': {
    intent_key: 'message.exec.schedule_bulk',
    automation_level: 'L2',
    execution_class: 'A',
  },

  'message.exec.resend_failed': {
    intent_key: 'message.exec.resend_failed',
    automation_level: 'L2',
    execution_class: 'A',
  },

  'message.exec.optout_respect_audit': {
    intent_key: 'message.exec.optout_respect_audit',
    automation_level: 'L2',
    execution_class: 'A',
  },

  'message.exec.staff_broadcast': {
    intent_key: 'message.exec.staff_broadcast',
    automation_level: 'L2',
    execution_class: 'A',
  },

  'message.exec.class_schedule_change_notice': {
    intent_key: 'message.exec.class_schedule_change_notice',
    automation_level: 'L2',
    execution_class: 'A',
  },

  'message.exec.emergency_notice': {
    intent_key: 'message.exec.emergency_notice',
    automation_level: 'L2',
    execution_class: 'A',
  },

  'message.exec.cancel_scheduled': {
    intent_key: 'message.exec.cancel_scheduled',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'message.exec.create_template': {
    intent_key: 'message.exec.create_template',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'message.exec.update_template': {
    intent_key: 'message.exec.update_template',
    automation_level: 'L2',
    execution_class: 'B',
  },



  // 학생 라이프사이클(Student) 도메인

  'student.query.profile': {
    intent_key: 'student.query.profile',
    automation_level: 'L0',
  },

  'student.query.status_list': {
    intent_key: 'student.query.status_list',
    automation_level: 'L0',
  },

  'student.query.missing_guardian_contact': {
    intent_key: 'student.query.missing_guardian_contact',
    automation_level: 'L0',
  },

  'student.query.duplicates_suspected': {
    intent_key: 'student.query.duplicates_suspected',
    automation_level: 'L0',
  },

  'student.query.onboarding_needed': {
    intent_key: 'student.query.onboarding_needed',
    automation_level: 'L0',
  },

  'student.query.data_quality_scan': {
    intent_key: 'student.query.data_quality_scan',
    automation_level: 'L0',
  },

  'student.task.register_prefill': {
    intent_key: 'student.task.register_prefill',
    automation_level: 'L1',
  },

  'student.task.collect_documents': {
    intent_key: 'student.task.collect_documents',
    automation_level: 'L1',
  },

  'student.exec.send_welcome_message': {
    intent_key: 'student.exec.send_welcome_message',
    automation_level: 'L2',
    execution_class: 'A',
  },

  'student.exec.request_documents_message': {
    intent_key: 'student.exec.request_documents_message',
    automation_level: 'L2',
    execution_class: 'A',
  },

  'student.exec.register': {
    intent_key: 'student.exec.register',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'student.exec.update_profile': {
    intent_key: 'student.exec.update_profile',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'student.exec.change_class': {
    intent_key: 'student.exec.change_class',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'student.exec.pause': {
    intent_key: 'student.exec.pause',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'student.exec.resume': {
    intent_key: 'student.exec.resume',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'student.exec.discharge': {
    intent_key: 'student.exec.discharge',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'student.exec.merge_duplicates': {
    intent_key: 'student.exec.merge_duplicates',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'student.exec.update_guardian_contact': {
    intent_key: 'student.exec.update_guardian_contact',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'student.exec.assign_tags': {
    intent_key: 'student.exec.assign_tags',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'student.exec.bulk_register': {
    intent_key: 'student.exec.bulk_register',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'student.exec.bulk_update': {
    intent_key: 'student.exec.bulk_update',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'student.exec.data_quality_apply_fix': {
    intent_key: 'student.exec.data_quality_apply_fix',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'student.exec.reactivate_from_discharged': {
    intent_key: 'student.exec.reactivate_from_discharged',
    automation_level: 'L2',
    execution_class: 'B',
  },



  // 반/수업/시간표(Class/Schedule) 도메인

  'class.query.list': {
    intent_key: 'class.query.list',
    automation_level: 'L0',
  },

  'class.query.roster': {
    intent_key: 'class.query.roster',
    automation_level: 'L0',
  },



  // 반/수업/시간표(Class/Schedule) 도메인

  'schedule.query.today': {
    intent_key: 'schedule.query.today',
    automation_level: 'L0',
  },

  'schedule.query.by_teacher': {
    intent_key: 'schedule.query.by_teacher',
    automation_level: 'L0',
  },

  'schedule.query.by_class': {
    intent_key: 'schedule.query.by_class',
    automation_level: 'L0',
  },

  'schedule.query.export_timetable': {
    intent_key: 'schedule.query.export_timetable',
    automation_level: 'L0',
  },

  'schedule.task.propose_makeup_session': {
    intent_key: 'schedule.task.propose_makeup_session',
    automation_level: 'L1',
  },

  'schedule.exec.notify_change': {
    intent_key: 'schedule.exec.notify_change',
    automation_level: 'L2',
    execution_class: 'A',
  },



  // 반/수업/시간표(Class/Schedule) 도메인

  'class.exec.create': {
    intent_key: 'class.exec.create',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'class.exec.update': {
    intent_key: 'class.exec.update',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'class.exec.close': {
    intent_key: 'class.exec.close',
    automation_level: 'L2',
    execution_class: 'B',
  },



  // 반/수업/시간표(Class/Schedule) 도메인

  'schedule.exec.add_session': {
    intent_key: 'schedule.exec.add_session',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'schedule.exec.move_session': {
    intent_key: 'schedule.exec.move_session',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'schedule.exec.cancel_session': {
    intent_key: 'schedule.exec.cancel_session',
    automation_level: 'L2',
    execution_class: 'B',
  },



  // 반/수업/시간표(Class/Schedule) 도메인

  'class.exec.bulk_reassign_teacher': {
    intent_key: 'class.exec.bulk_reassign_teacher',
    automation_level: 'L2',
    execution_class: 'B',
  },



  // 반/수업/시간표(Class/Schedule) 도메인

  'schedule.exec.bulk_shift': {
    intent_key: 'schedule.exec.bulk_shift',
    automation_level: 'L2',
    execution_class: 'B',
  },



  // 상담/학습/메모 + AI(Notes/AI) 도메인

  'note.query.by_student': {
    intent_key: 'note.query.by_student',
    automation_level: 'L0',
  },

  'note.draft.consult_summary': {
    intent_key: 'note.draft.consult_summary',
    automation_level: 'L0',
  },



  // 상담/학습/메모 + AI(Notes/AI) 도메인

  'ai.summarize.student_history': {
    intent_key: 'ai.summarize.student_history',
    automation_level: 'L0',
  },

  'ai.generate.followup_message': {
    intent_key: 'ai.generate.followup_message',
    automation_level: 'L0',
  },

  'ai.summarize.class_history': {
    intent_key: 'ai.summarize.class_history',
    automation_level: 'L0',
  },

  'ai.generate.counseling_agenda': {
    intent_key: 'ai.generate.counseling_agenda',
    automation_level: 'L0',
  },

  'ai.query.export_ai_briefing': {
    intent_key: 'ai.query.export_ai_briefing',
    automation_level: 'L0',
  },

  'ai.task.flag_risk_signals': {
    intent_key: 'ai.task.flag_risk_signals',
    automation_level: 'L1',
  },

  'ai.task.create_recommendations': {
    intent_key: 'ai.task.create_recommendations',
    automation_level: 'L1',
  },

  'ai.task.bulk_generate_taskcards': {
    intent_key: 'ai.task.bulk_generate_taskcards',
    automation_level: 'L1',
  },

  'ai.exec.request_staff_review': {
    intent_key: 'ai.exec.request_staff_review',
    automation_level: 'L2',
    execution_class: 'A',
  },

  'ai.exec.escalate_emergency': {
    intent_key: 'ai.exec.escalate_emergency',
    automation_level: 'L2',
    execution_class: 'A',
  },



  // 상담/학습/메모 + AI(Notes/AI) 도메인

  'note.exec.create': {
    intent_key: 'note.exec.create',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'note.exec.update': {
    intent_key: 'note.exec.update',
    automation_level: 'L2',
    execution_class: 'B',
  },



  // 리포트/대시보드(Reports) 도메인

  'report.query.dashboard_kpi': {
    intent_key: 'report.query.dashboard_kpi',
    automation_level: 'L0',
  },

  'report.query.attendance_summary': {
    intent_key: 'report.query.attendance_summary',
    automation_level: 'L0',
  },

  'report.query.billing_summary': {
    intent_key: 'report.query.billing_summary',
    automation_level: 'L0',
  },

  'report.query.export_dataset': {
    intent_key: 'report.query.export_dataset',
    automation_level: 'L0',
  },

  'report.query.health_snapshot': {
    intent_key: 'report.query.health_snapshot',
    automation_level: 'L0',
  },

  'report.task.prepare_monthly_report': {
    intent_key: 'report.task.prepare_monthly_report',
    automation_level: 'L1',
  },

  'report.exec.send_report': {
    intent_key: 'report.exec.send_report',
    automation_level: 'L2',
    execution_class: 'A',
  },

  'report.exec.schedule_monthly_report': {
    intent_key: 'report.exec.schedule_monthly_report',
    automation_level: 'L2',
    execution_class: 'A',
  },

  'report.exec.generate_monthly_report': {
    intent_key: 'report.exec.generate_monthly_report',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'report.exec.generate_daily_brief': {
    intent_key: 'report.exec.generate_daily_brief',
    automation_level: 'L2',
    execution_class: 'B',
  },



  // 정책/권한/시스템(System) 도메인

  'rbac.query.my_permissions': {
    intent_key: 'rbac.query.my_permissions',
    automation_level: 'L0',
  },



  // 정책/권한/시스템(System) 도메인

  'policy.query.automation_rules': {
    intent_key: 'policy.query.automation_rules',
    automation_level: 'L0',
  },



  // 정책/권한/시스템(System) 도메인

  'system.query.health': {
    intent_key: 'system.query.health',
    automation_level: 'L0',
  },



  // 정책/권한/시스템(System) 도메인

  'policy.exec.enable_automation': {
    intent_key: 'policy.exec.enable_automation',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'policy.exec.update_threshold': {
    intent_key: 'policy.exec.update_threshold',
    automation_level: 'L2',
    execution_class: 'B',
  },



  // 정책/권한/시스템(System) 도메인

  'rbac.exec.assign_role': {
    intent_key: 'rbac.exec.assign_role',
    automation_level: 'L2',
    execution_class: 'B',
  },



  // 정책/권한/시스템(System) 도메인

  'system.exec.run_healthcheck': {
    intent_key: 'system.exec.run_healthcheck',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'system.exec.rebuild_search_index': {
    intent_key: 'system.exec.rebuild_search_index',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'system.exec.backfill_reports': {
    intent_key: 'system.exec.backfill_reports',
    automation_level: 'L2',
    execution_class: 'B',
  },

  'system.exec.retry_failed_actions': {
    intent_key: 'system.exec.retry_failed_actions',
    automation_level: 'L2',
    execution_class: 'B',
  },
};

/**
 * Intent Registry 조회 함수
 */
export function getIntent(intent_key: string): IntentRegistryItem | undefined {
  return intentRegistry[intent_key];
}

/**
 * Intent 존재 여부 확인
 */
export function hasIntent(intent_key: string): boolean {
  return intent_key in intentRegistry;
}
