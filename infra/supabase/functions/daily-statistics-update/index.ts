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
        // ⚠️ 참고: analytics.daily_metrics는 구버전/폐기된 네이밍입니다.
        const { error: upsertError } = await supabase
          .from('analytics.daily_store_metrics')  // 정본: daily_metrics는 구버전
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





                                                                                                                                                                                                                                                                                                                
