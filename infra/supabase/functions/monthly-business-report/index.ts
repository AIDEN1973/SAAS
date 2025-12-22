/**
 * 월간 사업 리포트 생성
 *
 * AI_자동화_기능_정리.md Section 11 참조
 * financial_health 카테고리: monthly_business_report
 * 스케줄: 매월 1일 09:00 KST
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(envServer.SUPABASE_URL, envServer.SERVICE_ROLE_KEY);
    const kstTime = toKST();
    const dayOfMonth = kstTime.getDate();
    const hour = kstTime.getHours();
    const minute = kstTime.getMinutes();

    console.log(`[Monthly Business Report] Starting at ${dayOfMonth}/${hour}:${minute}`);

    // 매월 1일 09:00에만 실행
    if (dayOfMonth !== 1 || hour !== 9 || minute >= 5) {
      return new Response(
        JSON.stringify({ success: true, message: 'Not scheduled time, skipping' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    const eventType = 'monthly_business_report';
    assertAutomationEventType(eventType);

    let totalGenerated = 0;

    for (const tenant of tenants) {
      try {
        const enabled = await getTenantSettingByPath(
          supabase,
          tenant.id,
          `auto_notification.${eventType}.enabled`
        );
        if (!enabled || enabled !== true) {
          continue;
        }

        if (!(await shouldUseAI(supabase, tenant.id))) {
          continue;
        }

        // ⚠️ 중요: 자동화 안전성 체크 (AI_자동화_기능_정리.md Section 10.4)
        const safetyCheck = await checkAndUpdateAutomationSafety(
          supabase,
          tenant.id,
          'create_report',
          kstTime,
          `auto_notification.${eventType}.throttle.daily_limit`
        );
        if (!safetyCheck.canExecute) {
          console.warn(`[${eventType}] Skipping due to safety check: ${safetyCheck.reason}`);
          continue;
        }

        // 지난 달 데이터 수집
        const lastMonth = new Date(kstTime.getFullYear(), kstTime.getMonth() - 1, 1);
        const lastMonthStr = toKSTMonth(lastMonth);
        const lastMonthStart = `${lastMonthStr}-01`;
        const lastMonthEnd = toKSTDate(new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0));

        // 지난 달 통계
        const { data: invoices } = await withTenant(
          supabase
            .from('invoices')
            .select('amount, amount_paid')
            .gte('period_start', lastMonthStart)
            .lte('period_start', lastMonthEnd),
          tenant.id
        );

        const { data: attendanceLogs } = await withTenant(
          supabase
            .from('attendance_logs')
            .select('status')
            .gte('occurred_at', `${lastMonthStart}T00:00:00`)
            .lte('occurred_at', `${lastMonthEnd}T23:59:59`),
          tenant.id
        );

        const { data: students } = await withTenant(
          supabase
            .from('persons')
            .select('id')
            .eq('person_type', 'student')
            .eq('status', 'active'),
          tenant.id
        );

        const revenue = invoices?.reduce((sum: number, inv: any) => sum + (inv.amount_paid || 0), 0) || 0;
        const attendanceCount = attendanceLogs?.filter((log: any) => log.status === 'present').length || 0;
        const studentCount = students?.length || 0;

        // 월간 리포트 생성 (AI 브리핑으로 저장)
        await supabase.from('ai_insights').insert({
          tenant_id: tenant.id,
          insight_type: 'daily_briefing',
          title: `${lastMonthStr} 월간 사업 리포트`,
          summary: `지난 달 학생 ${studentCount}명, 출석 ${attendanceCount}건, 매출 ${revenue.toLocaleString()}원`,
          created_at: kstTime.toISOString(),
        });

        totalGenerated++;
      } catch (error) {
        console.error(`[Monthly Business Report] Error for tenant ${tenant.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ success: true, generated_count: totalGenerated }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Monthly Business Report] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

