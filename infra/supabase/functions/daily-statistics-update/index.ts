/**
 * 일일 통계 업데이트 배치 작업
 *
 * 아키텍처 문서 6.10 섹션 참조
 * 스케줄: 매일 23:59 KST (Supabase cron 설정 필요)
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

    // KST 기준 어제 날짜 계산
    const now = new Date();
    const kstOffset = 9 * 60;
    const kstTime = new Date(now.getTime() + (kstOffset * 60 * 1000));
    const yesterday = new Date(kstTime.getTime() - 24 * 60 * 60 * 1000);
    const dateKst = yesterday.toISOString().slice(0, 10);

    console.log(`[Daily Statistics] Starting update for ${dateKst}`);

    // 모든 활성 테넌트 조회
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, industry_type')
      .eq('status', 'active');

    if (tenantsError) {
      throw new Error(`Failed to fetch tenants: ${tenantsError.message}`);
    }

    if (!tenants || tenants.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active tenants', updated_count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalUpdated = 0;

    for (const tenant of tenants) {
      try {
        // 학생 수 통계
        const { data: students, error: studentsError } = await supabase
          .from('persons')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .eq('person_type', 'student')
          .eq('status', 'active');

        const studentCount = studentsError ? 0 : (students?.length || 0);

        // 출석 통계
        const { data: attendanceLogs, error: attendanceError } = await supabase
          .from('attendance_logs')
          .select('status')
          .eq('tenant_id', tenant.id)
          .gte('occurred_at', `${dateKst}T00:00:00`)
          .lte('occurred_at', `${dateKst}T23:59:59`);

        const attendanceCount = attendanceError ? 0 : (attendanceLogs?.filter((log: any) => log.status === 'present').length || 0);
        const absentCount = attendanceError ? 0 : (attendanceLogs?.filter((log: any) => log.status === 'absent').length || 0);

        // 매출 통계
        const { data: invoices, error: invoicesError } = await supabase
          .from('invoices')
          .select('amount_paid')
          .eq('tenant_id', tenant.id)
          .gte('period_start', dateKst)
          .lte('period_start', dateKst);

        const revenue = invoicesError
          ? 0
          : (invoices?.reduce((sum: number, inv: any) => sum + (inv.amount_paid || 0), 0) || 0);

        // 통계 업데이트 (daily_metrics 테이블이 있다고 가정)
        // 실제 테이블 구조에 맞게 수정 필요
        const { error: upsertError } = await supabase
          .from('daily_metrics')
          .upsert({
            tenant_id: tenant.id,
            date_kst: dateKst,
            student_count: studentCount,
            attendance_count: attendanceCount,
            absent_count: absentCount,
            revenue: revenue,
            industry_type: tenant.industry_type,
            updated_at: kstTime.toISOString(),
          }, {
            onConflict: 'tenant_id,date_kst',
          });

        if (!upsertError) {
          totalUpdated++;
          console.log(`[Daily Statistics] Updated metrics for tenant ${tenant.id}`);
        } else {
          console.error(`[Daily Statistics] Failed to update for tenant ${tenant.id}:`, upsertError);
        }

      } catch (error) {
        console.error(`[Daily Statistics] Error processing tenant ${tenant.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated_count: totalUpdated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Daily Statistics] Fatal error:', error);
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




