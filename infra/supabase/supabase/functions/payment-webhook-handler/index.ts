/**
 * 결제 Webhook 처리
 *
 * AI_자동화_기능_정리.md Section 11 참조
 * financial_health 카테고리: recurring_payment_failed
 * Webhook 기반 자동화 처리
 *
 * [불변 규칙] Zero-Management: 사용자 개입 없이 자동 실행
 * [불변 규칙] Automation Config First: 모든 자동화는 Policy 기반으로만 동작
 * [불변 규칙] Fail Closed: Policy가 없으면 실행하지 않음
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getTenantSettingByPath } from '../_shared/policy-utils.ts';
import { assertAutomationEventType } from '../_shared/automation-event-catalog.ts';
import { withTenant } from '../_shared/withTenant.ts';
import { envServer } from '../_shared/env-registry.ts';
import { checkAndUpdateAutomationSafety } from '../_shared/automation-safety.ts';
import { toKST, toKSTDate } from '../_shared/date-utils.ts';
import { createExecutionAuditRecord } from '../_shared/execution-audit-utils.ts';
import { withRetry } from '../_shared/retry-utils.ts';
import { enqueueDLQ } from '../_shared/dlq-utils.ts';
import { sendImmediateAlert } from '../_shared/alerting.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS preflight 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  let processedEventId: string | null = null;
  try {
    // ── 웹훅 서명 검증 (Phase 0-1) ──
    const rawBody = await req.text();
    const webhookSecret = envServer.PAYMENT_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers.get('x-webhook-signature') || req.headers.get('toss-signature');
      if (!signature) {
        console.error('[Payment Webhook] Missing webhook signature header');
        return new Response(
          JSON.stringify({ success: false, message: 'Missing webhook signature' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // HMAC-SHA256 검증
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(webhookSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
      const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      if (signature !== expectedSignature) {
        console.error('[Payment Webhook] Invalid webhook signature');
        return new Response(
          JSON.stringify({ success: false, message: 'Invalid webhook signature' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── 멱등성 체크: 동일 이벤트 중복 처리 방지 ──
    const body = JSON.parse(rawBody);
    const eventId = body.event_id || body.idempotency_key || `${body.payment_id || body.id}:${body.event_type || body.type}`;
    processedEventId = eventId;

    // [불변 규칙] Role 분리: 상용화 단계에서 Role 분리 구현
    // payment-webhook-handler는 PAYMENT_WEBHOOK_ROLE_KEY 사용, 없으면 SERVICE_ROLE_KEY fallback
    const roleKey = envServer.PAYMENT_WEBHOOK_ROLE_KEY || envServer.SERVICE_ROLE_KEY;
    const supabase = createClient(envServer.SUPABASE_URL, roleKey);

    // 멱등성: 이미 처리된 이벤트인지 확인
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id, status')
      .eq('event_id', eventId)
      .maybeSingle();

    if (existingEvent) {
      return new Response(
        JSON.stringify({ success: true, message: 'Event already processed', event_id: eventId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 이벤트 수신 기록
    await supabase.from('webhook_events').insert({
      event_id: eventId,
      event_type: body.event_type || body.type,
      payload: body,
      status: 'processing',
      received_at: new Date().toISOString(),
    });

    // webhook_events 상태 업데이트 헬퍼
    const updateWebhookStatus = async (status: string) => {
      await supabase
        .from('webhook_events')
        .update({ status, processed_at: new Date().toISOString() })
        .eq('event_id', eventId);
    };

    // Webhook 이벤트 타입 확인
    const eventType = body.event_type || body.type;
    if (eventType !== 'payment.failed' && eventType !== 'recurring_payment_failed') {
      await updateWebhookStatus('skipped');
      return new Response(
        JSON.stringify({ success: false, message: 'Unsupported event type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paymentId = body.payment_id || body.id;
    const tenantId = body.tenant_id;
    const invoiceId = body.invoice_id;

    if (!paymentId || !tenantId || !invoiceId) {
      await updateWebhookStatus('failed');
      return new Response(
        JSON.stringify({ success: false, message: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Policy 확인
    const automationEventType = 'recurring_payment_failed';
    assertAutomationEventType(automationEventType);

    const enabled = await getTenantSettingByPath(
      supabase,
      tenantId,
      `auto_notification.${automationEventType}.enabled`
    );
    if (!enabled || enabled !== true) {
      await updateWebhookStatus('skipped');
      return new Response(
        JSON.stringify({ success: true, message: 'Automation disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const channel = await getTenantSettingByPath(
      supabase,
      tenantId,
      `auto_notification.${automationEventType}.channel`
    ) as string;

    if (!channel) {
      await updateWebhookStatus('failed');
      return new Response(
        JSON.stringify({ success: false, message: 'Channel policy not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ⚠️ 중요: 자동화 안전성 체크 (AI_자동화_기능_정리.md Section 10.4)
    const kstTime = toKST();
    const safetyCheck = await checkAndUpdateAutomationSafety(
      supabase,
      tenantId,
      'send_notification',
      kstTime,
      `auto_notification.${automationEventType}.throttle.daily_limit`
    );
    if (!safetyCheck.canExecute) {
      await updateWebhookStatus('skipped');
      return new Response(
        JSON.stringify({ success: true, message: `Skipping due to safety check: ${safetyCheck.reason}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 청구서 및 보호자 정보 조회
    const { data: invoice } = await withTenant(
      supabase
        .from('invoices')
        .select('id, payer_id')
        .eq('id', invoiceId)
        .single(),
      tenantId
    );

    if (!invoice) {
      await updateWebhookStatus('failed');
      return new Response(
        JSON.stringify({ success: false, message: 'Invoice not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: guardian } = await withTenant(
      supabase
        .from('guardians')
        .select('id, phone')
        .eq('student_id', invoice.payer_id)
        .eq('is_primary', true)
        .single(),
      tenantId
    );

    if (!guardian) {
      await updateWebhookStatus('failed');
      return new Response(
        JSON.stringify({ success: false, message: 'Guardian not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 정기 결제 실패 알림 발송
    const startTime = Date.now();
    const today = toKSTDate(kstTime);
    const dedupKey = `${tenantId}:${automationEventType}:invoice:${invoiceId}:guardian:${guardian.id}:${today}`;
    try {
      await withRetry(
        () => supabase.from('automation_actions').insert({
          tenant_id: tenantId,
          action_type: 'send_notification',
          executor_role: 'system',
          dedup_key: dedupKey,
          execution_context: {
            event_type: automationEventType,
            invoice_id: invoiceId,
            payment_id: paymentId,
            recipient_id: guardian.id,
            channel,
            failure_reason: body.failure_reason || 'Unknown',
          },
        }),
        { maxRetries: 3, baseDelay: 1000 }
      );
    } catch (insertError) {
      console.error('[Payment Webhook] automation_actions insert failed after retries:', insertError);

      await enqueueDLQ(supabase, {
        tenant_id: tenantId,
        function_name: 'payment-webhook-handler',
        payload: {
          eventId,
          eventType,
          invoiceId,
          paymentId,
          guardianId: guardian.id,
          channel,
          dedupKey,
        },
        error_message: insertError instanceof Error ? insertError.message : String(insertError),
      });

      await sendImmediateAlert(supabase, {
        functionName: 'payment-webhook-handler',
        errorType: 'automation_action_insert_failed',
        severity: 'critical',
        message: `[결제 웹훅] automation_actions insert 실패 (invoice: ${invoiceId}, payment: ${paymentId})`,
        context: {
          invoiceId,
          paymentId,
          guardianId: guardian.id,
          error: insertError instanceof Error ? insertError.message : String(insertError),
        },
        tenantId,
      });

      throw insertError;
    }

    // Execution Audit 기록 생성 (액티비티.md 3.4, 12 참조)
    // 웹훅 수신 처리: source='webhook' (액티비티.md 6.1 참조)
    const durationMs = Date.now() - startTime;
    await createExecutionAuditRecord(supabase, {
      tenant_id: tenantId,
      operation_type: 'payment.webhook-failed',
      status: 'success',
      source: 'webhook', // 웹훅 수신 처리 (액티비티.md 6.1 참조)
      actor_type: 'system',
      actor_id: 'svc:edge:payment-webhook-handler',
      summary: `결제 실패 웹훅 처리 완료 (invoice_id: ${invoiceId.substring(0, 8)}...)`,
      details: {
        invoice_id: invoiceId,
        payment_id: paymentId,
      },
      reference: {
        entity_type: 'invoice',
        entity_id: invoiceId,
        source_event_id: `webhook:payment.failed:${paymentId}:${Date.now()}`,
      },
      duration_ms: durationMs,
    });

    // 멱등성: 처리 완료 기록
    await supabase
      .from('webhook_events')
      .update({ status: 'completed', processed_at: new Date().toISOString() })
      .eq('event_id', eventId);

    return new Response(
      JSON.stringify({ success: true, message: 'Notification queued' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Payment Webhook] Fatal error:', error);

    // DLQ 및 즉시 알림 (best-effort)
    try {
      const supabaseForDLQ = createClient(
        envServer.SUPABASE_URL,
        envServer.PAYMENT_WEBHOOK_ROLE_KEY || envServer.SERVICE_ROLE_KEY
      );

      await enqueueDLQ(supabaseForDLQ, {
        tenant_id: null,
        function_name: 'payment-webhook-handler',
        payload: {
          eventId: processedEventId,
          eventType: 'payment.failed',
          rawPayload: 'redacted',
          failReason: error instanceof Error ? error.message : String(error),
        },
        error_message: error instanceof Error ? error.message : String(error),
      });

      await sendImmediateAlert(supabaseForDLQ, {
        functionName: 'payment-webhook-handler',
        errorType: 'webhook_processing_failed',
        severity: 'critical',
        message: `[결제 웹훅] Fatal error - 웹훅 처리 실패 (event: ${processedEventId || 'unknown'})`,
        context: {
          eventId: processedEventId,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    } catch (dlqError) {
      console.error('[Payment Webhook] Failed to enqueue DLQ/alert on fatal error:', dlqError);
    }

    // webhook_events 상태 업데이트 (best-effort)
    if (processedEventId) {
      try {
        const roleKey = envServer.PAYMENT_WEBHOOK_ROLE_KEY || envServer.SERVICE_ROLE_KEY;
        const supabaseForCleanup = createClient(envServer.SUPABASE_URL, roleKey);
        await supabaseForCleanup
          .from('webhook_events')
          .update({ status: 'failed', processed_at: new Date().toISOString() })
          .eq('event_id', processedEventId);
      } catch (cleanupError) {
        console.error('[Payment Webhook] Failed to update webhook_events on error:', cleanupError);
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

