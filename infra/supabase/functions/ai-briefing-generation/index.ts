/**
 * AI 브리핑 카드 자동 생성 작업
 *
 * 아키텍처 문서 3.7.1 섹션 참조
 * 스케줄: 매일 07:00 KST (Supabase cron 설정 필요)
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
    const today = kstTime.toISOString().slice(0, 10);

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
        const insights: any[] = [];

        // 1. 오늘 상담 일정 확인
        const { data: consultations, error: consultationsError } = await supabase
          .from('student_consultations')
          .select('id')
          .eq('tenant_id', tenant.id)
          .gte('consultation_date', today)
          .limit(10);

        if (!consultationsError && consultations && consultations.length > 0) {
          insights.push({
            tenant_id: tenant.id,
            insight_type: 'daily_briefing',
            title: '오늘의 상담 일정',
            summary: `오늘 ${consultations.length}건의 상담이 예정되어 있습니다.`,
            insights: JSON.stringify([
              '상담일지를 작성하여 학생 관리를 강화하세요.',
              '상담 내용을 바탕으로 학생의 학습 방향을 조정할 수 있습니다.',
            ]),
            action_url: '/ai?tab=consultation',
            created_at: kstTime.toISOString(),
          });
        }

        // 2. 이번 달 수납 현황 확인
        const currentMonth = kstTime.toISOString().slice(0, 7);
        const { data: invoices, error: invoicesError } = await supabase
          .from('invoices')
          .select('amount, amount_paid')
          .eq('tenant_id', tenant.id)
          .gte('period_start', `${currentMonth}-01`);

        if (!invoicesError && invoices && invoices.length > 0) {
          const totalAmount = invoices.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);
          const paidAmount = invoices.reduce((sum: number, inv: any) => sum + (inv.amount_paid || 0), 0);
          const expectedCollectionRate = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;

          insights.push({
            tenant_id: tenant.id,
            insight_type: 'daily_briefing',
            title: '이번 달 수납 현황',
            summary: `이번 달 청구서가 자동 발송되었습니다. 예상 수납률은 ${expectedCollectionRate}%입니다.`,
            insights: JSON.stringify([
              expectedCollectionRate >= 90
                ? '수납률이 양호합니다. 현재 운영 방식을 유지하세요.'
                : '수납률 개선이 필요합니다. 미납 학생에게 연락을 취하세요.',
            ]),
            action_url: '/billing/home',
            created_at: kstTime.toISOString(),
          });
        }

        // 3. 출결 이상 패턴 확인 (최근 7일)
        const sevenDaysAgo = new Date(kstTime.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const { data: attendanceLogs, error: attendanceError } = await supabase
          .from('attendance_logs')
          .select('status')
          .eq('tenant_id', tenant.id)
          .gte('occurred_at', `${sevenDaysAgo}T00:00:00`)
          .limit(100);

        if (!attendanceError && attendanceLogs) {
          const absentCount = attendanceLogs.filter((log: any) => log.status === 'absent').length;
          const lateCount = attendanceLogs.filter((log: any) => log.status === 'late').length;

          if (absentCount > 5 || lateCount > 10) {
            insights.push({
              tenant_id: tenant.id,
              insight_type: 'daily_briefing',
              title: '출결 이상 패턴 감지',
              summary: `최근 7일간 결석 ${absentCount}건, 지각 ${lateCount}건이 발생했습니다.`,
              insights: JSON.stringify([
                '출결 패턴을 분석하여 원인을 파악하세요.',
                '지각이 많은 학생들에게 사전 안내를 제공하세요.',
              ]),
              action_url: '/ai?tab=attendance',
              created_at: kstTime.toISOString(),
            });
          }
        }

        // 4. 이탈 위험 학생 확인
        const { data: riskCards, error: riskError } = await supabase
          .from('student_task_cards')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('task_type', 'risk')
          .limit(5);

        if (!riskError && riskCards && riskCards.length > 0) {
          insights.push({
            tenant_id: tenant.id,
            insight_type: 'daily_briefing',
            title: '이탈 위험 학생 알림',
            summary: `${riskCards.length}명의 학생이 이탈 위험 단계입니다.`,
            insights: JSON.stringify([
              '이탈 위험 학생들에게 즉시 상담을 진행하세요.',
              '학생의 학습 동기를 높이기 위한 방안을 모색하세요.',
            ]),
            action_url: '/students/home',
            created_at: kstTime.toISOString(),
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




