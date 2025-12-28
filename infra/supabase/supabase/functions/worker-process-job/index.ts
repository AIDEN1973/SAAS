/**
 * Worker Process Job Edge Function
 * ChatOps_계약_붕괴_방지_체계_분석.md 4.7 참조
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
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { envServer } from '../_shared/env-registry.ts';
import { withTenant } from '../_shared/withTenant.ts';
import { maskPII } from '../_shared/pii-utils.ts';
import { getHandler, hasHandler } from '../execute-student-task/handlers/registry.ts';
import type { HandlerContext, SuggestedActionChatOpsPlanV1, HandlerResult } from '../execute-student-task/handlers/types.ts';
import { ContractErrorCategory } from '../execute-student-task/handlers/types.ts';
import { getTenantSettingByPath } from '../_shared/policy-utils.ts';
import { assertAutomationEventType } from '../_shared/automation-event-catalog.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

/**
 * idempotency_key 생성
 * ChatOps_계약_붕괴_방지_체계_분석.md 4.5.2 참조
 */
async function generateIdempotencyKey(
  tenantId: string,
  intentKey: string,
  entityIds: string[],
  actionType: string,
  effectiveDate?: string
): Promise<string> {
  const sortedEntityIds = [...entityIds].sort().join(',');
  const keyParts = [
    tenantId,
    intentKey,
    sortedEntityIds,
    actionType,
    effectiveDate || new Date().toISOString().split('T')[0], // YYYY-MM-DD
  ];
  const keyRaw = keyParts.join(':');

  // SHA-256 해시 생성
  const encoder = new TextEncoder();
  const data = encoder.encode(keyRaw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return `job:${hashHex.substring(0, 64)}`;
}

/**
 * Preflight 체크: 실행 전 상태 재확인
 * ChatOps_계약_붕괴_방지_체계_분석.md 4.7.1 참조
 */
async function preflightCheck(
  supabase: any,
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
    const dischargedStudents = currentState?.filter(s => s.status === 'discharged');
    if (dischargedStudents && dischargedStudents.length > 0) {
      // 이미 퇴원한 학생은 성공으로 처리 (이미 처리된 것으로 간주)
      return {
        passed: true, // 성공으로 처리
      };
    }

    // 존재하지 않는 학생 감지
    const foundIds = new Set(currentState?.map(s => s.id) || []);
    const missingIds = plan.plan_snapshot.targets.student_ids.filter(
      id => !foundIds.has(id)
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
  supabase: any,
  job: {
    id: string;
    tenant_id: string;
    intent_key: string;
    automation_level: string | null;
    status: string;
    idempotency_key: string;
    payload: any;
    retry_count: number;
    max_retries: number;
    execution_context: any;
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

    // 4. Handler 실행
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

    const handler = getHandler(plan.intent_key);
    if (!handler) {
      const errorResult: HandlerResult = {
        status: 'failed',
        error_code: 'HANDLER_NOT_REGISTERED',
        message: `Handler not registered for ${plan.intent_key}`,
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

    // 5. Handler Context 생성
    const handlerContext: HandlerContext = {
      tenant_id: job.tenant_id,
      user_id: userContext.user_id,
      user_role: userContext.user_role || 'admin',
      now_kst: new Date().toISOString(),
      supabase: supabase,
    };

    // 6. Handler 실행
    const handlerResult = await handler.execute(plan, handlerContext);

    // 7. 결과 저장
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

