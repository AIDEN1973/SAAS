/**
 * 자동 추천 메시지 생성 Edge Function
 *
 * 프론트 자동화 문서 5.2.2 섹션 참조
 * 스케줄: 매일 08:00 KST (Supabase cron 설정 필요)
 *
 * [불변 규칙] Zero-Management: 사용자 개입 없이 자동 실행
 * [불변 규칙] 멱등성/중복방지: 반드시 UPSERT 사용 (DB 제약으로 Race condition 방지)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { shouldUseAI, getTenantSettingByPath } from '../_shared/policy-utils.ts';
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
    const today = toKSTDate(); // YYYY-MM-DD

    console.log(`[Auto Message Suggestion] Starting batch generation for ${today}`);

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
        // ⚠️ 중요: AI 기능 활성화 체크 (Fail Closed)
        if (!(await shouldUseAI(supabase, tenant.id))) {
          console.log(`[Auto Message Suggestion] AI disabled for tenant ${tenant.id}, skipping`);

          // ⚠️ 중요: AI OFF 시 ai_decision_logs에 skipped_by_flag 기록 (SSOT 준수)
          await supabase.from('ai_decision_logs').insert({
            tenant_id: tenant.id,
            model: 'auto_message_suggestion',
            features: { date: today },
            reason: 'AI disabled (PLATFORM_AI_ENABLED or tenant_features disabled)',
            skipped_by_flag: true,
            created_at: new Date().toISOString(),
          }).catch((error) => {
            console.error(`[Auto Message Suggestion] Failed to log AI skip decision for tenant ${tenant.id}:`, error);
          });

          continue;
        }

        // ⚠️ 중요: 메시지 초안 생성 Policy 확인 (서버가 생성하며 AI 호출 포함, Fail Closed)
        // SSOT 경로 우선: auto_notification.attendance_pattern_anomaly.enabled
        // 레거시 fallback: 신규 경로가 없고 기존 값이 있을 때만 제한적 fallback (읽기만 허용, 쓰기 금지)
        const messageSuggestionPolicy = await getTenantSettingByPath(
          supabase,
          tenant.id,
          'auto_notification.attendance_pattern_anomaly.enabled',
          'auto_message_suggestion.enabled' // 레거시 fallback
        );
        if (!messageSuggestionPolicy || messageSuggestionPolicy !== true) {
          // Policy가 없거나 비활성화되어 있으면 실행하지 않음 (Fail Closed)
          console.log(`[Auto Message Suggestion] Message suggestion disabled for tenant ${tenant.id}, skipping`);
          continue;
        }

        // ⚠️ 중요: 결석 감지 임계값 Policy 조회 (Fail Closed)
        const absenceThresholdPolicy = await getTenantSettingByPath(
          supabase,
          tenant.id,
          'attendance.absence_threshold_days'
        );
        if (!absenceThresholdPolicy || typeof absenceThresholdPolicy !== 'number') {
          // Policy가 없으면 실행하지 않음 (Fail Closed)
          console.log(`[Auto Message Suggestion] Absence threshold policy not found for tenant ${tenant.id}, skipping`);
          continue;
        }
        const thresholdDays = absenceThresholdPolicy; // Policy에서 조회한 값만 사용

        // 결석 임계값 이상 학생 감지
        const thresholdDaysAgo = toKSTDate(new Date(kstTime.getTime() - thresholdDays * 24 * 60 * 60 * 1000));

        const { data: absentStudents, error: absentError } = await withTenant(
          supabase
          .from('attendance_logs')
          .select('student_id')
          .eq('status', 'absent')
          .gte('occurred_at', `${thresholdDaysAgo}T00:00:00`)
            .lte('occurred_at', `${today}T23:59:59`),
          tenant.id
        );

        if (absentError) {
          console.error(`[Auto Message Suggestion] Failed to fetch absent students for tenant ${tenant.id}:`, absentError);
          continue;
        }

        if (!absentStudents || absentStudents.length === 0) {
          continue;
        }

        // 학생별 결석 일수 집계
        const absentCounts = new Map<string, number>();
        absentStudents.forEach((log: { student_id: string }) => {
          const count = absentCounts.get(log.student_id) || 0;
          absentCounts.set(log.student_id, count + 1);
        });

        // 임계값 이상 결석한 학생에 대해 StudentTaskCard 생성
        for (const [studentId, count] of absentCounts.entries()) {
          if (count >= thresholdDays) {
            // ⚠️ 중요: 자동 실행 자기 억제 메커니즘 체크 (프론트 자동화 문서 2.5.2 섹션 참조)
            const actionType = 'send_message';
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
              console.error(`[Auto Message Suggestion] Failed to check automation safety for tenant ${tenant.id}:`, safetyError);
            }

            // 안전성 체크
            if (safetyState) {
              if (safetyState.state === 'paused') {
                console.warn(`[Auto Message Suggestion] Skipping message suggestion for tenant ${tenant.id} due to paused state.`);
                continue;
              }

              if (safetyState.executed_count >= safetyState.max_allowed) {
                await withTenant(
                  supabase
                  .from('automation_safety_state')
                  .update({ state: 'paused' })
                    .eq('id', safetyState.id),
                  tenant.id
                );
                console.warn(`[Auto Message Suggestion] Skipping message suggestion for tenant ${tenant.id} due to safety limits.`);
                continue;
              }

              // 실행 카운트 증가
              await withTenant(
                supabase
                .from('automation_safety_state')
                .update({
                  executed_count: safetyState.executed_count + 1,
                  updated_at: new Date().toISOString()
                })
                  .eq('id', safetyState.id),
                tenant.id
              );
            } else {
              // 초기 상태 생성
              // ⚠️ 중요: max_allowed는 Policy에서 조회 (Fail Closed)
              // SSOT 경로 우선: auto_notification.attendance_pattern_anomaly.throttle.daily_limit
              // 레거시 fallback: 신규 경로가 없고 기존 값이 있을 때만 제한적 fallback (읽기만 허용, 쓰기 금지)
              const dailyLimitPolicy = await getTenantSettingByPath(
                supabase,
                tenant.id,
                'auto_notification.attendance_pattern_anomaly.throttle.daily_limit',
                'auto_message_suggestion.daily_limit' // 레거시 fallback
              );
              if (!dailyLimitPolicy || typeof dailyLimitPolicy !== 'number') {
                // Policy가 없으면 실행하지 않음 (Fail Closed)
                console.log(`[Auto Message Suggestion] Daily limit policy not found for tenant ${tenant.id}, skipping`);
                continue;
              }
              const maxAllowed = dailyLimitPolicy; // Policy에서 조회한 값만 사용

              await supabase.from('automation_safety_state').insert({
                tenant_id: tenant.id,
                action_type: actionType,
                window_start: todayStart.toISOString(),
                window_end: todayEnd.toISOString(),
                max_allowed: maxAllowed,
                state: 'normal',
              });
            }

            // ⚠️ 중요: 엔티티 모델 정본화 (SSOT)
            // - 정본 엔티티: persons 테이블 (Core Party 모델)
            // - RPC 함수가 반환하는 student_id는 실제로 person_id를 의미
            const { data: studentInfo, error: studentError } = await withTenant(
              supabase
              .from('persons')
              .select('id, name')
                .eq('id', studentId),
              tenant.id
            ).single();

            if (studentError || !studentInfo) {
              console.error(`[Auto Message Suggestion] Failed to fetch student info for ${studentId}:`, studentError);
              continue;
            }

            const { data: guardianInfo, error: guardianError } = await withTenant(
              supabase
              .from('guardians')
              .select('id')
              .eq('student_id', studentId)
                .eq('is_primary', true),
              tenant.id
            ).single();

            // 2. 메시지 템플릿 선택 (TODO: 실제 템플릿 서비스 구현 필요)
            // ⚠️ 주의: selectMessageTemplate, generateMessageDraft는 서비스 레이어 함수로 구현 필요
            const messageDraft = `안녕하세요. ${studentInfo.name} 학생이 최근 ${count}일간 결석했습니다. 연락 부탁드립니다.`;

            // 3. StudentTaskCard 생성 (task_type: 'ai_suggested')
            // ⚠️ 중요: 멱등성/중복방지 - 반드시 UPSERT 사용 (DB 제약으로 Race condition 방지)
            // ⚠️ 중요: Priority, TTL 모두 Policy에서 조회 (하드코딩 금지, SSOT 경로 사용)
            // Priority Policy 조회 및 해석
            // SSOT 경로 우선: auto_notification.attendance_pattern_anomaly.priority
            // 레거시 fallback: 신규 경로가 없고 기존 값이 있을 때만 제한적 fallback (읽기만 허용, 쓰기 금지)
            const priorityPolicy = await getTenantSettingByPath(
              supabase,
              tenant.id,
              'auto_notification.attendance_pattern_anomaly.priority',
              'auto_message_suggestion.priority' // 레거시 fallback
            );
            if (!priorityPolicy || typeof priorityPolicy !== 'number') {
              // Policy가 없으면 실행하지 않음 (Fail Closed)
              console.log(`[Auto Message Suggestion] Priority policy not found for tenant ${tenant.id}, skipping`);
              continue;
            }
            // TTL Policy 조회 및 해석
            // SSOT 경로 우선: auto_notification.attendance_pattern_anomaly.ttl_days
            // 레거시 fallback: 신규 경로가 없고 기존 값이 있을 때만 제한적 fallback (읽기만 허용, 쓰기 금지)
            const ttlPolicy = await getTenantSettingByPath(
              supabase,
              tenant.id,
              'auto_notification.attendance_pattern_anomaly.ttl_days',
              'auto_message_suggestion.ttl_days' // 레거시 fallback
            );
            if (!ttlPolicy || typeof ttlPolicy !== 'number') {
              // Policy가 없으면 실행하지 않음 (Fail Closed)
              console.log(`[Auto Message Suggestion] TTL policy not found for tenant ${tenant.id}, skipping`);
              continue;
            }

            const dedupKey = `${tenant.id}:ai_suggested:student:${studentId}:${today}`;
            const expiresAt = new Date(kstTime.getTime() + ttlPolicy * 24 * 60 * 60 * 1000);
            expiresAt.setHours(23, 59, 59, 999);

            const { error: upsertError } = await supabase
              .from('task_cards')
              .upsert({
                tenant_id: tenant.id,
                student_id: studentId,
                entity_id: studentId,  // entity_id = student_id (entity_type='student')
                entity_type: 'student', // entity_type
                task_type: 'ai_suggested',
                source: 'attendance',
                title: `${studentInfo.name} 결석 연락`,
                description: `결석 ${thresholdDays}일 이상으로 학부모 연락을 추천합니다.`,
                suggested_action: {
                  type: 'send_message',
                  payload: {
                    recipient_ids: guardianInfo ? [guardianInfo.id] : [],
                    message: messageDraft,
                    template_id: 'attendance_followup',
                  },
                },
                priority: priorityPolicy, // Policy에서 조회한 값만 사용
                dedup_key: dedupKey,
                expires_at: expiresAt.toISOString(),
                status: 'pending',
              } as any, {
                onConflict: 'tenant_id,dedup_key', // 정본: 프론트 상황 신호 수집 문서 2.3 섹션 참조
                ignoreDuplicates: false, // 기존 카드가 있으면 업데이트
              });

            if (!upsertError) {
              totalGenerated += 1;
              console.log(`[Auto Message Suggestion] Upserted message suggestion card for student ${studentId} (tenant ${tenant.id})`);
            } else {
              console.error(`[Auto Message Suggestion] Failed to upsert message suggestion card for student ${studentId}:`, upsertError);
            }
          }
        }

      } catch (error) {
        console.error(`[Auto Message Suggestion] Error processing tenant ${tenant.id}:`, error);
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
    console.error('[Auto Message Suggestion] Fatal error:', error);
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
