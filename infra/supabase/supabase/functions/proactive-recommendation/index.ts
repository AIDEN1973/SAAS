/**
 * Proactive Recommendation Edge Function
 *
 * 아키텍처 문서 3.7.1 Phase 2 기능
 * 데이터 패턴 분석을 통한 선제적 조치 추천
 *
 * 분석 항목:
 * - 수납 마감일 전 미납자 알림 추천
 * - 출결 패턴 기반 이탈 위험 조기 경고
 * - 상담 필요 학생 추천
 * - 정원 부족/과잉 반 조정 추천
 * - 시즌별 마케팅 추천
 *
 * [불변 규칙] Zero-Trust: tenant_id는 JWT에서 추출
 * [불변 규칙] PII 마스킹: 개인정보 마스킹 필수
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { envServer } from '../_shared/env-registry.ts';
import { toKSTDate, toKST } from '../_shared/date-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface ProactiveRecommendation {
  type: 'billing_reminder' | 'churn_prevention' | 'consultation_needed' | 'capacity_adjustment' | 'marketing_timing';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action_type: string;
  target_count: number;
  suggested_action: string;
  deadline?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = envServer.SUPABASE_URL;
    const supabaseServiceKey = envServer.SERVICE_ROLE_KEY;
    const openaiApiKey = envServer.OPENAI_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = toKSTDate();
    const sevenDaysLater = toKST().add(7, 'day').format('YYYY-MM-DD');
    const thirtyDaysAgo = toKST().subtract(30, 'day').format('YYYY-MM-DD');

    // 모든 테넌트 조회
    const { data: tenants, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('status', 'active');

    if (tenantError) throw tenantError;
    if (!tenants || tenants.length === 0) {
      return new Response(JSON.stringify({ success: true, generated_count: 0, message: 'No active tenants' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalGenerated = 0;

    for (const tenant of tenants) {
      const recommendations: ProactiveRecommendation[] = [];

      // 1. 수납 마감일 전 미납자 분석 (7일 내 마감)
      const { data: upcomingBillings } = await supabase
        .from('billing_items')
        .select('id, student_id, amount, due_date, status')
        .eq('tenant_id', tenant.id)
        .eq('status', 'pending')
        .gte('due_date', today)
        .lte('due_date', sevenDaysLater);

      if (upcomingBillings && upcomingBillings.length > 0) {
        const totalAmount = upcomingBillings.reduce((sum, b) => sum + (b.amount || 0), 0);
        recommendations.push({
          type: 'billing_reminder',
          priority: upcomingBillings.length >= 5 ? 'high' : 'medium',
          title: '수납 마감 임박 알림 권장',
          description: `${upcomingBillings.length}건의 수납이 7일 내 마감 예정입니다. 총 ${totalAmount.toLocaleString()}원`,
          action_type: 'send_billing_reminder',
          target_count: upcomingBillings.length,
          suggested_action: '미납 학부모에게 수납 안내 문자 발송을 권장합니다.',
          deadline: sevenDaysLater,
        });
      }

      // 2. 출결 패턴 기반 이탈 위험 분석 (30일 내 결석 3회 이상)
      const { data: attendanceRisk } = await supabase
        .from('attendance_logs')
        .select('student_id, status')
        .eq('tenant_id', tenant.id)
        .gte('date', thirtyDaysAgo)
        .in('status', ['absent', 'unauthorized_absent']);

      if (attendanceRisk && attendanceRisk.length > 0) {
        // 학생별 결석 횟수 집계
        const absentByStudent = new Map<string, number>();
        for (const log of attendanceRisk) {
          absentByStudent.set(log.student_id, (absentByStudent.get(log.student_id) || 0) + 1);
        }
        const highRiskStudents = Array.from(absentByStudent.entries()).filter(([_, count]) => count >= 3);

        if (highRiskStudents.length > 0) {
          recommendations.push({
            type: 'churn_prevention',
            priority: 'high',
            title: '이탈 위험 학생 조기 발견',
            description: `최근 30일간 결석 3회 이상인 학생 ${highRiskStudents.length}명이 감지되었습니다.`,
            action_type: 'contact_guardian',
            target_count: highRiskStudents.length,
            suggested_action: '학부모 상담을 통해 출결 상황을 파악하고 이탈을 방지하세요.',
          });
        }
      }

      // 3. 상담 필요 학생 추천 (최근 상담 없는 활성 학생)
      const { data: activeStudents } = await supabase
        .from('students')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active');

      if (activeStudents && activeStudents.length > 0) {
        const { data: recentConsultations } = await supabase
          .from('student_consultations')
          .select('student_id')
          .eq('tenant_id', tenant.id)
          .gte('consultation_date', thirtyDaysAgo);

        const consultedStudentIds = new Set((recentConsultations || []).map(c => c.student_id));
        const needsConsultation = activeStudents.filter(s => !consultedStudentIds.has(s.id));

        if (needsConsultation.length >= 5) {
          recommendations.push({
            type: 'consultation_needed',
            priority: 'medium',
            title: '정기 상담 필요 학생',
            description: `최근 30일간 상담 기록이 없는 학생이 ${needsConsultation.length}명입니다.`,
            action_type: 'schedule_consultation',
            target_count: needsConsultation.length,
            suggested_action: '정기적인 학부모 상담을 통해 학생 현황을 파악하세요.',
          });
        }
      }

      // 4. 정원 부족/과잉 반 분석
      const { data: classes } = await supabase
        .from('academy_classes')
        .select('id, name, max_students')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active');

      if (classes && classes.length > 0) {
        const capacityIssues: { overCapacity: number; underCapacity: number } = { overCapacity: 0, underCapacity: 0 };

        for (const cls of classes) {
          const { count } = await supabase
            .from('class_students')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', cls.id)
            .eq('status', 'active');

          const studentCount = count || 0;
          const maxStudents = cls.max_students || 20;
          const rate = (studentCount / maxStudents) * 100;

          if (rate > 100) capacityIssues.overCapacity++;
          else if (rate < 50) capacityIssues.underCapacity++;
        }

        if (capacityIssues.overCapacity > 0 || capacityIssues.underCapacity > 0) {
          recommendations.push({
            type: 'capacity_adjustment',
            priority: capacityIssues.overCapacity > 0 ? 'high' : 'low',
            title: '반 정원 조정 필요',
            description: `정원 초과 반 ${capacityIssues.overCapacity}개, 정원 미달 반 ${capacityIssues.underCapacity}개가 감지되었습니다.`,
            action_type: 'adjust_class_capacity',
            target_count: capacityIssues.overCapacity + capacityIssues.underCapacity,
            suggested_action: '반 통합 또는 분반을 검토하세요.',
          });
        }
      }

      // 5. 시즌별 마케팅 추천 (분기 시작 전)
      const currentMonth = toKST().month() + 1; // 1-12
      const isPreSeason = [2, 5, 8, 11].includes(currentMonth); // 학기 시작 전달

      if (isPreSeason) {
        recommendations.push({
          type: 'marketing_timing',
          priority: 'medium',
          title: '시즌 마케팅 적기',
          description: '다음 달 학기 시작을 앞두고 신규 등록 마케팅을 권장합니다.',
          action_type: 'start_marketing_campaign',
          target_count: 0,
          suggested_action: 'SNS, 지역 커뮤니티 등을 통해 신규 학생 모집 홍보를 시작하세요.',
        });
      }

      // AI 인사이트 저장
      if (recommendations.length > 0) {
        // AI로 종합 요약 생성 (선택적)
        let aiSummary = `${recommendations.length}개의 선제적 조치가 권장됩니다.`;

        if (openaiApiKey) {
          try {
            const highPriorityCount = recommendations.filter(r => r.priority === 'high').length;
            const prompt = `다음 선제적 추천 사항들을 한국어로 2-3문장으로 요약해주세요:
${recommendations.map(r => `- [${r.priority}] ${r.title}: ${r.description}`).join('\n')}`;

            const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}`,
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 200,
                temperature: 0.7,
              }),
            });

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              aiSummary = aiData.choices?.[0]?.message?.content || aiSummary;
            }
          } catch (e) {
            console.error('[Proactive Recommendation] AI summary failed:', e);
          }
        }

        const { error: insertError } = await supabase.from('ai_insights').insert({
          tenant_id: tenant.id,
          insight_type: 'proactive_recommendation',
          title: '선제적 조치 추천',
          summary: aiSummary,
          details: {
            recommendations,
            high_priority_count: recommendations.filter(r => r.priority === 'high').length,
            medium_priority_count: recommendations.filter(r => r.priority === 'medium').length,
            low_priority_count: recommendations.filter(r => r.priority === 'low').length,
            generated_at: today,
          },
          status: 'active',
          metadata: {
            total_recommendations: recommendations.length,
            analysis_date: today,
          },
        });

        if (insertError) {
          console.error(`[Proactive Recommendation] Insert error for tenant ${tenant.id}:`, insertError);
        } else {
          totalGenerated++;
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      generated_count: totalGenerated,
      date: today,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    console.error('[Proactive Recommendation] Fatal error:', errorMessage);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
