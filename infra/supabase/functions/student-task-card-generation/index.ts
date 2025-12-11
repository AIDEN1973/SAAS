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

    // KST 기준 날짜 계산
    const now = new Date();
    const kstOffset = 9 * 60;
    const kstTime = new Date(now.getTime() + (kstOffset * 60 * 1000));
    const today = kstTime.toISOString().slice(0, 10); // YYYY-MM-DD
    const yesterday = new Date(kstTime.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

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
        // 결석 3일 이상 학생 확인
        const threeDaysAgo = new Date(kstTime.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const { data: absentStudents, error: absentError } = await supabase
          .from('attendance_logs')
          .select('student_id, occurred_at')
          .eq('tenant_id', tenant.id)
          .eq('status', 'absent')
          .gte('occurred_at', `${threeDaysAgo}T00:00:00`)
          .lte('occurred_at', `${yesterday}T23:59:59`);

        if (!absentError && absentStudents) {
          // 학생별 결석 일수 집계
          const absentCounts = new Map<string, number>();
          absentStudents.forEach((log: any) => {
            const count = absentCounts.get(log.student_id) || 0;
            absentCounts.set(log.student_id, count + 1);
          });

          // 3일 이상 결석한 학생에 대해 카드 생성
          const cardsToCreate: any[] = [];
          for (const [studentId, count] of absentCounts.entries()) {
            if (count >= 3) {
              // 오늘 이미 생성된 카드 확인
              const { data: existing } = await supabase
                .from('student_task_cards')
                .select('id')
                .eq('tenant_id', tenant.id)
                .eq('student_id', studentId)
                .eq('task_type', 'absence')
                .gte('created_at', `${today}T00:00:00`)
                .single();

              if (!existing) {
                const expiresAt = new Date(kstTime.getTime() + 3 * 24 * 60 * 60 * 1000);
                expiresAt.setHours(23, 59, 59, 999);

                cardsToCreate.push({
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
                });
              }
            }
          }

          if (cardsToCreate.length > 0) {
            const { error: insertError } = await supabase
              .from('student_task_cards')
              .insert(cardsToCreate);

            if (!insertError) {
              totalGenerated += cardsToCreate.length;
              console.log(`[StudentTaskCard] Generated ${cardsToCreate.length} absence cards for tenant ${tenant.id}`);
            }
          }
        }

        // 신규 등록 학생 확인 (최근 7일 이내)
        const sevenDaysAgo = new Date(kstTime.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const { data: newStudents, error: newStudentsError } = await supabase
          .from('persons')
          .select('id, created_at')
          .eq('tenant_id', tenant.id)
          .eq('person_type', 'student')
          .gte('created_at', `${sevenDaysAgo}T00:00:00`)
          .lte('created_at', `${today}T23:59:59`);

        if (!newStudentsError && newStudents) {
          const welcomeCards: any[] = [];
          for (const student of newStudents) {
            // 오늘 이미 생성된 카드 확인
            const { data: existing } = await supabase
              .from('student_task_cards')
              .select('id')
              .eq('tenant_id', tenant.id)
              .eq('student_id', student.id)
              .eq('task_type', 'new_signup')
              .single();

            if (!existing) {
              const expiresAt = new Date(kstTime.getTime() + 7 * 24 * 60 * 60 * 1000);
              expiresAt.setHours(23, 59, 59, 999);

              welcomeCards.push({
                tenant_id: tenant.id,
                student_id: student.id,
                task_type: 'new_signup',
                priority: 30,
                title: '신규 등록 학생 환영',
                description: '신규 등록 학생을 환영하고 초기 설정을 완료하세요.',
                action_url: `/students/${student.id}/welcome`,
                expires_at: expiresAt.toISOString(),
                signup_date: student.created_at,
                initial_setup_needed: true,
              });
            }
          }

          if (welcomeCards.length > 0) {
            const { error: insertError } = await supabase
              .from('student_task_cards')
              .insert(welcomeCards);

            if (!insertError) {
              totalGenerated += welcomeCards.length;
              console.log(`[StudentTaskCard] Generated ${welcomeCards.length} welcome cards for tenant ${tenant.id}`);
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});


