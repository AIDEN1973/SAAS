/**
 * Worker Process Job Edge Function [ARCHIVED - 2026-01-23]
 * 참조: docu/legacy/계약붕괴방지_Intent기반.md
 *
 * ⚠️ 현재 상태: 비활성화 (Cron job 중단됨)
 * - job_executions 테이블이 비어있어 실제로 사용되지 않음
 * - 프론트엔드는 execute-student-task를 직접 호출
 * - ChatOps는 Streaming 방식 사용
 *
 * 📌 재활성화 방법:
 * 1. Cron job 활성화: UPDATE cron.job SET active = true WHERE jobname = 'worker-process-job';
 * 2. 프론트엔드에서 job_executions 테이블에 INSERT
 * 3. 참조 문서: docu/JOB_QUEUE_ARCHITECTURE.md
 *
 * Worker 아키텍처: Apply 단계에서 생성된 job을 처리하는 Worker 프로세스
 * - pending 상태의 job을 running으로 변경하고 실행
 * - 재시도 정책 적용 (Fail-Closed)
 * - 부분 성공 처리
 * - Preflight 체크 (실행 전 상태 재확인)
 *
 * 엔드포인트:
 * - POST /functions/v1/worker-process-job (수동 실행)
 * - Cron으로 주기적 호출 (예: 1분마다)
 *
 * [최적화] Dynamic Import 적용
 * - 70개 이상의 handler를 한꺼번에 import하면 cold start timeout 발생
 * - 필요한 handler만 동적으로 import하여 503 에러 방지
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { envServer } from '../_shared/env-registry.ts';
import { withTenant } from '../_shared/withTenant.ts';
import { maskPII } from '../_shared/pii-utils.ts';
import type { HandlerContext, SuggestedActionChatOpsPlanV1, HandlerResult, IntentHandler } from '../execute-student-task/handlers/types.ts';
import { ContractErrorCategory } from '../execute-student-task/handlers/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

/**
 * Intent Key → Handler 파일 매핑
 * 동적 import를 위한 경로 매핑
 */
const handlerPathMap: Record<string, string> = {
  // 출결(Attendance) 도메인
  'attendance.exec.notify_guardians_late': './attendance-notify-guardians-late.ts',
  'attendance.exec.notify_guardians_absent': './attendance-notify-guardians-absent.ts',
  'attendance.exec.request_reason_message': './attendance-request-reason-message.ts',
  'attendance.exec.send_staff_summary': './attendance-send-staff-summary.ts',
  'attendance.exec.correct_record': './attendance-exec-correct_record.ts',
  'attendance.exec.mark_excused': './attendance-exec-mark_excused.ts',
  'attendance.exec.bulk_update': './attendance-exec-bulk_update.ts',
  'attendance.exec.schedule_recheck': './attendance-exec-schedule_recheck.ts',

  // 수납/청구(Billing) 도메인
  'billing.exec.send_payment_link': './billing-send-payment-link.ts',
  'billing.exec.send_overdue_notice_1st': './billing-send-overdue-notice-1st.ts',
  'billing.exec.send_overdue_notice_2nd': './billing-send-overdue-notice-2nd.ts',
  'billing.exec.schedule_overdue_notice': './billing-schedule-overdue-notice.ts',
  'billing.exec.issue_invoices': './billing-exec-issue_invoices.ts',
  'billing.exec.reissue_invoice': './billing-exec-reissue_invoice.ts',
  'billing.exec.record_manual_payment': './billing-exec-record_manual_payment.ts',
  'billing.exec.apply_discount': './billing-exec-apply_discount.ts',
  'billing.exec.apply_refund': './billing-exec-apply_refund.ts',
  'billing.exec.create_installment_plan': './billing-exec-create_installment_plan.ts',
  'billing.exec.fix_duplicate_invoices': './billing-exec-fix_duplicate_invoices.ts',
  'billing.exec.sync_gateway': './billing-exec-sync_gateway.ts',
  'billing.exec.close_month': './billing-exec-close_month.ts',

  // 메시지/공지(Messaging) 도메인
  'message.exec.send_to_guardian': './message-send-to-guardian.ts',
  'message.exec.send_bulk': './message-send-bulk.ts',
  'message.exec.schedule_bulk': './message-schedule-bulk.ts',
  'message.exec.resend_failed': './message-resend-failed.ts',
  'message.exec.optout_respect_audit': './message-optout-respect-audit.ts',
  'message.exec.staff_broadcast': './message-staff-broadcast.ts',
  'message.exec.class_schedule_change_notice': './message-class-schedule-change-notice.ts',
  'message.exec.emergency_notice': './message-emergency-notice.ts',
  'message.exec.cancel_scheduled': './message-exec-cancel_scheduled.ts',
  'message.exec.create_template': './message-exec-create_template.ts',
  'message.exec.update_template': './message-exec-update_template.ts',

  // 학생 라이프사이클(Student) 도메인
  'student.exec.send_welcome_message': './student-send-welcome-message.ts',
  'student.exec.request_documents_message': './student-request-documents-message.ts',
  'student.exec.register': './student-register.ts',
  'student.exec.update_profile': './student-exec-update_profile.ts',
  'student.exec.change_class': './student-exec-change_class.ts',
  'student.exec.pause': './student-exec-pause.ts',
  'student.exec.resume': './student-exec-resume.ts',
  'student.exec.discharge': './student-exec-discharge.ts',
  'student.exec.merge_duplicates': './student-exec-merge_duplicates.ts',
  'student.exec.update_guardian_contact': './student-exec-update_guardian_contact.ts',
  'student.exec.assign_tags': './student-exec-assign_tags.ts',
  'student.exec.bulk_register': './student-exec-bulk_register.ts',
  'student.exec.bulk_update': './student-exec-bulk_update.ts',
  'student.exec.data_quality_apply_fix': './student-exec-data_quality_apply_fix.ts',
  'student.exec.reactivate_from_discharged': './student-exec-reactivate_from_discharged.ts',

  // 반/수업/시간표(Class) 도메인
  'schedule.exec.notify_change': './schedule-notify-change.ts',
  'class.exec.create': './class-exec-create.ts',
  'class.exec.update': './class-exec-update.ts',
  'class.exec.close': './class-exec-close.ts',
  'class.exec.bulk_reassign_teacher': './class-exec-bulk_reassign_teacher.ts',
  'schedule.exec.add_session': './schedule-exec-add_session.ts',
  'schedule.exec.move_session': './schedule-exec-move_session.ts',
  'schedule.exec.cancel_session': './schedule-exec-cancel_session.ts',
  'schedule.exec.bulk_shift': './schedule-exec-bulk_shift.ts',

  // 상담/학습/메모 + AI(Notes/AI) 도메인
  'ai.exec.request_staff_review': './ai-request-staff-review.ts',
  'ai.exec.escalate_emergency': './ai-escalate-emergency.ts',
  'note.exec.create': './note-exec-create.ts',
  'note.exec.update': './note-exec-update.ts',

  // 리포트/대시보드(Reports) 도메인
  'report.exec.send_report': './report-send-report.ts',
  'report.exec.schedule_monthly_report': './report-schedule-monthly-report.ts',
  'report.exec.generate_monthly_report': './report-exec-generate_monthly_report.ts',
  'report.exec.generate_daily_brief': './report-exec-generate_daily_brief.ts',

  // Policy 도메인
  'policy.exec.enable_automation': './policy-exec-enable_automation.ts',
  'policy.exec.update_threshold': './policy-exec-update_threshold.ts',
  'rbac.exec.assign_role': './rbac-exec-assign_role.ts',

  // System 도메인
  'system.exec.run_healthcheck': './system-exec-run_healthcheck.ts',
  'system.exec.rebuild_search_index': './system-exec-rebuild_search_index.ts',
  'system.exec.backfill_reports': './system-exec-backfill_reports.ts',
  'system.exec.retry_failed_actions': './system-exec-retry_failed_actions.ts',

  // SMS 도메인
  'sms.exec.send_aligo': './sms-send-aligo.ts',
};

/**
 * Handler 동적 로드
 * [최적화] 필요한 handler만 로드하여 cold start 시간 단축
 */
async function loadHandler(intentKey: string): Promise<IntentHandler | null> {
  const handlerPath = handlerPathMap[intentKey];
  if (!handlerPath) {
    return null;
  }

  try {
    const modulePath = `../execute-student-task/handlers/${handlerPath.replace('./', '')}`;
    const module = await import(modulePath);

    // handler export 이름 추론 (파일명 → camelCase + Handler)
    // 예: attendance-notify-guardians-late.ts → attendanceNotifyGuardiansLateHandler
    const fileName = handlerPath.replace('./', '').replace('.ts', '');
    const handlerName = fileName
      .split('-')
      .map((part, i) => i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))
      .join('') + 'Handler';

    // 언더스코어 버전도 시도 (예: attendance_exec_correct_recordHandler)
    const underscoreHandlerName = fileName.replace(/-/g, '_') + 'Handler';

    const handler = module[handlerName] || module[underscoreHandlerName] || module.default;

    if (!handler) {
      console.error(`[worker-process-job] Handler not found in module: ${handlerName} or ${underscoreHandlerName}`);
      return null;
    }

    return handler as IntentHandler;
  } catch (error) {
    console.error(`[worker-process-job] Failed to load handler for ${intentKey}:`, maskPII(error));
    return null;
  }
}

/**
 * Handler 존재 여부 확인
 */
function hasHandler(intentKey: string): boolean {
  return intentKey in handlerPathMap;
}

/**
 * Preflight 체크: 실행 전 상태 재확인
 * ChatOps_계약_붕괴_방지_체계_분석.md 4.7.1 참조
 */
async function preflightCheck(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  plan: SuggestedActionChatOpsPlanV1
): Promise<{ passed: boolean; error?: string; errorCode?: string }> {
  if (plan.plan_snapshot?.targets?.kind === 'student_id_list' && plan.plan_snapshot.targets.student_ids?.length > 0) {
    const { data: currentState, error: preflightError } = await withTenant(
      supabase
        .from('persons')
        .select('id, person_type, status')
        .in('id', plan.plan_snapshot.targets.student_ids)
        .eq('person_type', 'student'),
      tenantId
    );

    if (preflightError) {
      return {
        passed: false,
        error: 'Preflight query failed',
        errorCode: 'CONTRACT_PREFLIGHT_FAILED',
      };
    }

    // 상태 변화 감지 (이미 퇴원한 학생 등)
    const dischargedStudents = currentState?.filter((s: { status: string }) => s.status === 'discharged');
    if (dischargedStudents && dischargedStudents.length > 0) {
      // 이미 퇴원한 학생은 성공으로 처리 (이미 처리된 것으로 간주)
      return {
        passed: true, // 성공으로 처리
      };
    }

    // 존재하지 않는 학생 감지
    const foundIds = new Set(currentState?.map((s: { id: string }) => s.id) || []);
    const missingIds = plan.plan_snapshot.targets.student_ids.filter(
      (id: string) => !foundIds.has(id)
    );
    if (missingIds.length > 0) {
      return {
        passed: false,
        error: `존재하지 않는 학생이 포함되어 있습니다: ${missingIds.length}명`,
        errorCode: 'CONTRACT_TARGET_NOT_FOUND',
      };
    }
  }

  return { passed: true };
}

/**
 * Job 처리 (단일 job 실행)
 */
async function processJob(
  supabase: ReturnType<typeof createClient>,
  job: {
    id: string;
    tenant_id: string;
    intent_key: string;
    automation_level: string | null;
    status: string;
    idempotency_key: string;
    payload: {
      plan: SuggestedActionChatOpsPlanV1;
      user_context: { user_id: string; user_role?: string };
    };
    retry_count: number;
    max_retries: number;
    execution_context: unknown;
  }
): Promise<{ success: boolean; result?: HandlerResult; error?: string }> {
  try {
    // 1. 상태를 running으로 변경
    const { error: updateError } = await withTenant(
      supabase
        .from('job_executions')
        .update({
          status: 'running',
          started_at: new Date().toISOString(),
        })
        .eq('id', job.id),
      job.tenant_id
    );

    if (updateError) {
      console.error('[worker-process-job] Failed to update job status:', maskPII(updateError));
      return { success: false, error: 'Failed to update job status' };
    }

    // 2. payload에서 plan 복원
    const plan: SuggestedActionChatOpsPlanV1 = job.payload.plan;
    const userContext = job.payload.user_context; // { user_id, user_role }

    // 3. Preflight 체크
    const preflight = await preflightCheck(supabase, job.tenant_id, plan);
    if (!preflight.passed) {
      // Preflight 실패 시 실패로 처리
      const errorResult: HandlerResult = {
        status: 'failed',
        error_code: preflight.errorCode || 'CONTRACT_PREFLIGHT_FAILED',
        message: preflight.error || 'Preflight check failed',
        contract_category: ContractErrorCategory.CONTRACT_STATE_CHANGED,
      };

      await withTenant(
        supabase
          .from('job_executions')
          .update({
            status: 'failed',
            result: errorResult,
            error_message: preflight.error,
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id),
        job.tenant_id
      );

      return { success: false, result: errorResult, error: preflight.error };
    }

    // 4. Handler 존재 확인
    if (!hasHandler(plan.intent_key)) {
      const errorResult: HandlerResult = {
        status: 'failed',
        error_code: 'HANDLER_NOT_FOUND',
        message: `Handler not found for ${plan.intent_key}`,
      };

      await withTenant(
        supabase
          .from('job_executions')
          .update({
            status: 'failed',
            result: errorResult,
            error_message: errorResult.message,
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id),
        job.tenant_id
      );

      return { success: false, result: errorResult, error: errorResult.message };
    }

    // 5. Handler 동적 로드
    const handler = await loadHandler(plan.intent_key);
    if (!handler) {
      const errorResult: HandlerResult = {
        status: 'failed',
        error_code: 'HANDLER_LOAD_FAILED',
        message: `Failed to load handler for ${plan.intent_key}`,
      };

      await withTenant(
        supabase
          .from('job_executions')
          .update({
            status: 'failed',
            result: errorResult,
            error_message: errorResult.message,
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id),
        job.tenant_id
      );

      return { success: false, result: errorResult, error: errorResult.message };
    }

    // 6. Handler Context 생성
    const handlerContext: HandlerContext = {
      tenant_id: job.tenant_id,
      user_id: userContext.user_id,
      user_role: userContext.user_role || 'admin',
      now_kst: new Date().toISOString(),
      supabase: supabase,
    };

    // 7. Handler 실행
    const handlerResult = await handler.execute(plan, handlerContext);

    // 8. 결과 저장
    const finalStatus = handlerResult.status === 'partial' ? 'partial' :
                       handlerResult.status === 'success' ? 'success' : 'failed';

    await withTenant(
      supabase
        .from('job_executions')
        .update({
          status: finalStatus,
          result: handlerResult,
          completed_at: new Date().toISOString(),
          ...(handlerResult.message && { error_message: handlerResult.message }),
        })
        .eq('id', job.id),
      job.tenant_id
    );

    return { success: true, result: handlerResult };
  } catch (error) {
    const maskedError = maskPII(error);
    console.error('[worker-process-job] Job processing error:', maskedError);

    // 재시도 가능 여부 확인
    const shouldRetry = job.retry_count < job.max_retries;
    const errorResult: HandlerResult = {
      status: 'failed',
      error_code: 'EXECUTION_ERROR',
      message: error instanceof Error ? error.message : 'Execution failed',
    };

    if (shouldRetry) {
      // 재시도 가능: pending으로 변경 (다음 실행 시 재시도)
      await withTenant(
        supabase
          .from('job_executions')
          .update({
            status: 'pending',
            retry_count: job.retry_count + 1,
            error_message: errorResult.message,
          })
          .eq('id', job.id),
        job.tenant_id
      );
    } else {
      // 재시도 불가: failed로 변경
      await withTenant(
        supabase
          .from('job_executions')
          .update({
            status: 'failed',
            result: errorResult,
            error_message: errorResult.message,
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id),
        job.tenant_id
      );
    }

    return { success: false, result: errorResult, error: errorResult.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(envServer.SUPABASE_URL, envServer.SERVICE_ROLE_KEY);

    // 1. pending 상태의 job 조회 (최대 10개, 오래된 것부터)
    const { data: pendingJobs, error: fetchError } = await supabase
      .from('job_executions')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error('[worker-process-job] Failed to fetch pending jobs:', maskPII(fetchError));
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pending jobs', details: maskPII(fetchError) }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending jobs', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. 각 job 처리
    const results = [];
    for (const job of pendingJobs) {
      const result = await processJob(supabase, job);
      results.push({
        job_id: job.id,
        intent_key: job.intent_key,
        success: result.success,
        status: result.result?.status || 'failed',
      });
    }

    return new Response(
      JSON.stringify({
        message: 'Jobs processed',
        processed: results.length,
        results: results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const maskedError = maskPII(error);
    console.error('[worker-process-job] Fatal error:', maskedError);
    return new Response(
      JSON.stringify({ error: 'Fatal error', details: maskedError }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
