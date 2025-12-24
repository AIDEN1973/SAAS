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
import { shouldUseAI, getTenantSettingByPath } from '../_shared/policy-utils.ts';
import { withTenant } from '../_shared/withTenant.ts';
import { envServer } from '../_shared/env-registry.ts';

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

    // 만료된 카드 정리
    const { error: deleteError } = await supabase
      .from('student_task_cards')
      .delete()
      .lt('expires_at', kstTime.toISOString());

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
        // ⚠️ 중요: AI 기능 활성화 여부 확인 (SSOT 기준, Fail Closed)
        // Automation Config First 원칙: 기본값 하드코딩 금지, Policy가 없으면 실행하지 않음
        const effectiveAIEnabled = await shouldUseAI(supabase, tenant.id);

        // 결석 3일 이상 학생 확인
        const threeDaysAgo = new Date(kstTime.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const { data: absentStudents, error: absentError } = await withTenant(
          supabase
          .from('attendance_logs')
          .select('student_id, occurred_at')
          .eq('status', 'absent')
          .gte('occurred_at', `${threeDaysAgo}T00:00:00`)
            .lte('occurred_at', `${yesterday}T23:59:59`),
          tenant.id
        );

        if (!absentError && absentStudents) {
          // 학생별 결석 일수 집계
          const absentCounts = new Map<string, number>();
          absentStudents.forEach((log: { student_id: string; occurred_at: string }) => {
            const count = absentCounts.get(log.student_id) || 0;
            absentCounts.set(log.student_id, count + 1);
          });

          // 3일 이상 결석한 학생에 대해 카드 생성
          // ⚠️ v3.3 정본 규칙: 멱등성/중복방지 - 반드시 UPSERT 사용 (프론트 자동화 문서 2.3 섹션 참조)
          for (const [studentId, count] of absentCounts.entries()) {
            if (count >= 3) {
              const expiresAt = new Date(kstTime.getTime() + 3 * 24 * 60 * 60 * 1000);
              expiresAt.setHours(23, 59, 59, 999);

              // 정본 포맷: dedup_key = "{tenantId}:{trigger}:{targetType}:{targetId}:{window}"
              const dedupKey = `${tenant.id}:absence:student:${studentId}:${today}`;

              // ⚠️ 중요: 멱등성/중복방지 - 반드시 UPSERT 사용 (DB 제약으로 Race condition 방지)
              const { error: upsertError } = await supabase
                .from('student_task_cards')
                .upsert({
                  tenant_id: tenant.id,
                  student_id: studentId,
                  task_type: 'absence',
                  priority: 60 + count * 10, // 결석 일수에 따라 우선순위 증가
                  title: `${count}일 연속 결석`,
                  description: `학생이 ${count}일 연속 결석했습니다. 학부모 연락이 필요합니다.`,
                  action_url: `/students/${studentId}/attendance`,
                  expires_at: expiresAt.toISOString(),
                  absence_days: count,
                  parent_contact_needed: true,
                  dedup_key: dedupKey,
                  status: 'pending',
                } as any, {
                  // onConflict 생략: Supabase가 unique index (tenant_id, dedup_key)를 자동 감지
                  ignoreDuplicates: false, // 기존 카드가 있으면 업데이트
                });

              if (!upsertError) {
                totalGenerated += 1;
                console.log(`[StudentTaskCard] Upserted absence card for student ${studentId} (tenant ${tenant.id})`);
              } else {
                console.error(`[StudentTaskCard] Failed to upsert absence card for student ${studentId}:`, upsertError);
              }
            }
          }
        }

        // 신규 등록 학생 확인 (최근 7일 이내)
        const sevenDaysAgo = new Date(kstTime.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

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
          // ⚠️ v3.3 정본 규칙: 멱등성/중복방지 - 반드시 UPSERT 사용 (프론트 자동화 문서 2.3 섹션 참조)
          for (const student of newStudents) {
            const expiresAt = new Date(kstTime.getTime() + 7 * 24 * 60 * 60 * 1000);
            expiresAt.setHours(23, 59, 59, 999);

            // 정본 포맷: dedup_key = "{tenantId}:{trigger}:{targetType}:{targetId}:{window}"
            const dedupKey = `${tenant.id}:new_signup:student:${student.id}:${today}`;

            // ⚠️ 중요: 멱등성/중복방지 - 반드시 UPSERT 사용 (DB 제약으로 Race condition 방지)
            const { error: upsertError } = await supabase
              .from('task_cards')
              .upsert({
                tenant_id: tenant.id,
                student_id: student.id,
                entity_id: student.id,  // entity_id = student_id (entity_type='student')
                entity_type: 'student', // entity_type
                task_type: 'new_signup',
                priority: 30,
                title: `${student.name} 학생 신규 등록`,
                description: '환영 메시지를 발송해 보세요.',
                action_url: `/students/${student.id}/welcome`,
                expires_at: expiresAt.toISOString(),
                dedup_key: dedupKey,
                status: 'pending',
                metadata: {
                  signup_date: student.created_at,
                  initial_setup_needed: true,
                },
              } as any, {
                onConflict: 'tenant_id,dedup_key', // 정본: 프론트 상황 신호 수집 문서 2.3 섹션 참조
                ignoreDuplicates: false, // 기존 카드가 있으면 업데이트
              });

            if (!upsertError) {
              totalGenerated += 1;
              console.log(`[StudentTaskCard] Upserted new_signup card for student ${student.id} (tenant ${tenant.id})`);
            } else {
              console.error(`[StudentTaskCard] Failed to upsert new_signup card for student ${student.id}:`, upsertError);
            }
          }
        }

        // 날씨 기반 StudentTaskCard 생성 (프론트 자동화 문서 1.2.3 섹션 참조)
        // ⚠️ 정본 규칙: 프론트는 날씨 상황 신호만 수집, 서버가 StudentTaskCard 생성
        // ⚠️ 중요: AI 기능이 활성화된 경우에만 생성
        try {
          // TODO: 실제 날씨 API 연동 필요 (예: OpenWeatherMap, 기상청 API)
          // 현재는 구조만 구현 (실제 날씨 API는 Phase 3에서 구현)
          // const weatherResponse = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}`);
          // const weather = await weatherResponse.json();

          // 예시: heavy rain 감지 시 StudentTaskCard 생성
          // 실제 구현 시에는 날씨 API에서 받은 데이터를 사용
          // ⚠️ 중요: AI 기능이 활성화된 경우에만 생성
          const shouldCreateWeatherCard = effectiveAIEnabled && false; // TODO: 날씨 API 연동 후 실제 조건으로 변경

          if (shouldCreateWeatherCard) {
            const expiresAt = new Date(kstTime.getTime() + 24 * 60 * 60 * 1000);
            expiresAt.setHours(23, 59, 59, 999);

            // 정본 포맷: dedup_key = "{tenantId}:{trigger}:{targetType}:{targetId}:{window}"
            const dedupKey = `${tenant.id}:weather:global:heavy_rain:${today}`;

            // ⚠️ 중요: 멱등성/중복방지 - 반드시 UPSERT 사용 (DB 제약으로 Race condition 방지)
            const { error: upsertError } = await supabase
              .from('student_task_cards')
              .upsert({
                tenant_id: tenant.id,
                task_type: 'ai_suggested',
                source: 'weather',
                priority: 60,
                title: '하원 안전 안내',
                description: '오늘은 비가 많이 옵니다. 하원 시 안전에 주의하세요.',
                suggested_action: {
                  type: 'send_notification',
                  template: 'weather_safety',
                },
                dedup_key: dedupKey,
                expires_at: expiresAt.toISOString(),
                status: 'pending',
              } as any, {
                // onConflict 생략: Supabase가 unique index (tenant_id, dedup_key)를 자동 감지
                ignoreDuplicates: false, // 기존 카드가 있으면 업데이트
              });

            if (!upsertError) {
              totalGenerated += 1;
              console.log(`[StudentTaskCard] Upserted weather card for tenant ${tenant.id}`);
            } else {
              console.error(`[StudentTaskCard] Failed to upsert weather card for tenant ${tenant.id}:`, upsertError);
            }
          }
        } catch (error) {
          console.error(`[StudentTaskCard] Error processing weather card for tenant ${tenant.id}:`, error);
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});





                                                                                                                                                                                                                                                                                                                                                                                                               
