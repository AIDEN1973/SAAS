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
import { withTenant } from '../_shared/withTenant.ts';
import { envServer } from '../_shared/env-registry.ts';
import { toKSTDate, toKST } from '../_shared/date-utils.ts';

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
    const yesterday = new Date(kstTime.getTime() - 24 * 60 * 60 * 1000);
    const dateKst = toKSTDate(yesterday);

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
        const { data: students, error: studentsError } = await withTenant(
          supabase
          .from('persons')
          .select('id', { count: 'exact', head: true })
          .eq('person_type', 'student')
            .eq('status', 'active'),
          tenant.id
        );

        const studentCount = studentsError ? 0 : (students?.length || 0);

        // 출석 통계
        const { data: attendanceLogs, error: attendanceError } = await withTenant(
          supabase
          .from('attendance_logs')
          .select('status')
          .gte('occurred_at', `${dateKst}T00:00:00`)
            .lte('occurred_at', `${dateKst}T23:59:59`),
          tenant.id
        );

        const attendanceCount = attendanceError ? 0 : (attendanceLogs?.filter((log: { status: string }) => log.status === 'present').length || 0);
        const absentCount = attendanceError ? 0 : (attendanceLogs?.filter((log: { status: string }) => log.status === 'absent').length || 0);

        // 매출 통계
        const { data: invoices, error: invoicesError } = await withTenant(
          supabase
          .from('invoices')
          .select('amount_paid')
          .gte('period_start', dateKst)
            .lte('period_start', dateKst),
          tenant.id
        );

        const revenue = invoicesError
          ? 0
          : (invoices?.reduce((sum: number, inv: { amount_paid?: number }) => sum + (inv.amount_paid || 0), 0) || 0);

        // 통계 업데이트 (analytics.daily_store_metrics 테이블 사용, 정본)
        // ⚠️ 참고: analytics.daily_metrics는 구버전/폐기된 네이밍입니다.
        const { error: upsertError } = await supabase
          .from('analytics.daily_store_metrics')  // 정본: daily_metrics는 구버전
          .upsert({
            tenant_id: tenant.id,
            date_kst: dateKst,
            student_count: studentCount,
            attendance_count: attendanceCount,
            absent_count: absentCount,
            revenue: revenue,
            industry_type: tenant.industry_type,
            updated_at: toKST().toISOString(),
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
