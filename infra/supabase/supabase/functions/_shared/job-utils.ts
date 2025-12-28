/**
 * Job 생성 및 관리 유틸리티
 * ChatOps_계약_붕괴_방지_체계_분석.md 4.5 참조
 *
 * Worker 아키텍처를 위한 job 생성 헬퍼 함수
 */

import type { SuggestedActionChatOpsPlanV1 } from '../execute-student-task/handlers/types.ts';

/**
 * Worker가 필요한 작업인지 판단
 * ChatOps_계약_붕괴_방지_체계_분석.md 4.3 참조
 */
export function shouldUseWorker(plan: SuggestedActionChatOpsPlanV1): boolean {
  const intentKey = plan.intent_key;

  // 1. 외부 사이드이펙트: 문자/알림/이메일 발송
  if (intentKey.startsWith('message.') || intentKey.includes('send') || intentKey.includes('notification')) {
    return true;
  }

  // 2. 다수 대상 처리: 여러 학생 일괄 처리
  const targetCount = plan.plan_snapshot?.target_count || 0;
  if (targetCount > 1) {
    return true;
  }

  // 3. 실패/재시도 가능성 존재: 외부 API 호출이 필요한 작업
  if (intentKey.includes('payment') || intentKey.includes('billing') || intentKey.includes('external')) {
    return true;
  }

  // 4. 멱등성이 필요한 작업: 모든 L2-A 작업은 기본적으로 Worker 사용
  if (plan.automation_level === 'L2' && plan.execution_class === 'A') {
    return true;
  }

  // 기본값: L2-A는 Worker 사용, 나머지는 즉시 실행
  return false;
}

/**
 * idempotency_key 생성
 * ChatOps_계약_붕괴_방지_체계_분석.md 4.5.2 참조
 */
export async function generateJobIdempotencyKey(
  tenantId: string,
  intentKey: string,
  plan: SuggestedActionChatOpsPlanV1,
  actionType: string = 'execute'
): Promise<string> {
  // entity_ids 추출 (student_ids)
  const entityIds = plan.plan_snapshot?.targets?.student_ids || [];
  const sortedEntityIds = [...entityIds].sort().join(',');

  // effective_date 추출 (params에서 date 또는 security.requested_at_utc 사용)
  let effectiveDate = plan.security?.requested_at_utc?.split('T')[0];
  if (!effectiveDate && plan.params && typeof plan.params === 'object') {
    const params = plan.params as Record<string, unknown>;
    if (params.date && typeof params.date === 'string') {
      effectiveDate = params.date.split('T')[0];
    }
  }
  if (!effectiveDate) {
    effectiveDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  }

  // idempotency_key 생성
  const keyParts = [
    tenantId,
    intentKey,
    sortedEntityIds,
    actionType,
    effectiveDate,
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
 * Worker Edge Function 즉시 호출 (비동기)
 * job 생성 후 즉시 Worker를 트리거하여 지연 없이 실행
 */
async function triggerWorkerImmediately(supabaseUrl: string, serviceRoleKey: string): Promise<void> {
  try {
    // Worker Edge Function을 비동기로 호출 (응답을 기다리지 않음)
    const workerUrl = `${supabaseUrl}/functions/v1/worker-process-job`;

    // fetch를 사용하여 비동기 호출 (await 없이 fire-and-forget)
    fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
    }).catch((error) => {
      // 에러는 로그만 남기고 무시 (Worker는 Cron으로도 실행되므로)
      console.error('[triggerWorkerImmediately] Failed to trigger worker:', error);
    });
  } catch (error) {
    // 에러는 로그만 남기고 무시
    console.error('[triggerWorkerImmediately] Error:', error);
  }
}

/**
 * Job 생성
 * ChatOps_계약_붕괴_방지_체계_분석.md 4.5.3 참조
 *
 * ⚠️ 중요: job 생성 후 즉시 Worker를 호출하여 지연 없이 실행
 * - 사용자 요청에 즉시 응답 (지연 없음)
 * - Worker는 비동기로 실행되므로 사용자 응답은 즉시 반환
 * - Cron은 실패한 job 재시도용으로만 사용
 */
export async function createJob(
  supabase: any,
  tenantId: string,
  plan: SuggestedActionChatOpsPlanV1,
  userContext: { user_id: string; user_role: string },
  executionContext: {
    resolve_snapshot?: any;
    apply_input?: any;
    policy_verdict?: any;
  },
  options?: {
    supabaseUrl?: string;
    serviceRoleKey?: string;
  }
): Promise<{ job_id: string; idempotency_key: string } | null> {
  try {
    // idempotency_key 생성
    const idempotencyKey = await generateJobIdempotencyKey(tenantId, plan.intent_key, plan);

    // payload 생성 (PII 제외, UUID만 포함)
    const payload = {
      plan: plan,
      user_context: userContext,
    };

    // execution_context 생성
    const jobExecutionContext = {
      resolve_snapshot: executionContext.resolve_snapshot || null,
      apply_input: executionContext.apply_input || null,
      policy_verdict: executionContext.policy_verdict || null,
    };

    // job 생성
    const { data: job, error: jobError } = await supabase
      .from('job_executions')
      .insert({
        tenant_id: tenantId,
        intent_key: plan.intent_key,
        automation_level: plan.automation_level,
        status: 'pending',
        idempotency_key: idempotencyKey,
        payload: payload,
        execution_context: jobExecutionContext,
        retry_count: 0,
        max_retries: 3,
      })
      .select('id, idempotency_key')
      .single();

    if (jobError) {
      // 중복 키 오류인 경우 기존 job 조회
      if (jobError.code === '23505') { // unique_violation
        const { data: existingJob } = await supabase
          .from('job_executions')
          .select('id, idempotency_key, status')
          .eq('idempotency_key', idempotencyKey)
          .single();

        if (existingJob) {
          // 기존 job이 있으면 Worker 즉시 호출 (이미 실행 중일 수 있지만 안전하게)
          if (options?.supabaseUrl && options?.serviceRoleKey) {
            triggerWorkerImmediately(options.supabaseUrl, options.serviceRoleKey);
          }
          return {
            job_id: existingJob.id,
            idempotency_key: existingJob.idempotency_key,
          };
        }
      }

      console.error('[createJob] Failed to create job:', jobError);
      return null;
    }

    // ⚠️ 중요: job 생성 후 즉시 Worker 호출 (비동기, 응답 대기 안 함)
    // 사용자 요청에 즉시 응답하고, Worker는 백그라운드에서 실행
    if (options?.supabaseUrl && options?.serviceRoleKey) {
      triggerWorkerImmediately(options.supabaseUrl, options.serviceRoleKey);
    }

    return {
      job_id: job.id,
      idempotency_key: job.idempotency_key,
    };
  } catch (error) {
    console.error('[createJob] Error:', error);
    return null;
  }
}

