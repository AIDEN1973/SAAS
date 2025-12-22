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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // [불변 규칙] Role 분리: 상용화 단계에서 Role 분리 구현
    // payment-webhook-handler는 PAYMENT_WEBHOOK_ROLE_KEY 사용, 없으면 SERVICE_ROLE_KEY fallback
    const roleKey = envServer.PAYMENT_WEBHOOK_ROLE_KEY || envServer.SERVICE_ROLE_KEY;
    const supabase = createClient(envServer.SUPABASE_URL, roleKey);
    const body = await req.json();

    // Webhook 이벤트 타입 확인
    const eventType = body.event_type || body.type;
    if (eventType !== 'payment.failed' && eventType !== 'recurring_payment_failed') {
      return new Response(
        JSON.stringify({ success: false, message: 'Unsupported event type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paymentId = body.payment_id || body.id;
    const tenantId = body.tenant_id;
    const invoiceId = body.invoice_id;

    if (!paymentId || !tenantId || !invoiceId) {
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
      return new Response(
        JSON.stringify({ success: false, message: 'Guardian not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 정기 결제 실패 알림 발송
    const today = toKSTDate(kstTime);
    const dedupKey = `${tenantId}:${automationEventType}:invoice:${invoiceId}:guardian:${guardian.id}:${today}`;
    await supabase.from('automation_actions').insert({
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
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Notification queued' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Payment Webhook] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

