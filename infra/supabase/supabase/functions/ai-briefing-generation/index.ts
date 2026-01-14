/**
 * AI 브리핑 카드 생성 작업 (서버가 생성하며 AI 호출 포함)
 *
 * 아키텍처 문서 3.7.1 섹션 참조
 * 스케줄: 매일 07:00 KST (Supabase cron 설정 필요)
 *
 * [불변 규칙] Zero-Management: 사용자 개입 없이 자동 실행
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { shouldUseAI, getTenantSettingByPath } from '../_shared/policy-utils.ts';
import { assertAutomationEventType } from '../_shared/automation-event-catalog.ts';
import { withTenant } from '../_shared/withTenant.ts';
import { envServer } from '../_shared/env-registry.ts';
import { toKSTDate, toKST, toKSTMonth } from '../_shared/date-utils.ts';
import { checkAndUpdateAutomationSafety } from '../_shared/automation-safety.ts';
import { createTaskCardWithDedup } from '../_shared/create-task-card-with-dedup.ts';
import { getTenantTableName } from '../_shared/industry-adapter.ts';

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
    const today = toKSTDate();

    console.log(`[AI Briefing] Starting generation for ${today}`);

    // 기존 오늘 날짜의 브리핑 카드 삭제 (아키텍처 문서 4070-4083줄: 날짜별 1장만 유지)
    const { error: deleteError } = await supabase
      .from('ai_insights')
      .delete()
      .eq('insight_type', 'daily_briefing')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);

    if (deleteError) {
      console.error('[AI Briefing] Failed to delete existing cards:', deleteError);
    }

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
        JSON.stringify({ success: true, message: 'No active tenants', generated_count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalGenerated = 0;

    for (const tenant of tenants) {
      try {
        // ⚠️ 중요: AI 기능 활성화 여부 확인 (SSOT 기준, Fail Closed)
        // Automation Config First 원칙: 기본값 하드코딩 금지, Policy가 없으면 실행하지 않음
        if (!(await shouldUseAI(supabase, tenant.id))) {
          console.log(`[AI Briefing] AI disabled for tenant ${tenant.id}, skipping`);

          // ⚠️ 중요: AI OFF 시 ai_decision_logs에 skipped_by_flag 기록 (SSOT 준수)
          await supabase.from('ai_decision_logs').insert({
            tenant_id: tenant.id,
            model: 'ai_briefing',
            features: { date: today },
            reason: 'AI disabled (PLATFORM_AI_ENABLED or tenant_features disabled)',
            skipped_by_flag: true,
            created_at: new Date().toISOString(),
          }).catch((error) => {
            console.error(`[AI Briefing] Failed to log AI skip decision for tenant ${tenant.id}:`, error);
          });

          continue;
        }

        const insights: Array<{ tenant_id: string; insight_type: string; title: string; summary: string; insights: string; created_at: string; action_url?: string }> = [];

        // 1. 오늘 상담 일정 확인
        const { data: consultations, error: consultationsError } = await withTenant(
          supabase
          .from('student_consultations')
          .select('id')
          .gte('consultation_date', today)
            .limit(10),
          tenant.id
        );

        if (!consultationsError && consultations && consultations.length > 0) {
          insights.push({
            tenant_id: tenant.id,
            insight_type: 'daily_briefing',
            title: '오늘의 상담 일정',
            summary: `오늘 ${consultations.length}건의 상담이 예정되어 있습니다.`,
            insights: JSON.stringify([
              '상담일지를 작성하여 대상 관리를 강화하세요.', // 업종 중립: 학생 → 대상
              '상담 내용을 바탕으로 대상의 진행 방향을 조정할 수 있습니다.', // 업종 중립: 학생 → 대상, 학습 → 진행
            ]),
            action_url: '/ai?tab=consultation',
            created_at: toKST().toISOString(),
          });
        }

        // 2. 이번 달 수납 현황 확인
        const currentMonth = toKSTMonth();
        const { data: invoices, error: invoicesError } = await withTenant(
          supabase
          .from('invoices')
          .select('amount, amount_paid')
            .gte('period_start', `${currentMonth}-01`),
          tenant.id
        );

        if (!invoicesError && invoices && invoices.length > 0) {
          const totalAmount = invoices.reduce((sum: number, inv: { amount?: number }) => sum + (inv.amount || 0), 0);
          const paidAmount = invoices.reduce((sum: number, inv: { amount_paid?: number }) => sum + (inv.amount_paid || 0), 0);
          const expectedCollectionRate = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;

          insights.push({
            tenant_id: tenant.id,
            insight_type: 'daily_briefing',
            title: '이번 달 수납 현황',
            summary: `이번 달 청구서가 자동 발송되었습니다. 예상 수납률은 ${expectedCollectionRate}%입니다.`,
            insights: JSON.stringify([
              expectedCollectionRate >= 90
                ? '수납률이 양호합니다. 현재 운영 방식을 유지하세요.'
                : '수납률 개선이 필요합니다. 미결제 대상에게 연락을 취하세요.', // 업종 중립: 미납 → 미결제, 학생 → 대상
            ]),
            action_url: '/billing/home',
            created_at: toKST().toISOString(),
          });
        }

        // 3. 이상 패턴 확인 (최근 7일, 업종 중립)
        const sevenDaysAgo = toKSTDate(new Date(kstTime.getTime() - 7 * 24 * 60 * 60 * 1000));
        const { data: attendanceLogs, error: attendanceError } = await withTenant(
          supabase
          .from('attendance_logs')
          .select('status')
          .gte('occurred_at', `${sevenDaysAgo}T00:00:00`)
            .limit(100),
          tenant.id
        );

        if (!attendanceError && attendanceLogs) {
          const absentCount = attendanceLogs.filter((log: { status: string }) => log.status === 'absent').length;
          const lateCount = attendanceLogs.filter((log: { status: string }) => log.status === 'late').length;

          if (absentCount > 5 || lateCount > 10) {
            insights.push({
              tenant_id: tenant.id,
              insight_type: 'daily_briefing',
              title: '이상 패턴 감지', // 업종 중립: 출결 이상 → 이상 패턴
              summary: `최근 7일간 미참석 ${absentCount}건, 지연 ${lateCount}건이 발생했습니다.`, // 업종 중립: 결석 → 미참석, 지각 → 지연
              insights: JSON.stringify([
                '이상 패턴을 분석하여 원인을 파악하세요.', // 업종 중립
                '지연이 많은 대상에게 사전 안내를 제공하세요.', // 업종 중립
              ]),
              action_url: '/ai?tab=anomaly', // 업종 중립: attendance → anomaly
              created_at: toKST().toISOString(),
            });
          }
        }

        // 4. 이탈 위험 대상 확인 (업종 중립: 학생 → 대상)
        const { data: riskCards, error: riskError } = await withTenant(
          supabase
          .from('task_cards')
          .select('id, student_id')
          .eq('task_type', 'risk')
            .limit(10),
          tenant.id
        );

        if (!riskError && riskCards && riskCards.length > 0) {
          // 대상자 이름 조회
          const studentIds = riskCards.map(c => c.student_id).filter(Boolean);
          const { data: students } = await withTenant(
            supabase
            .from('persons')
            .select('id, name')
              .in('id', studentIds),
            tenant.id
          );

          const studentNames = students?.slice(0, 5).map(s => s.name).join(', ') || '';
          const moreCount = (students?.length || 0) > 5 ? ` 외 ${(students?.length || 0) - 5}명` : '';
          const detailSummary = studentNames
            ? `이탈 위험: ${studentNames}${moreCount} (총 ${riskCards.length}명)`
            : `${riskCards.length}명의 대상이 이탈 위험 단계입니다.`;

          insights.push({
            tenant_id: tenant.id,
            insight_type: 'daily_briefing',
            title: '이탈 위험 대상 알림', // 업종 중립: 학생 → 대상
            summary: detailSummary,
            insights: JSON.stringify([
              '이탈 위험 대상에게 즉시 상담을 진행하세요.', // 업종 중립: 학생 → 대상
              '대상의 진행 동기를 높이기 위한 방안을 모색하세요.', // 업종 중립: 학생 → 대상, 학습 → 진행
            ]),
            action_url: '/students/home',
            created_at: toKST().toISOString(),
          });
        }

        // ai_suggest_class_merge 처리 (저정원 감지 연계)
        // AI_자동화_기능_정리.md Section 11: ai_suggest_class_merge
        const mergeEventType = 'ai_suggest_class_merge';
        assertAutomationEventType(mergeEventType);

        const mergeEnabled = await getTenantSettingByPath(
          supabase,
          tenant.id,
          `auto_notification.${mergeEventType}.enabled`
        );
        if (mergeEnabled === true) {
          // ⚠️ 중요: 자동화 안전성 체크 (AI_자동화_기능_정리.md Section 10.4)
          const safetyCheck = await checkAndUpdateAutomationSafety(
            supabase,
            tenant.id,
            'create_task',
            kstTime,
            `auto_notification.${mergeEventType}.throttle.daily_limit`
          );
          if (!safetyCheck.canExecute) {
            console.warn(`[${mergeEventType}] Skipping due to safety check: ${safetyCheck.reason}`);
          } else {
            // Policy에서 priority 조회 (Fail-Closed)
            const priorityPolicy = await getTenantSettingByPath(
              supabase,
              tenant.id,
              `auto_notification.${mergeEventType}.priority`
            ) as number | null;
            if (!priorityPolicy || typeof priorityPolicy !== 'number') {
              // Fail Closed: Policy가 없으면 이 테넌트의 merge 처리 건너뛰기
              continue;
            }

            // Policy에서 TTL 조회 (Fail-Closed)
            const ttlDays = await getTenantSettingByPath(
              supabase,
              tenant.id,
              `auto_notification.${mergeEventType}.ttl_days`
            ) as number | null;
            if (!ttlDays || typeof ttlDays !== 'number') {
              // Fail Closed: Policy가 없으면 이 테넌트의 merge 처리 건너뛰기
              continue;
            }

            // Industry Adapter: 업종별 클래스 테이블명 동적 조회
            const classTableName = await getTenantTableName(supabase, tenant.id, 'class');

            // 정원률이 낮은 반 조회
            const { data: lowFillClasses } = await withTenant(
              supabase
                .from(classTableName || 'academy_classes') // Fallback
                .select('id, name, max_students, current_students, start_time')
                .eq('status', 'active'),
              tenant.id
            );

            if (lowFillClasses) {
              const mergeThreshold = await getTenantSettingByPath(
              supabase,
              tenant.id,
              `auto_notification.${mergeEventType}.threshold`
              ) as number;
              if (mergeThreshold && typeof mergeThreshold === 'number') {
              const lowFill = lowFillClasses.filter((cls: any) => {
                const fillRate = cls.max_students > 0
                  ? (cls.current_students / cls.max_students) * 100
                  : 0;
                return fillRate < mergeThreshold;
              });

              if (lowFill.length >= 2) {
                // 시간대가 비슷한 반들을 그룹화하여 통합 제안
                const timeSlotMap = new Map<string, any[]>();
                for (const cls of lowFill) {
                  const hour = cls.start_time.split('T')[1]?.split(':')[0] || '00';
                  const slot = `${hour}:00`;
                  if (!timeSlotMap.has(slot)) {
                    timeSlotMap.set(slot, []);
                  }
                  timeSlotMap.get(slot)!.push(cls);
                }

                for (const [slot, classes] of timeSlotMap.entries()) {
                  if (classes.length >= 2) {
                    const dedupKey = `${tenant.id}:${mergeEventType}:timeslot:${slot}:${toKSTDate(kstTime)}`;
                    // ⚠️ 정본 규칙: 부분 유니크 인덱스 사용 시 Supabase client upsert() 직접 사용 불가
                    // RPC 함수 create_task_card_with_dedup_v1 사용 (프론트 자동화 문서 2.3 섹션 참조)
                    await createTaskCardWithDedup(supabase, {
                      tenant_id: tenant.id,
                      entity_id: tenant.id,  // entity_id = tenantId (entity_type='tenant')
                      entity_type: 'tenant', // entity_type
                      task_type: 'ai_suggested',
                      title: `${slot} 시간대 반 통합 제안`,
                      description: `${slot} 시간대에 정원률이 낮은 반 ${classes.length}개가 있습니다. 통합을 고려해보세요.`,
                      priority: priorityPolicy,
                      dedup_key: dedupKey,
                      expires_at: new Date(kstTime.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString(),
                      status: 'pending',
                    });
                  }
                }
              }
            }
          }
        }

        // ai_suggest_churn_focus 처리 (매일 06:10 실행)
        // AI_자동화_기능_정리.md Section 11: ai_suggest_churn_focus
        const hour = kstTime.getHours();
        const minute = kstTime.getMinutes();
        if (hour === 6 && minute >= 10 && minute < 15) {
          const churnEventType = 'ai_suggest_churn_focus';
          assertAutomationEventType(churnEventType);

          const churnEnabled = await getTenantSettingByPath(
            supabase,
            tenant.id,
            `auto_notification.${churnEventType}.enabled`
          );
          if (churnEnabled === true) {
            // ⚠️ 중요: 자동화 안전성 체크 (AI_자동화_기능_정리.md Section 10.4)
            const safetyCheck = await checkAndUpdateAutomationSafety(
              supabase,
              tenant.id,
              'create_task',
              kstTime,
              `auto_notification.${churnEventType}.throttle.daily_limit`
            );
            if (!safetyCheck.canExecute) {
              console.warn(`[${churnEventType}] Skipping due to safety check: ${safetyCheck.reason}`);
            } else {
              // Policy에서 priority 조회 (Fail-Closed)
              const priorityPolicy = await getTenantSettingByPath(
                supabase,
                tenant.id,
                `auto_notification.${churnEventType}.priority`
              ) as number | null;
              if (!priorityPolicy || typeof priorityPolicy !== 'number') {
                // Fail Closed: Policy가 없으면 이 테넌트의 churn 처리 건너뛰기
                continue;
              }

              // Policy에서 TTL 조회 (Fail-Closed)
              const ttlDays = await getTenantSettingByPath(
                supabase,
                tenant.id,
                `auto_notification.${churnEventType}.ttl_days`
              ) as number | null;
              if (!ttlDays || typeof ttlDays !== 'number') {
                // Fail Closed: Policy가 없으면 이 테넌트의 churn 처리 건너뛰기
                continue;
              }

              // 최근 출석률이 낮은 대상 조회
              const sevenDaysAgo = toKSTDate(new Date(kstTime.getTime() - 7 * 24 * 60 * 60 * 1000));
              const { data: riskStudents } = await withTenant(
                supabase
                  .from('task_cards')
                  .select('student_id')
                  .eq('task_type', 'risk')
                  .gte('created_at', `${sevenDaysAgo}T00:00:00`),
                tenant.id
              );

              if (riskStudents && riskStudents.length > 0) {
                const dedupKey = `${tenant.id}:${churnEventType}:tenant:${tenant.id}:${toKSTDate(kstTime)}`;
                // ⚠️ 정본 규칙: 부분 유니크 인덱스 사용 시 Supabase client upsert() 직접 사용 불가
                // RPC 함수 create_task_card_with_dedup_v1 사용 (프론트 자동화 문서 2.3 섹션 참조)
                await createTaskCardWithDedup(supabase, {
                  tenant_id: tenant.id,
                  entity_id: tenant.id,  // entity_id = tenantId (entity_type='tenant')
                  entity_type: 'tenant', // entity_type
                  task_type: 'ai_suggested',
                  title: '이탈 위험 대상 집중 관리',
                  description: `${riskStudents.length}명의 이탈 위험 대상이 감지되었습니다. 집중 관리가 필요합니다.`,
                  priority: priorityPolicy,
                  dedup_key: dedupKey,
                  expires_at: new Date(kstTime.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString(),
                  status: 'pending',
                });
              }
            }
          }
          }
        }

        // risk_students_weekly_kpi 처리 (매주 월요일 08:05 실행)
        // AI_자동화_기능_정리.md Section 11: risk_students_weekly_kpi
        const dayOfWeek = kstTime.getDay();
        if (dayOfWeek === 1 && hour === 8 && minute >= 5 && minute < 10) {
          const riskKpiEventType = 'risk_students_weekly_kpi';
          assertAutomationEventType(riskKpiEventType);

          const riskKpiEnabled = await getTenantSettingByPath(
            supabase,
            tenant.id,
            `auto_notification.${riskKpiEventType}.enabled`
          );
          if (riskKpiEnabled === true) {
            // ⚠️ 중요: 자동화 안전성 체크 (AI_자동화_기능_정리.md Section 10.4)
            const safetyCheck = await checkAndUpdateAutomationSafety(
              supabase,
              tenant.id,
              'create_report',
              kstTime,
              `auto_notification.${riskKpiEventType}.throttle.daily_limit`
            );
            if (!safetyCheck.canExecute) {
              console.warn(`[${riskKpiEventType}] Skipping due to safety check: ${safetyCheck.reason}`);
            } else {
              const lastWeek = toKSTDate(new Date(kstTime.getTime() - 7 * 24 * 60 * 60 * 1000));
              const { data: riskCards } = await withTenant(
                supabase
                .from('task_cards')
                .select('id, task_type')
                .eq('task_type', 'risk')
                .gte('created_at', `${lastWeek}T00:00:00`),
                tenant.id
              );

              if (riskCards && riskCards.length > 0) {
              if (await shouldUseAI(supabase, tenant.id)) {
                await supabase.from('ai_insights').insert({
                  tenant_id: tenant.id,
                  insight_type: 'daily_briefing',
                  title: '주간 위험 대상 KPI',
                  summary: `최근 1주일간 ${riskCards.length}건의 위험 대상이 감지되었습니다.`,
                  created_at: kstTime.toISOString(),
                });
              }
            }
          }
          }
        }

        // weekly_ops_summary 처리 (매주 월요일 08:00~09:00 실행)
        // AI_자동화_기능_정리.md Section 11: weekly_ops_summary
        if (dayOfWeek === 1 && hour >= 8 && hour < 9) {
          const weeklyOpsEventType = 'weekly_ops_summary';
          assertAutomationEventType(weeklyOpsEventType);

          const weeklyOpsEnabled = await getTenantSettingByPath(
            supabase,
            tenant.id,
            `auto_notification.${weeklyOpsEventType}.enabled`
          );
          if (weeklyOpsEnabled === true) {
            // ⚠️ 중요: 자동화 안전성 체크 (AI_자동화_기능_정리.md Section 10.4)
            const safetyCheck = await checkAndUpdateAutomationSafety(
              supabase,
              tenant.id,
              'create_report',
              kstTime,
              `auto_notification.${weeklyOpsEventType}.throttle.daily_limit`
            );
            if (!safetyCheck.canExecute) {
              console.warn(`[${weeklyOpsEventType}] Skipping due to safety check: ${safetyCheck.reason}`);
            } else {
              const lastWeek = toKSTDate(new Date(kstTime.getTime() - 7 * 24 * 60 * 60 * 1000));
              const today = toKSTDate(kstTime);

              // 주간 통계 수집
              const { data: weeklyAttendance } = await withTenant(
              supabase
                .from('attendance_logs')
                .select('status')
                .gte('occurred_at', `${lastWeek}T00:00:00`)
                .lte('occurred_at', `${today}T23:59:59`),
                tenant.id
              );

              const { data: weeklyInvoices } = await withTenant(
              supabase
                .from('invoices')
                .select('amount_paid')
                .gte('period_start', lastWeek)
                .lte('period_start', today),
                tenant.id
              );

              const attendanceCount = weeklyAttendance?.filter((log: any) => log.status === 'present').length || 0;
            const revenue = weeklyInvoices?.reduce((sum: number, inv: any) => sum + (inv.amount_paid || 0), 0) || 0;

            if (await shouldUseAI(supabase, tenant.id)) {
              await supabase.from('ai_insights').insert({
                tenant_id: tenant.id,
                insight_type: 'daily_briefing',
                title: '주간 운영 요약',
                summary: `지난 주 출석 ${attendanceCount}건, 매출 ${revenue.toLocaleString()}원`,
                created_at: kstTime.toISOString(),
              });
            }
          }
          }
        }

        // 최대 2개만 저장 (아키텍처 문서 4644줄)
        const cardsToInsert = insights.slice(0, 2);

        if (cardsToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('ai_insights')
            .insert(cardsToInsert);

          if (!insertError) {
            totalGenerated += cardsToInsert.length;
            console.log(`[AI Briefing] Generated ${cardsToInsert.length} cards for tenant ${tenant.id}`);
          } else {
            console.error(`[AI Briefing] Failed to insert for tenant ${tenant.id}:`, insertError);
          }
        }

      } catch (error) {
        console.error(`[AI Briefing] Error processing tenant ${tenant.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        generated_count: totalGenerated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AI Briefing] Fatal error:', error);
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
