/**
 * 미납 알림 자동 발송 배치 작업
 *
 * 아키텍처 문서 3.4.3 섹션 참조
 * 스케줄: 매일 09:00 KST (Supabase cron 설정 필요)
 *
 * [불변 규칙] Zero-Management: 사용자 개입 없이 자동 실행
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 기술문서 19-1-2: KST 기준 날짜 처리
    // Edge Functions는 Deno 환경이므로 수동으로 KST 변환 수행
    const now = new Date();
    const kstOffset = 9 * 60;
    const kstTime = new Date(now.getTime() + (kstOffset * 60 * 1000));
    const today = kstTime.toISOString().slice(0, 10);

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

    for (const tenant of tenants) {
      try {
        // 자동 미납 알림 설정 확인
        const { data: settings } = await supabase
          .from('tenant_settings')
          .select('settings')
          .eq('tenant_id', tenant.id)
          .single();

        const autoOverdueNotification = settings?.settings?.notification?.auto_notification?.overdue ?? false;
        const notificationChannel = settings?.settings?.notification?.auto_notification?.channel ?? 'sms';

        if (!autoOverdueNotification) {
          console.log(`[Overdue Notification] Auto notification disabled for tenant ${tenant.id}`);
          continue;
        }

        // 기한이 지난 미납 청구서 조회
        const { data: overdueInvoices, error: invoicesError } = await supabase
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
          .eq('tenant_id', tenant.id)
          .in('status', ['pending', 'overdue'])
          .lt('due_date', today);

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
          const { data: existingNotification } = await supabase
            .from('notifications')
            .select('id')
            .eq('tenant_id', tenant.id)
            .eq('event_type', 'overdue')
            .eq('template_data->>invoice_id', invoice.id)
            .gte('created_at', `${today}T00:00:00`)
            .limit(1);

          if (existingNotification && existingNotification.length > 0) {
            continue; // 이미 오늘 발송됨
          }

          // 학부모 정보 조회
          const { data: guardians } = await supabase
            .from('guardians')
            .select('id, phone, is_primary')
            .eq('student_id', invoice.payer_id)
            .eq('tenant_id', tenant.id)
            .order('is_primary', { ascending: false })
            .limit(1);

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
              event_type: 'overdue',
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
              scheduled_at: kstTime.toISOString(),
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





