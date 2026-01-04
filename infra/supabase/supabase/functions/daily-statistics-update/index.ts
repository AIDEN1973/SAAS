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
import { getTenantSettingByPath } from '../_shared/policy-utils.ts';
import { assertAutomationEventType } from '../_shared/automation-event-catalog.ts';
import { withTenant } from '../_shared/withTenant.ts';
import { envServer } from '../_shared/env-registry.ts';
import { toKSTDate, toKST, toKSTMonth } from '../_shared/date-utils.ts';
import { checkAndUpdateAutomationSafety } from '../_shared/automation-safety.ts';
import { logError, createErrorLogEntry } from '../_shared/error-tracking.ts';

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

        // Phase 1: 신규 등록 수 계산 (이번 달 등록한 학생 수)
        const currentMonthStart = toKSTMonth(kstTime);
        const { data: newStudents, error: newStudentsError } = await withTenant(
          supabase
          .from('persons')
          .select('id')
          .eq('person_type', 'student')
          .gte('created_at', `${currentMonthStart}-01T00:00:00`)
          .lte('created_at', `${dateKst}T23:59:59`),
          tenant.id
        );
        const newEnrollments = newStudentsError ? 0 : (newStudents?.length || 0);

        // Phase 2: 미납률 계산 (미납액 / 전체 청구액)
        const { data: allInvoices, error: allInvoicesError } = await withTenant(
          supabase
          .from('invoices')
          .select('amount, amount_paid')
          .gte('period_start', dateKst)
          .lte('period_start', dateKst),
          tenant.id
        );
        let overdueRate = 0;
        if (!allInvoicesError && allInvoices && allInvoices.length > 0) {
          const totalBilled = allInvoices.reduce((sum: number, inv: { amount?: number }) => sum + (inv.amount || 0), 0);
          const totalPaid = allInvoices.reduce((sum: number, inv: { amount_paid?: number }) => sum + (inv.amount_paid || 0), 0);
          const overdue = totalBilled - totalPaid;
          overdueRate = totalBilled > 0 ? (overdue / totalBilled) * 100 : 0;
        }

        // Phase 3: 퇴원율 계산 (이탈 학생 수 / 전체 학생 수)
        const churnedStudentCount = allStudentsError ? 0 : (allStudents?.filter((s: { status: string }) => s.status === 'churned' || s.status === 'inactive').length || 0);
        const churnRate = studentCount > 0 ? (churnedStudentCount / (studentCount + churnedStudentCount)) * 100 : 0;

        // 통계 업데이트 (analytics.daily_store_metrics 테이블 사용, 정본)
        // ⚠️ 참고: analytics.daily_metrics는 구버전/폐기된 네이밍입니다.
        const { error: upsertError } = await supabase
          .schema('analytics')
          .from('daily_store_metrics')  // 정본: daily_metrics는 구버전
          .upsert({
            tenant_id: tenant.id,
            date_kst: dateKst,
            student_count: studentCount,
            revenue: revenue,
            attendance_rate: attendanceRate,
            new_enrollments: newEnrollments, // Phase 1: 실제 계산값 사용
            late_rate: lateRate,
            absent_rate: absentRate,
            active_student_count: activeStudentCount,
            inactive_student_count: inactiveStudentCount,
            avg_students_per_class: avgStudentsPerClass,
            avg_capacity_rate: avgCapacityRate,
            arpu: arpu,
            // Phase 2-3: 추가 메트릭 저장
            overdue_rate: overdueRate,
            churn_rate: churnRate,
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

        // revenue_target_under 처리 (매일 07:10 실행)
        // AI_자동화_기능_정리.md Section 11: revenue_target_under
        const hour = kstTime.getHours();
        const minute = kstTime.getMinutes();
        if (hour === 7 && minute >= 10 && minute < 20) {
          const eventType = 'revenue_target_under';
          assertAutomationEventType(eventType);

          const enabled = await getTenantSettingByPath(
            supabase,
            tenant.id,
            `auto_notification.${eventType}.enabled`
          );
          if (enabled === true) {
            // ⚠️ 중요: 자동화 안전성 체크 (AI_자동화_기능_정리.md Section 10.4)
            const safetyCheck = await checkAndUpdateAutomationSafety(
              supabase,
              tenant.id,
              'create_task',
              kstTime,
              `auto_notification.${eventType}.throttle.daily_limit`
            );
            if (!safetyCheck.canExecute) {
              console.warn(`[${eventType}] Skipping due to safety check: ${safetyCheck.reason}`);
            } else {
              // Policy에서 월 목표 매출 조회
              const monthlyTarget = await getTenantSettingByPath(
                supabase,
              tenant.id,
              `auto_notification.${eventType}.monthly_target`
              ) as number;

              if (monthlyTarget && typeof monthlyTarget === 'number') {
              const currentMonth = toKSTMonth(kstTime);
              const dayOfMonth = kstTime.getDate();
              const daysInMonth = new Date(kstTime.getFullYear(), kstTime.getMonth() + 1, 0).getDate();
              const expectedRevenue = (monthlyTarget / daysInMonth) * dayOfMonth;

              // 이번 달 현재 매출
              const { data: currentInvoices } = await withTenant(
                supabase
                  .from('invoices')
                  .select('amount_paid')
                  .gte('period_start', `${currentMonth}-01`)
                  .lte('period_start', toKSTDate(kstTime)),
                tenant.id
              );

              const currentRevenue = currentInvoices
                ? currentInvoices.reduce((sum: number, inv: any) => sum + (inv.amount_paid || 0), 0)
                : 0;

              if (currentRevenue < expectedRevenue) {
                const dedupKey = `${tenant.id}:${eventType}:tenant:${tenant.id}:${toKSTDate(kstTime)}`;
                await supabase.from('student_task_cards').upsert({
                  tenant_id: tenant.id,
                  task_type: 'risk',
                  title: '월 매출 목표 미달',
                  description: `이번 달 현재 매출이 목표 대비 ${((expectedRevenue - currentRevenue) / expectedRevenue * 100).toFixed(1)}% 부족합니다.`,
                  priority: 75,
                  risk_level: 'low', // Phase 2: Low-Risk (내부 알림만)
                  dedup_key: dedupKey,
                  expires_at: new Date(kstTime.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                }, {
                  onConflict: 'tenant_id,dedup_key',
                  ignoreDuplicates: false,
                });
              }
            }
          }
          }
        }

      } catch (error) {
        console.error(`[Daily Statistics] Error processing tenant ${tenant.id}:`, error);
        // P0-2: Error Tracking 추가
        await logError(supabase, createErrorLogEntry(
          error,
          'daily-statistics-update',
          tenant.id,
          { phase: 'tenant_processing', date_kst: dateKst }
        ));
      }
    }

    // ============================================================================
    // P0-1: 지역별 통계 집계 (analytics.daily_region_metrics)
    // ============================================================================
    // [불변 규칙] 통계문서 FR-05, 아키텍처 문서 3.6.5 준수
    // [요구사항] 동/구/시 단위 지역별 집계, 최소 샘플 수 조건 (>= 3)
    console.log(`[Daily Statistics] Starting regional aggregation for ${dateKst}`);

    let regionalUpdated = 0;
    try {
      // 지역별 집계를 위해 테넌트별로 위치 정보 조회
      const { data: tenantLocations, error: locationsError } = await supabase
        .from('tenant_settings')
        .select('tenant_id, value')
        .eq('key', 'config');

      if (locationsError) {
        console.error('[Regional Aggregation] Failed to fetch tenant locations:', locationsError);
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
            console.log(`[Regional Aggregation] Skipping ${regionCode} (${regionLevel}): only ${tenantIds.length} tenants`);
            continue;
          }

          try {
            // 해당 지역의 매장 통계 조회
            const { data: storeMetrics, error: metricsError } = await supabase
              .schema('analytics')
              .from('daily_store_metrics')
              .select('*')
              .eq('date_kst', dateKst)
              .in('tenant_id', tenantIds);

            if (metricsError) {
              console.error(`[Regional Aggregation] Failed to fetch metrics for ${regionCode}:`, metricsError);
              continue;
            }

            if (!storeMetrics || storeMetrics.length === 0) {
              console.log(`[Regional Aggregation] No metrics for ${regionCode}`);
              continue;
            }

            // 집계 계산
            const tenantCount = storeMetrics.length;
            const studentCount = storeMetrics.reduce((sum: number, m: any) => sum + (m.student_count || 0), 0);
            const totalRevenue = storeMetrics.reduce((sum: number, m: any) => sum + (m.revenue || 0), 0);
            const avgArpu = storeMetrics.reduce((sum: number, m: any) => sum + (m.arpu || 0), 0) / tenantCount;
            const avgAttendanceRate = storeMetrics.reduce((sum: number, m: any) => sum + (m.attendance_rate || 0), 0) / tenantCount;

            // Phase 1-3: 추가 메트릭 평균 계산 (마이그레이션 158)
            const avgNewEnrollments = storeMetrics.reduce((sum: number, m: any) => sum + (m.new_enrollments || 0), 0) / tenantCount;
            const avgCapacityRate = storeMetrics.reduce((sum: number, m: any) => sum + (m.avg_capacity_rate || 0), 0) / tenantCount;
            const avgLateRate = storeMetrics.reduce((sum: number, m: any) => sum + (m.late_rate || 0), 0) / tenantCount;
            const avgAbsentRate = storeMetrics.reduce((sum: number, m: any) => sum + (m.absent_rate || 0), 0) / tenantCount;

            // Phase 2: 미납률, 퇴원율 계산 (store_metrics에 컬럼이 있다고 가정, 없으면 0)
            const avgOverdueRate = storeMetrics.reduce((sum: number, m: any) => sum + (m.overdue_rate || 0), 0) / tenantCount;
            const avgChurnRate = storeMetrics.reduce((sum: number, m: any) => sum + (m.churn_rate || 0), 0) / tenantCount;

            // Percentile 계산 도우미 함수
            const p25Index = Math.floor(storeMetrics.length * 0.25);
            const p75Index = Math.floor(storeMetrics.length * 0.75);

            const calculatePercentiles = (values: number[]) => {
              const sorted = [...values].sort((a, b) => a - b);
              return {
                p25: sorted[p25Index] || 0,
                p75: sorted[p75Index] || 0,
              };
            };

            // Percentile 계산 (기존 메트릭)
            const attendanceRates = storeMetrics.map((m: any) => m.attendance_rate || 0);
            const attendancePercentiles = calculatePercentiles(attendanceRates);
            const attendanceRateP25 = attendancePercentiles.p25;
            const attendanceRateP75 = attendancePercentiles.p75;

            // Phase 1-3: 신규 메트릭 Percentile 계산
            const newEnrollmentsPercentiles = calculatePercentiles(storeMetrics.map((m: any) => m.new_enrollments || 0));
            const arpuPercentiles = calculatePercentiles(storeMetrics.map((m: any) => m.arpu || 0));
            const capacityRatePercentiles = calculatePercentiles(storeMetrics.map((m: any) => m.avg_capacity_rate || 0));
            const overdueRatePercentiles = calculatePercentiles(storeMetrics.map((m: any) => m.overdue_rate || 0));
            const churnRatePercentiles = calculatePercentiles(storeMetrics.map((m: any) => m.churn_rate || 0));
            const lateRatePercentiles = calculatePercentiles(storeMetrics.map((m: any) => m.late_rate || 0));
            const absentRatePercentiles = calculatePercentiles(storeMetrics.map((m: any) => m.absent_rate || 0));

            // 성장률 계산 (전월 대비)
            const lastMonthDate = new Date(yesterday.getTime() - 30 * 24 * 60 * 60 * 1000);
            const lastMonthDateKst = toKSTDate(lastMonthDate);

            const { data: lastMonthMetrics } = await supabase
              .schema('analytics')
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
              .schema('analytics')
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
                // Phase 1-3 메트릭 추가 (마이그레이션 158)
                new_enrollments_avg: avgNewEnrollments,
                new_enrollments_p25: newEnrollmentsPercentiles.p25,
                new_enrollments_p75: newEnrollmentsPercentiles.p75,
                arpu_avg: avgArpu, // avg_arpu와 arpu_avg 중복 (마이그레이션 158에서 rename)
                arpu_p25: arpuPercentiles.p25,
                arpu_p75: arpuPercentiles.p75,
                capacity_rate_avg: avgCapacityRate,
                capacity_rate_p25: capacityRatePercentiles.p25,
                capacity_rate_p75: capacityRatePercentiles.p75,
                overdue_rate_avg: avgOverdueRate,
                overdue_rate_p25: overdueRatePercentiles.p25,
                overdue_rate_p75: overdueRatePercentiles.p75,
                churn_rate_avg: avgChurnRate,
                churn_rate_p25: churnRatePercentiles.p25,
                churn_rate_p75: churnRatePercentiles.p75,
                late_rate_avg: avgLateRate,
                late_rate_p25: lateRatePercentiles.p25,
                late_rate_p75: lateRatePercentiles.p75,
                absent_rate_avg: avgAbsentRate,
                absent_rate_p25: absentRatePercentiles.p25,
                absent_rate_p75: absentRatePercentiles.p75,
                date_kst: dateKst,
                updated_at: toKST().toISOString(),
              }, {
                onConflict: 'region_code,region_level,industry_type,date_kst',
              });

            if (!regionUpsertError) {
              regionalUpdated++;
              console.log(`[Regional Aggregation] Updated ${regionCode} (${level}): ${tenantCount} tenants`);
            } else {
              console.error(`[Regional Aggregation] Failed to update ${regionCode}:`, regionUpsertError);
            }

          } catch (error) {
            console.error(`[Regional Aggregation] Error processing ${regionCode}:`, error);
            // P0-2: Error Tracking 추가
            await logError(supabase, createErrorLogEntry(
              error,
              'daily-statistics-update',
              undefined,
              { phase: 'regional_aggregation', region_code: regionCode, region_level: level, date_kst: dateKst }
            ));
          }
        }

        console.log(`[Regional Aggregation] Completed: ${regionalUpdated} regions updated`);
      }
    } catch (error) {
      console.error('[Regional Aggregation] Fatal error:', error);
      // P0-2: Error Tracking 추가
      await logError(supabase, createErrorLogEntry(
        error,
        'daily-statistics-update',
        undefined,
        { phase: 'regional_aggregation_fatal', date_kst: dateKst },
        'critical'
      ));
      // 지역 집계 실패해도 전체 작업은 성공으로 처리 (매장 통계는 이미 업데이트됨)
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated_count: totalUpdated,
        regional_updated_count: regionalUpdated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Daily Statistics] Fatal error:', error);

    // P0-2: Error Tracking 추가 (Fatal Error)
    await logError(supabase, createErrorLogEntry(
      error,
      'daily-statistics-update',
      undefined,
      { phase: 'fatal', is_cron_job: true },
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





                                                                                                                                                                                                                                                                                                                
