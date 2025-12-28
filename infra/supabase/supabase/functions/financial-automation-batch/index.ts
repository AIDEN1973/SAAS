/**
 * 재무 자동화 배치 작업
 *
 * AI_자동화_기능_정리.md Section 11 참조
 * financial_health 카테고리 자동화 처리
 * 스케줄: 매일 07:00-09:00 KST (각 자동화별 스케줄에 따라)
 *
 * [불변 규칙] Zero-Management: 사용자 개입 없이 자동 실행
 * [불변 규칙] Automation Config First: 모든 자동화는 Policy 기반으로만 동작
 * [불변 규칙] Fail Closed: Policy가 없으면 실행하지 않음
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getTenantSettingByPath, shouldUseAI } from '../_shared/policy-utils.ts';
import { assertAutomationEventType } from '../_shared/automation-event-catalog.ts';
import { withTenant } from '../_shared/withTenant.ts';
import { envServer } from '../_shared/env-registry.ts';
import { toKSTDate, toKST, toKSTMonth } from '../_shared/date-utils.ts';
import { checkAndUpdateAutomationSafety } from '../_shared/automation-safety.ts';
import { createTaskCardWithDedup } from '../_shared/create-task-card-with-dedup.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * 결제 예정일 알림 (payment_due_reminder)
 * 매일 D-3, D-1일 전 알림 발송
 */
async function processPaymentDueReminder(
  supabase: any,
  tenantId: string,
  kstTime: Date
): Promise<number> {
  const eventType = 'payment_due_reminder';
  assertAutomationEventType(eventType);

  // Policy 확인
  const enabled = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.enabled`
  );
  if (!enabled || enabled !== true) {
    return 0;
  }

  const channel = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.channel`
  ) as string;

  if (!channel) {
    return 0; // Fail Closed
  }

  // ⚠️ 중요: 자동화 안전성 체크 (AI_자동화_기능_정리.md Section 10.4)
  const safetyCheck = await checkAndUpdateAutomationSafety(
    supabase,
    tenantId,
    'send_notification',
    kstTime,
    `auto_notification.${eventType}.throttle.daily_limit`
  );
  if (!safetyCheck.canExecute) {
    console.warn(`[${eventType}] Skipping due to safety check: ${safetyCheck.reason}`);
    return 0;
  }

  // Policy에서 알림 일수 조회
  const daysBeforeFirst = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.days_before_first`
  ) as number;
  const daysBeforeSecond = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.days_before_second`
  ) as number;

  if (!daysBeforeFirst || !daysBeforeSecond) {
    return 0; // Fail Closed: 설정값이 없으면 실행하지 않음
  }

  let sentCount = 0;
  const today = toKSTDate(kstTime);
  const firstDaysLater = toKSTDate(new Date(kstTime.getTime() + daysBeforeFirst * 24 * 60 * 60 * 1000));
  const secondDaysLater = toKSTDate(new Date(kstTime.getTime() + daysBeforeSecond * 24 * 60 * 60 * 1000));

  // 첫 번째 알림: days_before_first일 후 결제 예정인 청구서
  const { data: invoicesFirst, error: errorFirst } = await withTenant(
    supabase
      .from('invoices')
      .select('id, payer_id, amount, due_date')
      .eq('status', 'pending')
      .eq('due_date', firstDaysLater),
    tenantId
  );

  if (!errorFirst && invoicesFirst) {
    for (const invoice of invoicesFirst) {
      // 보호자 정보 조회
      const { data: guardian } = await withTenant(
        supabase
          .from('guardians')
          .select('id, phone')
          .eq('student_id', invoice.payer_id)
          .eq('is_primary', true)
          .single(),
        tenantId
      );

      if (guardian) {
        // 알림 발송 (실제 구현은 notification dispatch 시스템 사용)
        // 여기서는 automation_actions에 로그만 기록
        const dedupKey = `${tenantId}:${eventType}:invoice:${invoice.id}:guardian:${guardian.id}:${toKSTDate(kstTime)}:d${daysBeforeFirst}`;
        await supabase.from('automation_actions').insert({
          tenant_id: tenantId,
          action_type: 'send_notification',
          executor_role: 'system',
          dedup_key: dedupKey,
          execution_context: {
            event_type: eventType,
            invoice_id: invoice.id,
            recipient_id: guardian.id,
            channel,
            days_before: daysBeforeFirst,
          },
        });
        sentCount++;
      }
    }
  }

  // 두 번째 알림: days_before_second일 후 결제 예정인 청구서
  const { data: invoicesSecond, error: errorSecond } = await withTenant(
    supabase
      .from('invoices')
      .select('id, payer_id, amount, due_date')
      .eq('status', 'pending')
      .eq('due_date', secondDaysLater),
    tenantId
  );

  if (!errorSecond && invoicesSecond) {
    for (const invoice of invoicesSecond) {
      const { data: guardian } = await withTenant(
        supabase
          .from('guardians')
          .select('id, phone')
          .eq('student_id', invoice.payer_id)
          .eq('is_primary', true)
          .single(),
        tenantId
      );

      if (guardian) {
        const dedupKey = `${tenantId}:${eventType}:invoice:${invoice.id}:guardian:${guardian.id}:${toKSTDate(kstTime)}:d${daysBeforeSecond}`;
        await supabase.from('automation_actions').insert({
          tenant_id: tenantId,
          action_type: 'send_notification',
          executor_role: 'system',
          dedup_key: dedupKey,
          execution_context: {
            event_type: eventType,
            invoice_id: invoice.id,
            recipient_id: guardian.id,
            channel,
            days_before: daysBeforeSecond,
          },
        });
        sentCount++;
      }
    }
  }

  return sentCount;
}

/**
 * 부분 결제 알림 (invoice_partial_balance)
 * 부분 결제 감지 시 잔액 안내
 */
async function processInvoicePartialBalance(
  supabase: any,
  tenantId: string,
  kstTime: Date
): Promise<number> {
  const eventType = 'invoice_partial_balance';
  assertAutomationEventType(eventType);

  const enabled = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.enabled`
  );
  if (!enabled || enabled !== true) {
    return 0;
  }

  const channel = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.channel`
  ) as string;

  if (!channel) {
    return 0; // Fail Closed
  }

  // ⚠️ 중요: 자동화 안전성 체크 (AI_자동화_기능_정리.md Section 10.4)
  const safetyCheck = await checkAndUpdateAutomationSafety(
    supabase,
    tenantId,
    'send_notification',
    kstTime,
    `auto_notification.${eventType}.throttle.daily_limit`
  );
  if (!safetyCheck.canExecute) {
    console.warn(`[${eventType}] Skipping due to safety check: ${safetyCheck.reason}`);
    return 0;
  }

  // 최근 24시간 내 부분 결제된 청구서 조회
  const yesterday = toKSTDate(new Date(kstTime.getTime() - 24 * 60 * 60 * 1000));

  // 부분 결제 감지: amount_paid > 0 AND amount_paid < amount
  // Supabase JS SDK에서는 직접 비교가 어려우므로 모든 청구서를 조회 후 필터링
  const { data: invoices, error } = await withTenant(
    supabase
      .from('invoices')
      .select('id, payer_id, amount, amount_paid')
      .gte('updated_at', `${yesterday}T00:00:00`)
      .gt('amount_paid', 0),
    tenantId
  );

  if (error || !invoices) {
    return 0;
  }

  let sentCount = 0;
  for (const invoice of invoices) {
    const balance = (invoice.amount || 0) - (invoice.amount_paid || 0);
    // 부분 결제 확인: amount_paid > 0 AND amount_paid < amount
    if (balance > 0 && invoice.amount_paid > 0) {
      const { data: guardian } = await withTenant(
        supabase
          .from('guardians')
          .select('id, phone')
          .eq('student_id', invoice.payer_id)
          .eq('is_primary', true)
          .single(),
        tenantId
      );

      if (guardian) {
        const dedupKey = `${tenantId}:${eventType}:invoice:${invoice.id}:guardian:${guardian.id}:${toKSTDate(kstTime)}`;
        await supabase.from('automation_actions').insert({
          tenant_id: tenantId,
          action_type: 'send_notification',
          executor_role: 'system',
          dedup_key: dedupKey,
          execution_context: {
            event_type: eventType,
            invoice_id: invoice.id,
            recipient_id: guardian.id,
            channel,
            balance,
          },
        });
        sentCount++;
      }
    }
  }

  return sentCount;
}

/**
 * 수납률 하락 알림 (collection_rate_drop)
 * 매일 07:20 실행
 */
async function processCollectionRateDrop(
  supabase: any,
  tenantId: string,
  kstTime: Date
): Promise<number> {
  const eventType = 'collection_rate_drop';
  assertAutomationEventType(eventType);

  const enabled = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.enabled`
  );
  if (!enabled || enabled !== true) {
    return 0;
  }

  // Policy에서 임계값 조회 (하드코딩 금지)
  const threshold = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.threshold`
  ) as number;
  if (!threshold || typeof threshold !== 'number') {
    return 0; // Fail Closed
  }

  // Policy에서 priority 조회 (Fail-Closed)
  const priorityPolicy = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.priority`
  ) as number | null;
  if (!priorityPolicy || typeof priorityPolicy !== 'number') {
    return 0; // Fail Closed
  }

  // Policy에서 TTL 조회 (Fail-Closed)
  const ttlDays = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.ttl_days`
  ) as number | null;
  if (!ttlDays || typeof ttlDays !== 'number') {
    return 0; // Fail Closed
  }

  // ⚠️ 중요: 자동화 안전성 체크 (AI_자동화_기능_정리.md Section 10.4)
  const safetyCheck = await checkAndUpdateAutomationSafety(
    supabase,
    tenantId,
    'create_task',
    kstTime,
    `auto_notification.${eventType}.throttle.daily_limit`
  );
  if (!safetyCheck.canExecute) {
    console.warn(`[${eventType}] Skipping due to safety check: ${safetyCheck.reason}`);
    return 0;
  }

  const currentMonth = toKSTMonth(kstTime);
  const lastMonth = toKSTMonth(new Date(kstTime.getFullYear(), kstTime.getMonth() - 1, 1));

  // 이번 달 수납률
  const { data: currentInvoices } = await withTenant(
    supabase
      .from('invoices')
      .select('amount, amount_paid')
      .gte('period_start', `${currentMonth}-01`),
    tenantId
  );

  // 지난 달 수납률
  const { data: lastInvoices } = await withTenant(
    supabase
      .from('invoices')
      .select('amount, amount_paid')
      .gte('period_start', `${lastMonth}-01`)
      .lt('period_start', `${currentMonth}-01`),
    tenantId
  );

  const currentRate = currentInvoices && currentInvoices.length > 0
    ? (currentInvoices.reduce((sum: number, inv: any) => sum + (inv.amount_paid || 0), 0) /
       currentInvoices.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0)) * 100
    : 100;

  const lastRate = lastInvoices && lastInvoices.length > 0
    ? (lastInvoices.reduce((sum: number, inv: any) => sum + (inv.amount_paid || 0), 0) /
       lastInvoices.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0)) * 100
    : 100;

  const dropRate = lastRate - currentRate;

  if (dropRate >= threshold) {
    // owner/admin에게 알림 (TaskCard 생성, 정본)
    const dedupKey = `${tenantId}:${eventType}:tenant:${tenantId}:${toKSTDate(kstTime)}`;
    // ⚠️ 정본 규칙: 부분 유니크 인덱스 사용 시 Supabase client upsert() 직접 사용 불가
    // RPC 함수 create_task_card_with_dedup_v1 사용 (프론트 자동화 문서 2.3 섹션 참조)
    await createTaskCardWithDedup(supabase, {
      tenant_id: tenantId,
      entity_id: tenantId,  // entity_id = tenantId (entity_type='tenant')
      entity_type: 'tenant', // entity_type
      task_type: 'risk',
      title: '수납률 하락 알림',
      description: `이번 달 수납률이 지난 달 대비 ${dropRate.toFixed(1)}% 하락했습니다.`,
      priority: priorityPolicy,
      dedup_key: dedupKey,
      expires_at: new Date(kstTime.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
    });

    return 1;
  }

  return 0;
}

/**
 * 일일 필요 매출 계산 (revenue_required_per_day)
 * 매일 07:30 실행
 */
async function processRevenueRequiredPerDay(
  supabase: any,
  tenantId: string,
  kstTime: Date
): Promise<number> {
  const eventType = 'revenue_required_per_day';
  assertAutomationEventType(eventType);

  const enabled = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.enabled`
  );
  if (!enabled || enabled !== true) {
    return 0;
  }

  // Policy에서 월 목표 매출 조회
  const monthlyTarget = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.monthly_target`
  ) as number;
  if (!monthlyTarget || typeof monthlyTarget !== 'number') {
    return 0; // Fail Closed
  }

  // ⚠️ 중요: 자동화 안전성 체크 (AI_자동화_기능_정리.md Section 10.4)
  const safetyCheck = await checkAndUpdateAutomationSafety(
    supabase,
    tenantId,
    'create_report',
    kstTime,
    `auto_notification.${eventType}.throttle.daily_limit`
  );
  if (!safetyCheck.canExecute) {
    console.warn(`[${eventType}] Skipping due to safety check: ${safetyCheck.reason}`);
    return 0;
  }

  const currentMonth = toKSTMonth(kstTime);
  const today = toKSTDate(kstTime);
  const dayOfMonth = kstTime.getDate();
  const daysInMonth = new Date(kstTime.getFullYear(), kstTime.getMonth() + 1, 0).getDate();

  // 이번 달 현재 매출
  const { data: invoices } = await withTenant(
    supabase
      .from('invoices')
      .select('amount_paid')
      .gte('period_start', `${currentMonth}-01`)
      .lte('period_start', today),
    tenantId
  );

  const currentRevenue = invoices
    ? invoices.reduce((sum: number, inv: any) => sum + (inv.amount_paid || 0), 0)
    : 0;

  const requiredPerDay = (monthlyTarget - currentRevenue) / (daysInMonth - dayOfMonth + 1);

  // AI 브리핑으로 저장
  if (await shouldUseAI(supabase, tenantId)) {
    await supabase.from('ai_insights').insert({
      tenant_id: tenantId,
      insight_type: 'daily_briefing',
      title: '일일 필요 매출',
      summary: `이번 달 목표 달성을 위해 일일 ${Math.round(requiredPerDay).toLocaleString()}원의 매출이 필요합니다.`,
      created_at: kstTime.toISOString(),
    });
  }

  return 1;
}

/**
 * 환불 급증 알림 (refund_spike)
 * 매일 07:40 실행
 */
async function processRefundSpike(
  supabase: any,
  tenantId: string,
  kstTime: Date
): Promise<number> {
  const eventType = 'refund_spike';
  assertAutomationEventType(eventType);

  const enabled = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.enabled`
  );
  if (!enabled || enabled !== true) {
    return 0;
  }

  // Policy에서 임계값 조회
  const threshold = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.threshold`
  ) as number;
  if (!threshold || typeof threshold !== 'number') {
    return 0; // Fail Closed
  }

  // Policy에서 priority 조회 (Fail-Closed)
  const priorityPolicy = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.priority`
  ) as number | null;
  if (!priorityPolicy || typeof priorityPolicy !== 'number') {
    return 0; // Fail Closed
  }

  // Policy에서 TTL 조회 (Fail-Closed)
  const ttlDays = await getTenantSettingByPath(
    supabase,
    tenantId,
    `auto_notification.${eventType}.ttl_days`
  ) as number | null;
  if (!ttlDays || typeof ttlDays !== 'number') {
    return 0; // Fail Closed
  }

  // ⚠️ 중요: 자동화 안전성 체크 (AI_자동화_기능_정리.md Section 10.4)
  const safetyCheck = await checkAndUpdateAutomationSafety(
    supabase,
    tenantId,
    'create_task',
    kstTime,
    `auto_notification.${eventType}.throttle.daily_limit`
  );
  if (!safetyCheck.canExecute) {
    console.warn(`[${eventType}] Skipping due to safety check: ${safetyCheck.reason}`);
    return 0;
  }

  const today = toKSTDate(kstTime);
  const sevenDaysAgo = toKSTDate(new Date(kstTime.getTime() - 7 * 24 * 60 * 60 * 1000));

  // 최근 7일 환불 건수
  const { data: recentRefunds } = await withTenant(
    supabase
      .from('refunds')
      .select('id, amount')
      .gte('created_at', `${sevenDaysAgo}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`),
    tenantId
  );

  // 이전 7일 환불 건수
  const fourteenDaysAgo = toKSTDate(new Date(kstTime.getTime() - 14 * 24 * 60 * 60 * 1000));
  const { data: previousRefunds } = await withTenant(
    supabase
      .from('refunds')
      .select('id, amount')
      .gte('created_at', `${fourteenDaysAgo}T00:00:00`)
      .lt('created_at', `${sevenDaysAgo}T00:00:00`),
    tenantId
  );

  const recentCount = recentRefunds?.length || 0;
  const previousCount = previousRefunds?.length || 0;

  if (previousCount > 0 && (recentCount / previousCount) >= threshold) {
    const dedupKey = `${tenantId}:${eventType}:tenant:${tenantId}:${today}`;
    // ⚠️ 정본 규칙: 부분 유니크 인덱스 사용 시 Supabase client upsert() 직접 사용 불가
    // RPC 함수 create_task_card_with_dedup_v1 사용 (프론트 자동화 문서 2.3 섹션 참조)
    await createTaskCardWithDedup(supabase, {
      tenant_id: tenantId,
      entity_id: tenantId,  // entity_id = tenantId (entity_type='tenant')
      entity_type: 'tenant', // entity_type
      task_type: 'risk',
      title: '환불 급증 알림',
      description: `최근 7일간 환불 건수가 이전 대비 ${((recentCount / previousCount - 1) * 100).toFixed(1)}% 증가했습니다.`,
      priority: priorityPolicy,
      dedup_key: dedupKey,
      expires_at: new Date(kstTime.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
    });

    return 1;
  }

  return 0;
}

serve(async (req) => {
  // CORS preflight 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(envServer.SUPABASE_URL, envServer.SERVICE_ROLE_KEY);
    const kstTime = toKST();
    const hour = kstTime.getHours();
    const minute = kstTime.getMinutes();

    console.log(`[Financial Automation] Starting batch at ${hour}:${minute}`);

    const { data: tenants } = await supabase
      .from('tenants')
      .select('id')
      .eq('status', 'active');

    if (!tenants || tenants.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active tenants' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalProcessed = 0;

    for (const tenant of tenants) {
      try {
        // 스케줄에 따라 실행
        if (hour === 7) {
          if (minute >= 10 && minute < 20) {
            // revenue_target_under는 daily-statistics-update에서 처리
          } else if (minute >= 20 && minute < 30) {
            totalProcessed += await processCollectionRateDrop(supabase, tenant.id, kstTime);
          } else if (minute >= 30 && minute < 40) {
            totalProcessed += await processRevenueRequiredPerDay(supabase, tenant.id, kstTime);
          } else if (minute >= 40 && minute < 50) {
            totalProcessed += await processRefundSpike(supabase, tenant.id, kstTime);
          }
        } else if (hour === 9 && minute < 5) {
          // top_overdue_customers_digest는 overdue-notification-scheduler에서 처리
        }

        // payment_due_reminder는 매일 실행
        totalProcessed += await processPaymentDueReminder(supabase, tenant.id, kstTime);
        // invoice_partial_balance는 트리거 기반이지만 배치로도 확인
        totalProcessed += await processInvoicePartialBalance(supabase, tenant.id, kstTime);
      } catch (error) {
        console.error(`[Financial Automation] Error for tenant ${tenant.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed_count: totalProcessed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Financial Automation] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

