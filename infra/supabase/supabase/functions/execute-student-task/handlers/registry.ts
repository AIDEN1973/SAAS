// LAYER: EDGE_FUNCTION_SHARED
/**
 * Handler Registry
 * 챗봇.md 12.1 참조
 *
 * [불변 규칙] intent_key → Handler 매핑
 * [불변 규칙] Handler Registry에 등록되지 않은 Intent는 실행 불가 (Fail-Closed)
 * [불변 규칙] 모든 Handler는 Handler Contract를 준수해야 함
 */

import type { IntentHandler } from './types.ts';
import { attendanceNotifyGuardiansLateHandler } from './attendance-notify-guardians-late.ts';
import { attendanceNotifyGuardiansAbsentHandler } from './attendance-notify-guardians-absent.ts';
import { attendanceRequestReasonMessageHandler } from './attendance-request-reason-message.ts';
import { attendanceSendStaffSummaryHandler } from './attendance-send-staff-summary.ts';
import { billingSendPaymentLinkHandler } from './billing-send-payment-link.ts';
import { billingSendOverdueNotice1stHandler } from './billing-send-overdue-notice-1st.ts';
import { billingSendOverdueNotice2ndHandler } from './billing-send-overdue-notice-2nd.ts';
import { billingScheduleOverdueNoticeHandler } from './billing-schedule-overdue-notice.ts';
import { messageSendToGuardianHandler } from './message-send-to-guardian.ts';
import { messageSendBulkHandler } from './message-send-bulk.ts';
import { messageScheduleBulkHandler } from './message-schedule-bulk.ts';
import { messageResendFailedHandler } from './message-resend-failed.ts';
import { messageOptoutRespectAuditHandler } from './message-optout-respect-audit.ts';
import { messageStaffBroadcastHandler } from './message-staff-broadcast.ts';
import { messageClassScheduleChangeNoticeHandler } from './message-class-schedule-change-notice.ts';
import { messageEmergencyNoticeHandler } from './message-emergency-notice.ts';
import { studentSendWelcomeMessageHandler } from './student-send-welcome-message.ts';
import { studentRequestDocumentsMessageHandler } from './student-request-documents-message.ts';
import { studentRegisterHandler } from './student-register.ts';
import { scheduleNotifyChangeHandler } from './schedule-notify-change.ts';
import { aiRequestStaffReviewHandler } from './ai-request-staff-review.ts';
import { aiEscalateEmergencyHandler } from './ai-escalate-emergency.ts';
import { reportSendReportHandler } from './report-send-report.ts';
import { reportScheduleMonthlyReportHandler } from './report-schedule-monthly-report.ts';
// Attendance 도메인 - L2-B
import { attendance_exec_correct_recordHandler } from './attendance-exec-correct_record.ts';
import { attendance_exec_mark_excusedHandler } from './attendance-exec-mark_excused.ts';
import { attendance_exec_bulk_updateHandler } from './attendance-exec-bulk_update.ts';
import { attendance_exec_schedule_recheckHandler } from './attendance-exec-schedule_recheck.ts';
// Billing 도메인 - L2-B
import { billing_exec_issue_invoicesHandler } from './billing-exec-issue_invoices.ts';
import { billing_exec_reissue_invoiceHandler } from './billing-exec-reissue_invoice.ts';
import { billing_exec_record_manual_paymentHandler } from './billing-exec-record_manual_payment.ts';
import { billing_exec_apply_discountHandler } from './billing-exec-apply_discount.ts';
import { billing_exec_apply_refundHandler } from './billing-exec-apply_refund.ts';
import { billing_exec_create_installment_planHandler } from './billing-exec-create_installment_plan.ts';
import { billing_exec_fix_duplicate_invoicesHandler } from './billing-exec-fix_duplicate_invoices.ts';
import { billing_exec_sync_gatewayHandler } from './billing-exec-sync_gateway.ts';
import { billing_exec_close_monthHandler } from './billing-exec-close_month.ts';
// Message 도메인 - L2-B
import { message_exec_cancel_scheduledHandler } from './message-exec-cancel_scheduled.ts';
import { message_exec_create_templateHandler } from './message-exec-create_template.ts';
import { message_exec_update_templateHandler } from './message-exec-update_template.ts';
// Student 도메인 - L2-B
import { student_exec_update_profileHandler } from './student-exec-update_profile.ts';
import { student_exec_change_classHandler } from './student-exec-change_class.ts';
import { student_exec_pauseHandler } from './student-exec-pause.ts';
import { student_exec_resumeHandler } from './student-exec-resume.ts';
import { student_exec_dischargeHandler } from './student-exec-discharge.ts';
import { student_exec_merge_duplicatesHandler } from './student-exec-merge_duplicates.ts';
import { student_exec_update_guardian_contactHandler } from './student-exec-update_guardian_contact.ts';
import { student_exec_assign_tagsHandler } from './student-exec-assign_tags.ts';
import { student_exec_bulk_registerHandler } from './student-exec-bulk_register.ts';
import { student_exec_bulk_updateHandler } from './student-exec-bulk_update.ts';
import { student_exec_data_quality_apply_fixHandler } from './student-exec-data_quality_apply_fix.ts';
import { student_exec_reactivate_from_dischargedHandler } from './student-exec-reactivate_from_discharged.ts';
// Class 도메인 - L2-B
import { class_exec_createHandler } from './class-exec-create.ts';
import { class_exec_updateHandler } from './class-exec-update.ts';
import { class_exec_closeHandler } from './class-exec-close.ts';
import { class_exec_bulk_reassign_teacherHandler } from './class-exec-bulk_reassign_teacher.ts';
// Schedule 도메인 - L2-B
import { schedule_exec_add_sessionHandler } from './schedule-exec-add_session.ts';
import { schedule_exec_move_sessionHandler } from './schedule-exec-move_session.ts';
import { schedule_exec_cancel_sessionHandler } from './schedule-exec-cancel_session.ts';
import { schedule_exec_bulk_shiftHandler } from './schedule-exec-bulk_shift.ts';
// Note 도메인 - L2-B
import { note_exec_createHandler } from './note-exec-create.ts';
import { note_exec_updateHandler } from './note-exec-update.ts';
// Report 도메인 - L2-B
import { report_exec_generate_monthly_reportHandler } from './report-exec-generate_monthly_report.ts';
import { report_exec_generate_daily_briefHandler } from './report-exec-generate_daily_brief.ts';
// Policy 도메인 - L2-B
import { policy_exec_enable_automationHandler } from './policy-exec-enable_automation.ts';
import { policy_exec_update_thresholdHandler } from './policy-exec-update_threshold.ts';
import { rbac_exec_assign_roleHandler } from './rbac-exec-assign_role.ts';
// System 도메인 - L2-B
import { system_exec_run_healthcheckHandler } from './system-exec-run_healthcheck.ts';
import { system_exec_rebuild_search_indexHandler } from './system-exec-rebuild_search_index.ts';
import { system_exec_backfill_reportsHandler } from './system-exec-backfill_reports.ts';
import { system_exec_retry_failed_actionsHandler } from './system-exec-retry_failed_actions.ts';

/**
 * Handler Registry (intent_key → Handler 매핑)
 *
 * 새 Intent 추가 시: Handler 구현 후 여기에 등록
 */
export const handlerRegistry: Record<string, IntentHandler> = {
  // 출결(Attendance) 도메인
  'attendance.exec.notify_guardians_late': attendanceNotifyGuardiansLateHandler,
  'attendance.exec.notify_guardians_absent': attendanceNotifyGuardiansAbsentHandler,
  'attendance.exec.request_reason_message': attendanceRequestReasonMessageHandler,
  'attendance.exec.send_staff_summary': attendanceSendStaffSummaryHandler,
  'attendance.exec.correct_record': attendance_exec_correct_recordHandler,
  'attendance.exec.mark_excused': attendance_exec_mark_excusedHandler,
  'attendance.exec.bulk_update': attendance_exec_bulk_updateHandler,
  'attendance.exec.schedule_recheck': attendance_exec_schedule_recheckHandler,

  // 수납/청구(Billing) 도메인
  'billing.exec.send_payment_link': billingSendPaymentLinkHandler,
  'billing.exec.send_overdue_notice_1st': billingSendOverdueNotice1stHandler,
  'billing.exec.send_overdue_notice_2nd': billingSendOverdueNotice2ndHandler,
  'billing.exec.schedule_overdue_notice': billingScheduleOverdueNoticeHandler,
  'billing.exec.issue_invoices': billing_exec_issue_invoicesHandler,
  'billing.exec.reissue_invoice': billing_exec_reissue_invoiceHandler,
  'billing.exec.record_manual_payment': billing_exec_record_manual_paymentHandler,
  'billing.exec.apply_discount': billing_exec_apply_discountHandler,
  'billing.exec.apply_refund': billing_exec_apply_refundHandler,
  'billing.exec.create_installment_plan': billing_exec_create_installment_planHandler,
  'billing.exec.fix_duplicate_invoices': billing_exec_fix_duplicate_invoicesHandler,
  'billing.exec.sync_gateway': billing_exec_sync_gatewayHandler,
  'billing.exec.close_month': billing_exec_close_monthHandler,

  // 메시지/공지(Messaging) 도메인
  'message.exec.send_to_guardian': messageSendToGuardianHandler,
  'message.exec.send_bulk': messageSendBulkHandler,
  'message.exec.schedule_bulk': messageScheduleBulkHandler,
  'message.exec.resend_failed': messageResendFailedHandler,
  'message.exec.optout_respect_audit': messageOptoutRespectAuditHandler,
  'message.exec.staff_broadcast': messageStaffBroadcastHandler,
  'message.exec.class_schedule_change_notice': messageClassScheduleChangeNoticeHandler,
  'message.exec.emergency_notice': messageEmergencyNoticeHandler,
  'message.exec.cancel_scheduled': message_exec_cancel_scheduledHandler,
  'message.exec.create_template': message_exec_create_templateHandler,
  'message.exec.update_template': message_exec_update_templateHandler,

  // 학생 라이프사이클(Student) 도메인
  'student.exec.send_welcome_message': studentSendWelcomeMessageHandler,
  'student.exec.request_documents_message': studentRequestDocumentsMessageHandler,
  'student.exec.register': studentRegisterHandler,
  'student.exec.update_profile': student_exec_update_profileHandler,
  'student.exec.change_class': student_exec_change_classHandler,
  'student.exec.pause': student_exec_pauseHandler,
  'student.exec.resume': student_exec_resumeHandler,
  'student.exec.discharge': student_exec_dischargeHandler,
  'student.exec.merge_duplicates': student_exec_merge_duplicatesHandler,
  'student.exec.update_guardian_contact': student_exec_update_guardian_contactHandler,
  'student.exec.assign_tags': student_exec_assign_tagsHandler,
  'student.exec.bulk_register': student_exec_bulk_registerHandler,
  'student.exec.bulk_update': student_exec_bulk_updateHandler,
  'student.exec.data_quality_apply_fix': student_exec_data_quality_apply_fixHandler,
  'student.exec.reactivate_from_discharged': student_exec_reactivate_from_dischargedHandler,

  // 반/수업/시간표(Class) 도메인
  'schedule.exec.notify_change': scheduleNotifyChangeHandler,
  'class.exec.create': class_exec_createHandler,
  'class.exec.update': class_exec_updateHandler,
  'class.exec.close': class_exec_closeHandler,
  'class.exec.bulk_reassign_teacher': class_exec_bulk_reassign_teacherHandler,
  'schedule.exec.add_session': schedule_exec_add_sessionHandler,
  'schedule.exec.move_session': schedule_exec_move_sessionHandler,
  'schedule.exec.cancel_session': schedule_exec_cancel_sessionHandler,
  'schedule.exec.bulk_shift': schedule_exec_bulk_shiftHandler,

  // 상담/학습/메모 + AI(Notes/AI) 도메인
  'ai.exec.request_staff_review': aiRequestStaffReviewHandler,
  'ai.exec.escalate_emergency': aiEscalateEmergencyHandler,
  'note.exec.create': note_exec_createHandler,
  'note.exec.update': note_exec_updateHandler,

  // 리포트/대시보드(Reports) 도메인
  'report.exec.send_report': reportSendReportHandler,
  'report.exec.schedule_monthly_report': reportScheduleMonthlyReportHandler,
  'report.exec.generate_monthly_report': report_exec_generate_monthly_reportHandler,
  'report.exec.generate_daily_brief': report_exec_generate_daily_briefHandler,
  // Policy 도메인
  'policy.exec.enable_automation': policy_exec_enable_automationHandler,
  'policy.exec.update_threshold': policy_exec_update_thresholdHandler,
  'rbac.exec.assign_role': rbac_exec_assign_roleHandler,
  // System 도메인
  'system.exec.run_healthcheck': system_exec_run_healthcheckHandler,
  'system.exec.rebuild_search_index': system_exec_rebuild_search_indexHandler,
  'system.exec.backfill_reports': system_exec_backfill_reportsHandler,
  'system.exec.retry_failed_actions': system_exec_retry_failed_actionsHandler,
};

/**
 * Handler 조회 함수
 */
export function getHandler(intent_key: string): IntentHandler | undefined {
  return handlerRegistry[intent_key];
}

/**
 * Handler 존재 여부 확인
 */
export function hasHandler(intent_key: string): boolean {
  return intent_key in handlerRegistry;
}

