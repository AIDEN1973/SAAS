/**
 * 데이터 무결성 보정을 위한 Backfill Edge Function
 *
 * 목적: 과거 날짜 범위의 일일 통계를 재집계하여 데이터 무결성 문제 해결
 * 호출: 수동 호출 (관리자 권한)
 *
 * [불변 규칙] Service Role Key만 허용 (보안)
 * [불변 규칙] Query parameter로 start_date, end_date 받기
 * [불변 규칙] daily-statistics-update의 로직을 재사용
 * [불변 규칙] 진행상황을 로그로 출력
 *
 * 참고: daily-statistics-update/index.ts의 로직 복사 후 날짜 루프 추가
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getTenantSettingByPath } from '../_shared/policy-utils.ts';
import { withTenant } from '../_shared/withTenant.ts';
import { envServer } from '../_shared/env-registry.ts';
import { toKSTDate, toKST } from '../_shared/date-utils.ts';
import { logError, createErrorLogEntry } from '../_shared/error-tracking.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * 날짜 범위 생성 헬퍼
 * @param startDateStr - 시작 날짜 (YYYY-MM-DD)
 * @param endDateStr - 종료 날짜 (YYYY-MM-DD)
 * @returns 날짜 배열
 */
function generateDateRange(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);

  const startDate = new Date(startYear, startMonth - 1, startDay);
  const endDate = new Date(endYear, endMonth - 1, endDay);

  // 종료 날짜를 포함하도록 +1일
  endDate.setDate(endDate.getDate() + 1);

  for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }

  return dates;
}

/**
 * 단일 날짜의 통계 재집계
 */
async function backfillSingleDate(
  supabase: ReturnType<typeof createClient>,
  dateKst: string
): Promise<{ storeUpdated: number; regionUpdated: number }> {
  let storeUpdated = 0;
  let regionUpdated = 0;

  console.log(`[Backfill] Processing date: ${dateKst}`);

  try {
    // ============================================================================
    // 매장 통계 재집계 (analytics.daily_store_metrics)
    // ============================================================================

    // 모든 활성 테넌트 조회
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, industry_type')
      .eq('status', 'active');

    if (tenantsError) {
      throw new Error(`Failed to fetch tenants: ${tenantsError.message}`);
    }

    if (!tenants || tenants.length === 0) {
      console.log(`[Backfill] No active tenants for ${dateKst}`);
      return { storeUpdated: 0, regionUpdated: 0 };
    }

    for (const tenant of tenants) {
      try {
        // 학생 수 통계 (전체, 활성, 비활성)
        const { data: allStudents, error: allStudentsError } = await withTenant(
          supabase
          .from('persons')
          .select('id, status', { count: 'exact' })
          .eq('person_type', 'student'),
          tenant.id
        );

        const studentCount = allStudentsError ? 0 : (allStudents?.length || 0);
        const activeStudentCount = allStudentsError ? 0 : (allStudents?.filter((s: { status: string }) => s.status === 'active').length || 0);
        const inactiveStudentCount = allStudentsError ? 0 : (allStudents?.filter((s: { status: string }) => s.status === 'inactive').length || 0);

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
        const lateCount = attendanceError ? 0 : (attendanceLogs?.filter((log: { status: string }) => log.status === 'late').length || 0);
        const absentCount = attendanceError ? 0 : (attendanceLogs?.filter((log: { status: string }) => log.status === 'absent').length || 0);

        // 출석률, 지각률, 결석률 계산
        const attendanceRate = studentCount > 0 ? (attendanceCount / studentCount) * 100 : 0;
        const lateRate = studentCount > 0 ? (lateCount / studentCount) * 100 : 0;
        const absentRate = studentCount > 0 ? (absentCount / studentCount) * 100 : 0;

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

        // 반 통계 조회
        const { data: classes, error: classesError } = await withTenant(
          supabase
          .from('classes')
          .select('current_count, capacity')
          .eq('status', 'active'),
          tenant.id
        );

        let avgStudentsPerClass = 0;
        let avgCapacityRate = 0;
        if (!classesError && classes && classes.length > 0) {
          const totalStudentsInClasses = classes.reduce((sum: number, cls: { current_count?: number }) => sum + (cls.current_count || 0), 0);
          const totalCapacity = classes.reduce((sum: number, cls: { capacity?: number }) => sum + (cls.capacity || 0), 0);
          avgStudentsPerClass = classes.length > 0 ? totalStudentsInClasses / classes.length : 0;
          avgCapacityRate = totalCapacity > 0 ? (totalStudentsInClasses / totalCapacity) * 100 : 0;
        }

        // ARPU 계산 (학생 1인당 평균 매출)
        const arpu = studentCount > 0 ? revenue / studentCount : 0;

        // 통계 업데이트 (analytics.daily_store_metrics 테이블 사용, 정본)
        const { error: upsertError } = await supabase
          .from('analytics.daily_store_metrics')
          .upsert({
            tenant_id: tenant.id,
            date_kst: dateKst,
            student_count: studentCount,
            revenue: revenue,
            attendance_rate: attendanceRate,
            new_enrollments: 0, // 신규 등록 수는 별도 계산 필요 (현재는 0)
            late_rate: lateRate,
            absent_rate: absentRate,
            active_student_count: activeStudentCount,
            inactive_student_count: inactiveStudentCount,
            avg_students_per_class: avgStudentsPerClass,
            avg_capacity_rate: avgCapacityRate,
            arpu: arpu,
            updated_at: toKST().toISOString(),
          }, {
            onConflict: 'tenant_id,date_kst',
          });

        if (!upsertError) {
          storeUpdated++;
          console.log(`[Backfill] Updated metrics for tenant ${tenant.id} on ${dateKst}`);
        } else {
          console.error(`[Backfill] Failed to update for tenant ${tenant.id} on ${dateKst}:`, upsertError);
        }

      } catch (error) {
        console.error(`[Backfill] Error processing tenant ${tenant.id}:`, error);
        // P0-2: Error Tracking 추가
        await logError(supabase, createErrorLogEntry(
          error,
          'analytics-backfill',
          tenant.id,
          { phase: 'tenant_processing', date_kst: dateKst }
        ));
      }
    }

    // ============================================================================
    // 지역별 통계 재집계 (analytics.daily_region_metrics)
    // ============================================================================
    console.log(`[Backfill] Starting regional aggregation for ${dateKst}`);

    try {
      // 지역별 집계를 위해 테넌트별로 위치 정보 조회
      const { data: tenantLocations, error: locationsError } = await supabase
        .from('tenant_settings')
        .select('tenant_id, value')
        .eq('key', 'config');

      if (locationsError) {
        console.error('[Backfill] Failed to fetch tenant locations:', locationsError);
      } else {
        // 지역 코드별로 그룹화 (location_code, sigungu_code, sido_code)
        const locationMap = new Map<string, { tenants: string[]; level: 'dong' | 'gu_gun' | 'si' }>();

        for (const setting of tenantLocations || []) {
          const config = setting.value as { location?: { location_code?: string; sigungu_code?: string; sido_code?: string } };
          const location = config?.location;

          if (location?.location_code) {
            // 동 단위
            const key = `dong:${location.location_code}`;
            if (!locationMap.has(key)) {
              locationMap.set(key, { tenants: [], level: 'dong' });
            }
            locationMap.get(key)!.tenants.push(setting.tenant_id);
          }

          if (location?.sigungu_code) {
            // 구/군 단위
            const key = `gu_gun:${location.sigungu_code}`;
            if (!locationMap.has(key)) {
              locationMap.set(key, { tenants: [], level: 'gu_gun' });
            }
            locationMap.get(key)!.tenants.push(setting.tenant_id);
          }

          if (location?.sido_code) {
            // 시/도 단위
            const key = `si:${location.sido_code}`;
            if (!locationMap.has(key)) {
              locationMap.set(key, { tenants: [], level: 'si' });
            }
            locationMap.get(key)!.tenants.push(setting.tenant_id);
          }
        }

        // 각 지역별로 집계
        for (const [key, { tenants: tenantIds, level }] of locationMap.entries()) {
          const [regionLevel, regionCode] = key.split(':');

          // 최소 샘플 수 조건 (통계문서 FR-03)
          if (tenantIds.length < 3) {
            console.log(`[Backfill] Skipping ${regionCode} (${regionLevel}): only ${tenantIds.length} tenants`);
            continue;
          }

          try {
            // 해당 지역의 매장 통계 조회
            const { data: storeMetrics, error: metricsError } = await supabase
              .from('daily_store_metrics')
              .select('*')
              .eq('date_kst', dateKst)
              .in('tenant_id', tenantIds);

            if (metricsError) {
              console.error(`[Backfill] Failed to fetch metrics for ${regionCode}:`, metricsError);
              continue;
            }

            if (!storeMetrics || storeMetrics.length === 0) {
              console.log(`[Backfill] No metrics for ${regionCode} on ${dateKst}`);
              continue;
            }

            // 집계 계산
            const tenantCount = storeMetrics.length;
            const studentCount = storeMetrics.reduce((sum: number, m: any) => sum + (m.student_count || 0), 0);
            const totalRevenue = storeMetrics.reduce((sum: number, m: any) => sum + (m.revenue || 0), 0);
            const avgArpu = storeMetrics.reduce((sum: number, m: any) => sum + (m.arpu || 0), 0) / tenantCount;
            const avgAttendanceRate = storeMetrics.reduce((sum: number, m: any) => sum + (m.attendance_rate || 0), 0) / tenantCount;

            // Percentile 계산 (attendance_rate)
            const attendanceRates = storeMetrics.map((m: any) => m.attendance_rate || 0).sort((a: number, b: number) => a - b);
            const p25Index = Math.floor(attendanceRates.length * 0.25);
            const p75Index = Math.floor(attendanceRates.length * 0.75);
            const attendanceRateP25 = attendanceRates[p25Index] || 0;
            const attendanceRateP75 = attendanceRates[p75Index] || 0;

            // 성장률 계산 (전월 대비)
            const lastMonthDate = new Date(new Date(dateKst).getTime() - 30 * 24 * 60 * 60 * 1000);
            const lastMonthDateKst = toKSTDate(lastMonthDate);

            const { data: lastMonthMetrics } = await supabase
              .from('daily_store_metrics')
              .select('student_count, revenue')
              .eq('date_kst', lastMonthDateKst)
              .in('tenant_id', tenantIds);

            let studentGrowthRateAvg = 0;
            let revenueGrowthRateAvg = 0;
            let studentGrowthRateP75 = 0;
            let revenueGrowthRateP75 = 0;

            if (lastMonthMetrics && lastMonthMetrics.length > 0) {
              const lastMonthStudentCount = lastMonthMetrics.reduce((sum: number, m: any) => sum + (m.student_count || 0), 0);
              const lastMonthRevenue = lastMonthMetrics.reduce((sum: number, m: any) => sum + (m.revenue || 0), 0);

              if (lastMonthStudentCount > 0) {
                studentGrowthRateAvg = ((studentCount - lastMonthStudentCount) / lastMonthStudentCount) * 100;
              }
              if (lastMonthRevenue > 0) {
                revenueGrowthRateAvg = ((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
              }

              // 성장률 분위수 계산
              const studentGrowthRates = storeMetrics.map((m: any) => {
                const lastMonth = lastMonthMetrics.find((lm: any) => lm.tenant_id === m.tenant_id);
                if (!lastMonth || lastMonth.student_count === 0) return 0;
                return ((m.student_count - lastMonth.student_count) / lastMonth.student_count) * 100;
              }).sort((a: number, b: number) => a - b);

              const revenueGrowthRates = storeMetrics.map((m: any) => {
                const lastMonth = lastMonthMetrics.find((lm: any) => lm.tenant_id === m.tenant_id);
                if (!lastMonth || lastMonth.revenue === 0) return 0;
                return ((m.revenue - lastMonth.revenue) / lastMonth.revenue) * 100;
              }).sort((a: number, b: number) => a - b);

              studentGrowthRateP75 = studentGrowthRates[p75Index] || 0;
              revenueGrowthRateP75 = revenueGrowthRates[p75Index] || 0;
            }

            // analytics.daily_region_metrics에 저장
            const { error: regionUpsertError } = await supabase
              .from('daily_region_metrics')
              .upsert({
                region_code: regionCode,
                region_level: level,
                industry_type: 'academy', // 현재는 academy만 지원
                tenant_count: tenantCount,
                student_count: studentCount,
                avg_arpu: avgArpu,
                avg_attendance_rate: avgAttendanceRate,
                attendance_rate_p25: attendanceRateP25,
                attendance_rate_p75: attendanceRateP75,
                student_growth_rate_avg: studentGrowthRateAvg,
                revenue_growth_rate_avg: revenueGrowthRateAvg,
                student_growth_rate_p75: studentGrowthRateP75,
                revenue_growth_rate_p75: revenueGrowthRateP75,
                date_kst: dateKst,
                updated_at: toKST().toISOString(),
              }, {
                onConflict: 'region_code,region_level,industry_type,date_kst',
              });

            if (!regionUpsertError) {
              regionUpdated++;
              console.log(`[Backfill] Updated ${regionCode} (${level}) on ${dateKst}: ${tenantCount} tenants`);
            } else {
              console.error(`[Backfill] Failed to update ${regionCode} on ${dateKst}:`, regionUpsertError);
            }

          } catch (error) {
            console.error(`[Backfill] Error processing ${regionCode} on ${dateKst}:`, error);
            // P0-2: Error Tracking 추가
            await logError(supabase, createErrorLogEntry(
              error,
              'analytics-backfill',
              undefined,
              { phase: 'regional_aggregation', region_code: regionCode, region_level: level, date_kst: dateKst }
            ));
          }
        }

        console.log(`[Backfill] Regional aggregation completed for ${dateKst}: ${regionUpdated} regions updated`);
      }
    } catch (error) {
      console.error('[Backfill] Fatal error in regional aggregation:', error);
      // P0-2: Error Tracking 추가
      await logError(supabase, createErrorLogEntry(
        error,
        'analytics-backfill',
        undefined,
        { phase: 'regional_aggregation_fatal', date_kst: dateKst },
        'critical'
      ));
    }

  } catch (error) {
    console.error(`[Backfill] Fatal error processing ${dateKst}:`, error);
    // P0-2: Error Tracking 추가
    await logError(supabase, createErrorLogEntry(
      error,
      'analytics-backfill',
      undefined,
      { phase: 'date_processing_fatal', date_kst: dateKst },
      'critical'
    ));
  }

  return { storeUpdated, regionUpdated };
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
    // ============================================================================
    // [불변 규칙] Service Role Key만 허용 (보안)
    // ============================================================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization header required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const token = authHeader.substring(7);
    const serviceRoleKey = envServer.SERVICE_ROLE_KEY;

    // Bearer token이 Service Role Key와 일치하는지 확인
    if (token !== serviceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or insufficient permissions' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Supabase 클라이언트 초기화 (Service Role Key 사용)
    const supabase = createClient(envServer.SUPABASE_URL, serviceRoleKey);

    // ============================================================================
    // Query parameter에서 start_date, end_date 받기
    // ============================================================================
    const url = new URL(req.url);
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    if (!startDate || !endDate) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Query parameters required: start_date (YYYY-MM-DD), end_date (YYYY-MM-DD)'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 날짜 형식 검증
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 날짜 범위 검증
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'start_date must be less than or equal to end_date'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 과도한 범위 방지 (최대 90일)
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 90) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Date range exceeds maximum of 90 days'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`[Backfill] Starting backfill from ${startDate} to ${endDate}`);

    // ============================================================================
    // 날짜 루프를 통해 각 날짜별로 통계 재집계
    // ============================================================================
    const dates = generateDateRange(startDate, endDate);
    let totalStoreUpdated = 0;
    let totalRegionUpdated = 0;

    for (const dateKst of dates) {
      const { storeUpdated, regionUpdated } = await backfillSingleDate(supabase, dateKst);
      totalStoreUpdated += storeUpdated;
      totalRegionUpdated += regionUpdated;
    }

    console.log(
      `[Backfill] Completed: ${dates.length} dates processed, ` +
      `${totalStoreUpdated} store metrics updated, ${totalRegionUpdated} region metrics updated`
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `Backfill completed for ${dates.length} dates`,
        dates_processed: dates.length,
        store_metrics_updated: totalStoreUpdated,
        region_metrics_updated: totalRegionUpdated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Backfill] Fatal error:', error);

    // P0-2: Error Tracking 추가 (Fatal Error)
    const supabase = createClient(envServer.SUPABASE_URL, envServer.SERVICE_ROLE_KEY);
    await logError(supabase, createErrorLogEntry(
      error,
      'analytics-backfill',
      undefined,
      { phase: 'fatal', is_manual_invocation: true },
      'critical'
    ));

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
