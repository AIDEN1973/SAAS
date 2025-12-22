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
import { shouldUseAI } from '../_shared/policy-utils.ts';

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

        const insights: Array<{ id: string; title: string; summary: string; insights: string[]; created_at: string; action_url?: string }> = [];

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
          .select('id')
          .eq('task_type', 'risk')
            .limit(5),
          tenant.id
        );

        if (!riskError && riskCards && riskCards.length > 0) {
          insights.push({
            tenant_id: tenant.id,
            insight_type: 'daily_briefing',
            title: '이탈 위험 대상 알림', // 업종 중립: 학생 → 대상
            summary: `${riskCards.length}명의 대상이 이탈 위험 단계입니다.`, // 업종 중립: 학생 → 대상
            insights: JSON.stringify([
              '이탈 위험 대상에게 즉시 상담을 진행하세요.', // 업종 중립: 학생 → 대상
              '대상의 진행 동기를 높이기 위한 방안을 모색하세요.', // 업종 중립: 학생 → 대상, 학습 → 진행
            ]),
            action_url: '/students/home',
            created_at: toKST().toISOString(),
          });
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
