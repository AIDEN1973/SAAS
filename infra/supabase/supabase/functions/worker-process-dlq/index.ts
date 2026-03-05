/**
 * DLQ 재처리 워커 Edge Function
 *
 * [Phase 3] Dead Letter Queue에 적재된 실패 작업을 재처리
 * 스케줄: 매시간 실행 (Supabase cron) 또는 수동 트리거
 *
 * [불변 규칙] Zero-Management: 사용자 개입 없이 자동 실행
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { envServer } from '../_shared/env-registry.ts';
import { claimDLQRecords, resolveDLQ, failDLQRetry } from '../_shared/dlq-utils.ts';
import type { DLQRecord } from '../_shared/dlq-utils.ts';
import { sendImmediateAlert } from '../_shared/alerting.ts';
import { createExecutionAuditRecord } from '../_shared/execution-audit-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * function_name별 재처리 핸들러 라우팅
 *
 * 각 핸들러는 DLQ 레코드의 payload를 받아서 원본 작업을 재시도합니다.
 * 성공 시 true, 실패 시 false를 반환합니다.
 */
async function processRecord(
  supabase: ReturnType<typeof createClient>,
  record: DLQRecord
): Promise<boolean> {
  const { function_name, payload, tenant_id } = record;

  switch (function_name) {
    case 'auto-billing-generation': {
      // 인보이스 재생성: payload에서 기간 정보를 가져와서 재시도
      // 실제 재처리는 해당 Edge Function을 직접 호출하는 것이 안전
      console.log(`[DLQ Worker] Re-processing auto-billing for tenant ${tenant_id}`);
      try {
        // Edge Function 직접 호출 (internal invoke)
        const { error } = await supabase.functions.invoke('auto-billing-generation', {
          body: { tenant_id, ...payload },
        });
        return !error;
      } catch {
        return false;
      }
    }

    case 'financial-automation-batch': {
      console.log(`[DLQ Worker] Re-processing financial-automation for tenant ${tenant_id}`);
      try {
        const { error } = await supabase.functions.invoke('financial-automation-batch', {
          body: { tenant_id, ...payload },
        });
        return !error;
      } catch {
        return false;
      }
    }

    case 'payment-webhook-handler': {
      console.log(`[DLQ Worker] Re-processing payment webhook for tenant ${tenant_id}`);
      // 결제 웹훅은 멱등성이 보장되므로 재처리 안전
      try {
        const { error } = await supabase.functions.invoke('payment-webhook-handler', {
          body: payload,
        });
        return !error;
      } catch {
        return false;
      }
    }

    case 'overdue-notification-scheduler': {
      console.log(`[DLQ Worker] Re-processing overdue notification for tenant ${tenant_id}`);
      try {
        // 개별 알림 재발송: notifications 테이블에 직접 INSERT
        if (payload.invoice_id && payload.guardian_id) {
          const { error } = await supabase.from('notifications').insert({
            tenant_id,
            recipient_type: 'guardian',
            recipient_id: payload.guardian_id,
            channel: 'sms',
            event_type: 'overdue',
            template_key: 'billing_overdue_academy_v1',
            template_data: payload,
            status: 'pending',
            scheduled_at: new Date().toISOString(),
          });
          return !error;
        }
        return false;
      } catch {
        return false;
      }
    }

    case 'daily-statistics-update': {
      console.log(`[DLQ Worker] Re-processing daily statistics for tenant ${tenant_id}`);
      try {
        const { error } = await supabase.functions.invoke('daily-statistics-update', {
          body: { tenant_id, ...payload },
        });
        return !error;
      } catch {
        return false;
      }
    }

    default:
      console.warn(`[DLQ Worker] Unknown function_name: ${function_name}`);
      return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(envServer.SUPABASE_URL, envServer.SERVICE_ROLE_KEY);

    // 옵션: 특정 함수만 재처리
    let functionFilter: string | undefined;
    let limit = 50;
    try {
      const body = await req.json();
      functionFilter = body.function_name;
      limit = body.limit || 50;
    } catch {
      // body 없이 호출된 경우 전체 처리
    }

    console.log(`[DLQ Worker] Starting processing${functionFilter ? ` for ${functionFilter}` : ''} (limit: ${limit})`);

    // pending 상태인 DLQ 항목을 원자적으로 claim (동시 실행 중복 방지)
    const records = await claimDLQRecords(supabase, functionFilter, limit);

    if (records.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No pending DLQ records', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let resolved = 0;
    let failed = 0;
    let permanentlyFailed = 0;

    for (const record of records) {
      // claimDLQRecords가 이미 status='retrying'으로 원자적 변경 완료
      // 재처리 시도
      const success = await processRecord(supabase, record);

      if (success) {
        await resolveDLQ(supabase, record.id);
        resolved++;
        console.log(`[DLQ Worker] Resolved: ${record.id} (${record.function_name})`);
      } else {
        const isPermanent = await failDLQRetry(supabase, record);
        failed++;

        if (isPermanent) {
          permanentlyFailed++;
          // 영구 실패 시 critical 알림
          await sendImmediateAlert(supabase, {
            functionName: 'worker-process-dlq',
            errorType: 'permanent_dlq_failure',
            severity: 'critical',
            message: `[DLQ 영구 실패] ${record.function_name}: ${record.retry_count + 1}회 재시도 모두 실패`,
            context: {
              dlq_id: record.id,
              function_name: record.function_name,
              tenant_id: record.tenant_id,
              retry_count: record.retry_count + 1,
              max_retries: record.max_retries,
            },
            tenantId: record.tenant_id || undefined,
          });
        }
      }
    }

    // Execution Audit 기록
    try {
      await createExecutionAuditRecord(supabase, {
        tenant_id: 'system',
        operation_type: 'scheduler.worker-process-dlq',
        status: failed > 0 ? 'partial' : 'success',
        source: 'scheduler',
        actor_type: 'system',
        actor_id: 'svc:edge:worker-process-dlq',
        summary: `DLQ 재처리 완료 (${resolved}건 성공, ${failed}건 실패)`,
        details: {
          total: records.length,
          resolved,
          failed,
          permanently_failed: permanentlyFailed,
          function_filter: functionFilter,
        },
        reference: {
          entity_type: 'batch',
          entity_id: `worker-process-dlq:${new Date().toISOString().substring(0, 10)}`,
        },
        duration_ms: Date.now() - startTime,
        ...(failed > 0 && {
          error_code: 'DLQ_PARTIAL_FAILURE',
          error_summary: `${failed}건 재처리 실패 (${permanentlyFailed}건 영구 실패)`,
        }),
      });
    } catch (auditError) {
      console.error('[DLQ Worker] Failed to create audit record:', auditError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: records.length,
        resolved,
        failed,
        permanently_failed: permanentlyFailed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[DLQ Worker] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
