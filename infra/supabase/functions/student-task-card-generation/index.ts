/**
 * StudentTaskCard 배치 생성 작업
 *
 * 아키텍처 문서 3.1.3 섹션 참조
 * 스케줄: 매일 06:00 KST (Supabase cron 설정 필요)
 *
 * [불변 규칙] Zero-Management: 사용자 개입 없이 자동 실행
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getTenantSettingByPath } from '../_shared/policy-utils.ts';
import { withTenant } from '../_shared/withTenant.ts';
import { envServer } from '../_shared/env-registry.ts';
import { toKSTDate, toKST } from '../_shared/date-utils.ts';
import { createTaskCardWithDedup } from '../_shared/create-task-card-with-dedup.ts';

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
    const today = toKSTDate(); // YYYY-MM-DD
    const yesterday = toKSTDate(new Date(kstTime.getTime() - 24 * 60 * 60 * 1000));

    console.log(`[StudentTaskCard] Starting batch generation for ${today}`);

    // 만료된 카드 정리 (정본)
    const { error: deleteError } = await supabase
      .from('task_cards')
      .delete()
      .lt('expires_at', toKST().toISOString());

    if (deleteError) {
      console.error('[StudentTaskCard] Failed to delete expired cards:', deleteError);
    } else {
      console.log('[StudentTaskCard] Cleaned up expired cards');
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
        // ⚠️ 중요: 이상 패턴 감지 Policy 확인 (Fail Closed, 업종 중립: 출결 이상 → 이상 패턴)
        // SSOT 경로 우선: auto_notification.attendance_pattern_anomaly.enabled
        // 레거시 fallback: 신규 경로가 없고 기존 값이 있을 때만 제한적 fallback (읽기만 허용, 쓰기 금지)
        const anomalyDetectionPolicy = await getTenantSettingByPath(
          supabase,
          tenant.id,
          'auto_notification.attendance_pattern_anomaly.enabled',
          'attendance.anomaly_detection.enabled' // 레거시 fallback
        );
        if (!anomalyDetectionPolicy) {
          // Policy가 없으면 실행하지 않음 (Fail Closed)
          console.log(`[StudentTaskCard] Anomaly detection policy not found for tenant ${tenant.id}, skipping`);
          continue;
        }
        if (anomalyDetectionPolicy !== true) {
          // Policy가 비활성화되어 있으면 실행하지 않음
          console.log(`[StudentTaskCard] Anomaly detection disabled for tenant ${tenant.id}, skipping`);
          continue;
        }

        // ⚠️ 중요: 이상 패턴 감지 임계값 Policy 조회 (Fail Closed, 업종 중립)
        const absenceThresholdPolicy = await getTenantSettingByPath(
          supabase,
          tenant.id,
          'attendance.absence_threshold_days'
        );
        if (!absenceThresholdPolicy || typeof absenceThresholdPolicy !== 'number') {
          // Policy가 없으면 실행하지 않음 (Fail Closed)
          console.log(`[StudentTaskCard] Anomaly threshold policy not found for tenant ${tenant.id}, skipping`);
          continue;
        }
        const thresholdDays = absenceThresholdPolicy; // Policy에서 조회한 값만 사용

        // 이상 패턴 임계값 이상 대상 확인 (업종 중립: 학생 → 대상)
        const thresholdDaysAgo = toKSTDate(new Date(kstTime.getTime() - thresholdDays * 24 * 60 * 60 * 1000));

        const { data: absentRecords, error: absentError } = await withTenant(
          supabase
          .from('attendance_logs')
          .select('student_id, occurred_at')
          .eq('status', 'absent')
          .gte('occurred_at', `${thresholdDaysAgo}T00:00:00`)
            .lte('occurred_at', `${yesterday}T23:59:59`),
          tenant.id
        );

        if (!absentError && absentRecords) {
          // 대상별 미참석 일수 집계 (업종 중립: 학생 → 대상, 결석 → 미참석)
          const absentCounts = new Map<string, number>();
          absentRecords.forEach((log: { student_id: string; occurred_at: string }) => {
            const count = absentCounts.get(log.student_id) || 0;
            absentCounts.set(log.student_id, count + 1);
          });

          // 임계값 이상 미참석한 대상에 대해 카드 생성 (업종 중립)
          // ⚠️ 중요: v3.3 정본 규칙 - UPSERT 사용 (프론트 자동화 문서 2.3 섹션 참조)
          for (const [studentId, count] of absentCounts.entries()) {
            if (count >= thresholdDays) {
              // ⚠️ 중요: 자동 실행 자기 억제 메커니즘 체크 (프론트 자동화 문서 2.5.2 섹션 참조)
              const actionType = 'create_absence_task';
              const todayStart = new Date(kstTime);
              todayStart.setHours(0, 0, 0, 0);
              const todayEnd = new Date(kstTime);
              todayEnd.setHours(23, 59, 59, 999);

              const { data: safetyState, error: safetyError } = await withTenant(
                supabase
                .from('automation_safety_state')
                .select('*')
                .eq('action_type', actionType)
                .gte('window_start', todayStart.toISOString())
                  .lte('window_end', todayEnd.toISOString()),
                tenant.id
              ).single();

              if (safetyError && safetyError.code !== 'PGRST116') {
                console.error(`[StudentTaskCard] Failed to check automation safety for tenant ${tenant.id}:`, safetyError);
              }

              // 안전성 체크
              if (safetyState) {
                if (safetyState.state === 'paused') {
                  console.warn(`[StudentTaskCard] Skipping absence task generation for tenant ${tenant.id} due to paused state.`);
                  continue;
                }

                if (safetyState.executed_count >= safetyState.max_allowed) {
                  await supabase
                    .from('automation_safety_state')
                    .update({ state: 'paused' })
                    .eq('id', safetyState.id);
                  console.warn(`[StudentTaskCard] Skipping absence task generation for tenant ${tenant.id} due to safety limits.`);
                  continue;
                }

                // 실행 카운트 증가
                await supabase
                  .from('automation_safety_state')
                  .update({
                    executed_count: safetyState.executed_count + 1,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', safetyState.id);
            } else {
              // 초기 상태 생성
              // ⚠️ 중요: max_allowed는 Policy에서 조회 (Fail Closed)
              // SSOT 경로 우선: auto_notification.attendance_pattern_anomaly.throttle.student_limit
              // 레거시 fallback: 신규 경로가 없고 기존 값이 있을 때만 제한적 fallback (읽기만 허용, 쓰기 금지)
              const taskGenerationLimitPolicy = await getTenantSettingByPath(
                supabase,
                tenant.id,
                'auto_notification.attendance_pattern_anomaly.throttle.student_limit',
                'auto_task_generation.student_limit' // 레거시 fallback
              );
              if (!taskGenerationLimitPolicy || typeof taskGenerationLimitPolicy !== 'number') {
                // Policy가 없으면 실행하지 않음 (Fail Closed)
                console.log(`[StudentTaskCard] Task generation limit policy not found for tenant ${tenant.id}, skipping`);
                continue;
              }
              const maxAllowed = taskGenerationLimitPolicy; // Policy에서 조회한 값만 사용

              await supabase.from('automation_safety_state').insert({
                tenant_id: tenant.id,
                action_type: actionType,
                window_start: todayStart.toISOString(),
                window_end: todayEnd.toISOString(),
                max_allowed: maxAllowed,
                state: 'normal',
              });
            }

              const expiresAt = new Date(kstTime.getTime() + 3 * 24 * 60 * 60 * 1000);
              expiresAt.setHours(23, 59, 59, 999);

              // 정본 포맷: dedup_key = "{tenantId}:{trigger}:{entityType}:{entityId}:{window}"
              const dedupKey = `${tenant.id}:absence:student:${studentId}:${today}`;

              // ⚠️ 정본 규칙: 부분 유니크 인덱스 사용 시 Supabase client upsert() 직접 사용 불가
              // RPC 함수 create_task_card_with_dedup_v1 사용 (프론트 자동화 문서 2.3 섹션 참조)
              const result = await createTaskCardWithDedup(supabase, {
                tenant_id: tenant.id,
                student_id: studentId,
                entity_id: studentId,  // entity_id = student_id (entity_type='student')
                entity_type: 'student', // entity_type
                task_type: 'absence',
                source: 'attendance', // v3.3: source 필드 추가
                priority: 60 + count * 10, // 미참석 일수에 따라 우선순위 증가 (0-100 스케일, 업종 중립)
                title: `${count}일 연속 미참석`, // 업종 중립: 결석 → 미참석
                description: `대상이 ${count}일 연속 미참석했습니다. 보호자 연락이 필요합니다.`, // 업종 중립: 학생 → 대상, 학부모 → 보호자
                action_url: `/students/${studentId}/attendance`,
                expires_at: expiresAt.toISOString(),
                dedup_key: dedupKey, // v3.3: dedup_key 필드 추가
                status: 'pending', // v3.3: status 필드 추가
                suggested_action: { // v3.3: suggested_action 필드 추가
                  type: 'contact_guardian', // 업종 중립: contact_parents → contact_guardian
                  payload: { student_id: studentId, reason: '3_day_absence' },
                },
                metadata: {
                  absence_days: count,
                  guardian_contact_needed: true, // 업종 중립: parent → guardian
                },
              });

              if (result) {
                totalGenerated += 1;
                console.log(`[StudentTaskCard] Created/updated absence card for student ${studentId} (tenant ${tenant.id})`);
              } else {
                console.error(`[StudentTaskCard] Failed to create absence card for student ${studentId}`);
              }
            }
          }
        }

        // 신규 등록 대상 확인 (최근 7일 이내, 업종 중립: 학생 → 대상)
        const sevenDaysAgo = toKSTDate(new Date(kstTime.getTime() - 7 * 24 * 60 * 60 * 1000));

        const { data: newStudents, error: newStudentsError } = await withTenant(
          supabase
          .from('persons')
          .select('id, created_at, name')
          .eq('person_type', 'student')
          .gte('created_at', `${sevenDaysAgo}T00:00:00`)
            .lte('created_at', `${today}T23:59:59`),
          tenant.id
        );

        if (!newStudentsError && newStudents) {
          // ⚠️ 중요: v3.3 정본 규칙 - UPSERT 사용 (프론트 자동화 문서 2.3 섹션 참조)
          for (const student of newStudents) {
            // ⚠️ 중요: 자동 실행 자기 억제 메커니즘 체크 (프론트 자동화 문서 2.5.2 섹션 참조)
            const actionType = 'create_new_signup_task';
            const todayStart = new Date(kstTime);
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date(kstTime);
            todayEnd.setHours(23, 59, 59, 999);

            const { data: safetyState, error: safetyError } = await withTenant(
              supabase
              .from('automation_safety_state')
              .select('*')
              .eq('action_type', actionType)
              .gte('window_start', todayStart.toISOString())
                .lte('window_end', todayEnd.toISOString()),
              tenant.id
            ).single();

            if (safetyError && safetyError.code !== 'PGRST116') {
              console.error(`[StudentTaskCard] Failed to check automation safety for tenant ${tenant.id}:`, safetyError);
            }

            // 안전성 체크
            if (safetyState) {
              if (safetyState.state === 'paused') {
                console.warn(`[StudentTaskCard] Skipping new signup task generation for tenant ${tenant.id} due to paused state.`);
                continue;
              }

              if (safetyState.executed_count >= safetyState.max_allowed) {
                await supabase
                  .from('automation_safety_state')
                  .update({ state: 'paused' })
                  .eq('id', safetyState.id);
                console.warn(`[StudentTaskCard] Skipping new signup task generation for tenant ${tenant.id} due to safety limits.`);
                continue;
              }

              // 실행 카운트 증가
              await supabase
                .from('automation_safety_state')
                .update({
                  executed_count: safetyState.executed_count + 1,
                  updated_at: new Date().toISOString()
                })
                .eq('id', safetyState.id);
            } else {
              // 초기 상태 생성
              // ⚠️ 중요: max_allowed는 Policy에서 조회 (Fail Closed)
              // SSOT 경로 우선: auto_notification.attendance_pattern_anomaly.throttle.student_limit
              // 레거시 fallback: 신규 경로가 없고 기존 값이 있을 때만 제한적 fallback (읽기만 허용, 쓰기 금지)
              const taskGenerationLimitPolicy = await getTenantSettingByPath(
                supabase,
                tenant.id,
                'auto_notification.attendance_pattern_anomaly.throttle.student_limit',
                'auto_task_generation.student_limit' // 레거시 fallback
              );
              if (!taskGenerationLimitPolicy || typeof taskGenerationLimitPolicy !== 'number') {
                // Policy가 없으면 실행하지 않음 (Fail Closed)
                console.log(`[StudentTaskCard] Task generation limit policy not found for tenant ${tenant.id}, skipping`);
                continue;
              }
              const maxAllowed = taskGenerationLimitPolicy; // Policy에서 조회한 값만 사용

              await supabase.from('automation_safety_state').insert({
                tenant_id: tenant.id,
                action_type: actionType,
                window_start: todayStart.toISOString(),
                window_end: todayEnd.toISOString(),
                max_allowed: maxAllowed,
                state: 'normal',
              });
            }

            const expiresAt = new Date(kstTime.getTime() + 7 * 24 * 60 * 60 * 1000);
            expiresAt.setHours(23, 59, 59, 999);

            // 정본 포맷: dedup_key = "{tenantId}:{trigger}:{entityType}:{entityId}:{window}"
            const dedupKey = `${tenant.id}:new_signup:student:${student.id}:${today}`;

            // ⚠️ 정본 규칙: 부분 유니크 인덱스 사용 시 Supabase client upsert() 직접 사용 불가
            // RPC 함수 create_task_card_with_dedup_v1 사용 (프론트 자동화 문서 2.3 섹션 참조)
            const result = await createTaskCardWithDedup(supabase, {
              tenant_id: tenant.id,
              student_id: student.id,
              entity_id: student.id,  // entity_id = student_id (entity_type='student')
              entity_type: 'student', // entity_type
              task_type: 'new_signup',
              priority: 30, // 0-100 스케일
              title: `${student.name} 학생 신규 등록`,
              description: '환영 메시지를 발송해 보세요.',
              action_url: `/students/${student.id}/welcome`,
              expires_at: expiresAt.toISOString(),
              dedup_key: dedupKey, // v3.3: dedup_key 필드 추가
              status: 'pending', // v3.3: status 필드 추가
              metadata: {
                signup_date: student.created_at,
                initial_setup_needed: true,
              },
            });

            if (result) {
              totalGenerated += 1;
              console.log(`[StudentTaskCard] Created/updated welcome card for student ${student.id} (tenant ${tenant.id})`);
            } else {
              console.error(`[StudentTaskCard] Failed to create welcome card for student ${student.id}`);
            }
          }
        }

      } catch (error) {
        console.error(`[StudentTaskCard] Error processing tenant ${tenant.id}:`, error);
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
    console.error('[StudentTaskCard] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
