/**
 * 미납 알림 발송 배치 작업 (서버가 발송)
 *
 * 아키텍처 문서 3.4.3 섹션 참조
 * 스케줄: 매일 09:00 KST (Supabase cron 설정 필요)
 *
 * [불변 규칙] Zero-Management: 사용자 개입 없이 자동 실행
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getTenantSettingByPath } from '../_shared/policy-utils.ts';
import { assertAutomationEventType } from '../_shared/automation-event-catalog.ts';
import { withTenant } from '../_shared/withTenant.ts';
import { envServer } from '../_shared/env-registry.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // [불변 규칙] Edge Functions도 env-registry를 통해 환경변수 접근
    const supabase = createClient(envServer.SUPABASE_URL, envServer.SERVICE_ROLE_KEY);

    // 기술문서 19-1-2: KST 기준 날짜 처리
    // [불변 규칙] 파일명 생성 시 날짜 형식은 반드시 KST 기준을 사용합니다.
    const kstTime = toKST();
    const today = toKSTDate();

    console.log(`[Overdue Notification] Starting batch for ${today}`);

    // 모든 활성 테넌트 조회
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id')
      .eq('status', 'active');

    if (tenantsError) {
      throw new Error(`Failed to fetch tenants: ${tenantsError.message}`);
    }

    if (!tenants || tenants.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active tenants', sent_count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalSent = 0;

    // ⚠️ 중요: event_type 검증 (SSOT 강제, Fail-Closed)
    const eventType = 'overdue_outstanding_over_limit';
    assertAutomationEventType(eventType); // 카탈로그에 없는 event_type이면 즉시 에러

    // ⚠️ 주의: notifications.event_type은 "notifications 테이블용 도메인 이벤트 타입"이며,
    // 자동화 정책 경로의 event_type(예: overdue_outstanding_over_limit)과 다릅니다.
    const NOTIFICATIONS_EVENT_TYPE_OVERDUE = 'overdue' as const;

    for (const tenant of tenants) {
      try {

        // ⚠️ 중요: 미납 알림 발송 Policy 확인 (서버가 발송, Fail Closed)
        // 신규 경로 우선, 없으면 레거시 경로 제한적 fallback
        const autoOverdueNotificationPolicy = await getTenantSettingByPath(
          supabase,
          tenant.id,
          `auto_notification.${eventType}.enabled`,
          'auto_notification.overdue.enabled' // 레거시 경로 fallback
        );
        if (!autoOverdueNotificationPolicy || autoOverdueNotificationPolicy !== true) {
          // Policy가 없거나 비활성화되어 있으면 실행하지 않음 (Fail Closed)
          console.log(`[Overdue Notification] Auto notification disabled for tenant ${tenant.id}, skipping`);
          continue;
        }

        // ⚠️ 중요: 미납 알림 채널 Policy 조회 (Fail Closed)
        // 신규 경로 우선, 없으면 레거시 경로 제한적 fallback
        const notificationChannelPolicy = await getTenantSettingByPath(
          supabase,
          tenant.id,
          `auto_notification.${eventType}.channel`,
          'auto_notification.overdue.channel' // 레거시 경로 fallback
        );
        // SSOT-3: 'kakao' 저장 금지, 'kakao_at'로 정규화
        let notificationChannel: string;
        if (notificationChannelPolicy && typeof notificationChannelPolicy === 'string') {
          notificationChannel = notificationChannelPolicy;
        } else {
          // Policy가 없으면 실행하지 않음 (Fail Closed)
          console.log(`[Overdue Notification] Notification channel policy not found for tenant ${tenant.id}, skipping`);
          continue;
        }
        if (notificationChannel === 'kakao') {
          console.warn(`[Overdue Notification] Legacy channel 'kakao' detected for tenant ${tenant.id}, normalizing to 'kakao_at'`);
          notificationChannel = 'kakao_at';
        }
        // Policy에서 조회한 값만 사용 (정규화 후)

        // 기한이 지난 미납 청구서 조회
        const { data: overdueInvoices, error: invoicesError } = await withTenant(
          supabase
          .from('invoices')
          .select(`
            id,
            payer_id,
            amount,
            amount_paid,
            due_date,
            invoice_number,
            persons!invoices_payer_id_fkey(id, name)
          `)
          .in('status', ['pending', 'overdue'])
            .lt('due_date', today),
          tenant.id
        );

        if (invoicesError) {
          console.error(`[Overdue Notification] Failed to fetch invoices for tenant ${tenant.id}:`, invoicesError);
          continue;
        }

        if (!overdueInvoices || overdueInvoices.length === 0) {
          continue;
        }

        // 각 미납 청구서에 대해 알림 발송
        for (const invoice of overdueInvoices) {
          // 이미 오늘 발송된 알림이 있는지 확인
          const { data: existingNotification } = await withTenant(
            supabase
            .from('notifications')
            .select('id')
            .eq('event_type', NOTIFICATIONS_EVENT_TYPE_OVERDUE)
            .eq('template_data->>invoice_id', invoice.id)
            .gte('created_at', `${today}T00:00:00`)
              .limit(1),
            tenant.id
          );

          if (existingNotification && existingNotification.length > 0) {
            continue; // 이미 오늘 발송됨
          }

          // 학부모 정보 조회
          const { data: guardians } = await withTenant(
            supabase
            .from('guardians')
            .select('id, phone, is_primary')
            .eq('student_id', invoice.payer_id)
            .order('is_primary', { ascending: false })
              .limit(1),
            tenant.id
          );

          if (!guardians || guardians.length === 0) {
            continue;
          }

          const guardian = guardians[0];
          if (!guardian.phone) {
            continue;
          }

          // 미납 알림 생성
          const { error: notificationError } = await supabase
            .from('notifications')
            .insert({
              tenant_id: tenant.id,
              recipient_type: 'guardian',
              recipient_id: guardian.id,
              channel: notificationChannel,
              event_type: NOTIFICATIONS_EVENT_TYPE_OVERDUE,
              template_key: 'billing_overdue_academy_v1',
              template_data: {
                student_name: invoice.persons?.name || '학생',
                invoice_number: invoice.invoice_number,
                amount: invoice.amount,
                amount_due: (invoice.amount || 0) - (invoice.amount_paid || 0),
                due_date: invoice.due_date,
                invoice_id: invoice.id,
              },
              status: 'pending',
              scheduled_at: toKST().toISOString(),
            });

          if (!notificationError) {
            totalSent++;
            console.log(`[Overdue Notification] Created notification for invoice ${invoice.id}`);
          }
        }

      } catch (error) {
        console.error(`[Overdue Notification] Error processing tenant ${tenant.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent_count: totalSent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Overdue Notification] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});





