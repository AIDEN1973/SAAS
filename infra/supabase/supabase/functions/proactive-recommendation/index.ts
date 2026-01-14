/**
 * Proactive Recommendation Edge Function
 *
 * 아키텍처 문서 3.7.1 Phase 2 기능
 * 데이터 패턴 분석을 통한 선제적 조치 추천
 *
 * 분석 항목:
 * - 수납 마감일 전 미납자 알림 추천
 * - 출결 패턴 기반 이탈 위험 조기 경고
 * - 상담 필요 대상 추천
 * - 정원 부족/과잉 그룹 조정 추천
 * - 시즌별 마케팅 추천
 *
 * [불변 규칙] Zero-Trust: tenant_id는 JWT에서 추출
 * [불변 규칙] Industry Neutrality: 업종 중립적 용어 사용
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
        // 대상자 정보 조회 (이름 포함)
        const studentIds = [...new Set(upcomingBillings.map(b => b.student_id))];
        const { data: students } = await supabase
          .from('persons')
          .select('id, name')
          .eq('tenant_id', tenant.id)
          .in('id', studentIds);

        const studentNameMap = new Map(students?.map(s => [s.id, s.name]) || []);
        const totalAmount = upcomingBillings.reduce((sum, b) => sum + (b.amount || 0), 0);

        const studentNames = studentIds.slice(0, 5).map(id => studentNameMap.get(id) || '').filter(Boolean).join(', ');
        const moreCount = studentIds.length > 5 ? ` 외 ${studentIds.length - 5}명` : '';
        const detailDescription = `7일 내 마감: ${studentNames}${moreCount} (${upcomingBillings.length}건, ${totalAmount.toLocaleString()}원)`;

        recommendations.push({
          type: 'billing_reminder',
          priority: upcomingBillings.length >= 5 ? 'high' : 'medium',
          title: '수납 마감 임박 알림 권장',
          description: detailDescription,
          action_type: 'send_billing_reminder',
          target_count: upcomingBillings.length,
          suggested_action: '미납 대상자에게 수납 안내 문자 발송을 권장합니다.',
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
        // 대상자별 결석 횟수 집계
        const absentByStudent = new Map<string, number>();
        for (const log of attendanceRisk) {
          absentByStudent.set(log.student_id, (absentByStudent.get(log.student_id) || 0) + 1);
        }
        const highRiskStudents = Array.from(absentByStudent.entries()).filter(([_, count]) => count >= 3);

        if (highRiskStudents.length > 0) {
          // 대상자 정보 조회 (이름 포함)
          const { data: students } = await supabase
            .from('persons')
            .select('id, name')
            .eq('tenant_id', tenant.id)
            .in('id', highRiskStudents.map(([id]) => id));

          const studentNames = students?.map(s => s.name).join(', ') || '';
          const detailDescription = studentNames
            ? `최근 30일간 결석 3회 이상: ${studentNames} (총 ${highRiskStudents.length}명)`
            : `최근 30일간 결석 3회 이상인 대상 ${highRiskStudents.length}명 감지`;

          recommendations.push({
            type: 'churn_prevention',
            priority: 'high',
            title: '이탈 위험 대상 조기 발견',
            description: detailDescription,
            action_type: 'contact_guardian',
            target_count: highRiskStudents.length,
            suggested_action: '보호자 상담을 통해 출결 상황을 파악하고 이탈을 방지하세요.',
          });
        }
      }

      // 3. 상담 필요 대상 추천 (최근 상담 없는 활성 대상)
      const { data: activeStudents } = await supabase
        .from('persons')
        .select('id, name')
        .eq('tenant_id', tenant.id)
        .eq('person_type', 'student')
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
          const studentNames = needsConsultation.slice(0, 10).map(s => s.name).join(', ');
          const moreCount = needsConsultation.length > 10 ? ` 외 ${needsConsultation.length - 10}명` : '';
          const detailDescription = `최근 30일간 상담 미실시: ${studentNames}${moreCount} (총 ${needsConsultation.length}명)`;

          recommendations.push({
            type: 'consultation_needed',
            priority: 'medium',
            title: '정기 상담 필요 대상',
            description: detailDescription,
            action_type: 'schedule_consultation',
            target_count: needsConsultation.length,
            suggested_action: '정기적인 보호자 상담을 통해 대상 현황을 파악하세요.',
          });
        }
      }

      // 4. 정원 부족/과잉 그룹 분석
      const { data: classes } = await supabase
        .from('academy_classes')
        .select('id, name, max_students')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active');

      if (classes && classes.length > 0) {
        const overCapacityClasses: string[] = [];
        const underCapacityClasses: string[] = [];

        for (const cls of classes) {
          const { count } = await supabase
            .from('class_students')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', cls.id)
            .eq('status', 'active');

          const studentCount = count || 0;
          const maxStudents = cls.max_students || 20;
          const rate = (studentCount / maxStudents) * 100;

          if (rate > 100) overCapacityClasses.push(`${cls.name}(${studentCount}/${maxStudents})`);
          else if (rate < 50) underCapacityClasses.push(`${cls.name}(${studentCount}/${maxStudents})`);
        }

        if (overCapacityClasses.length > 0 || underCapacityClasses.length > 0) {
          const overDetail = overCapacityClasses.length > 0 ? `정원 초과: ${overCapacityClasses.join(', ')}` : '';
          const underDetail = underCapacityClasses.length > 0 ? `정원 미달: ${underCapacityClasses.join(', ')}` : '';
          const separator = overDetail && underDetail ? ' / ' : '';
          const detailDescription = `${overDetail}${separator}${underDetail}`;

          recommendations.push({
            type: 'capacity_adjustment',
            priority: overCapacityClasses.length > 0 ? 'high' : 'low',
            title: '그룹 정원 조정 필요',
            description: detailDescription,
            action_type: 'adjust_class_capacity',
            target_count: overCapacityClasses.length + underCapacityClasses.length,
            suggested_action: '그룹 통합 또는 분할을 검토하세요.',
          });
        }
      }

      // 5. 시즌별 마케팅 추천 (분기 시작 전)
      const currentMonth = toKST().month() + 1; // 1-12
      const isPreSeason = [2, 5, 8, 11].includes(currentMonth); // 시즌 시작 전달

      if (isPreSeason) {
        recommendations.push({
          type: 'marketing_timing',
          priority: 'medium',
          title: '시즌 마케팅 적기',
          description: '다음 달 시즌 시작을 앞두고 신규 등록 마케팅을 권장합니다.',
          action_type: 'start_marketing_campaign',
          target_count: 0,
          suggested_action: 'SNS, 지역 커뮤니티 등을 통해 신규 구성원 모집 홍보를 시작하세요.',
        });
      }

      // AI 인사이트 저장
      if (recommendations.length > 0) {
        // AI로 종합 요약 생성 (선택적)
        let aiSummary = `${recommendations.length}개의 선제적 조치가 권장됩니다.`;

        if (openaiApiKey) {
          try {
            const highPriorityCount = recommendations.filter(r => r.priority === 'high').length;
            const prompt = `다음 선제적 추천 사항들을 한국어로 2-3문장으로 요약해주세요.

중요:
- 구체적인 대상자 이름과 숫자를 반드시 포함
- 추상적이거나 두리뭉실한 표현 금지 (예: "일부 대상" → 구체적 이름 명시)
- 우선순위가 높은 항목을 먼저 언급
- 업종 중립적 용어 사용 (학생→대상/구성원 등)

추천 사항:
${recommendations.map(r => `- [${r.priority}] ${r.title}: ${r.description}`).join('\n')}`;

            const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}`,
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                  { role: 'system', content: '운영 데이터 분석 전문가. 구체적 대상명과 수치를 포함한 실행 가능한 조치사항 제시. 추상적 표현 금지. 업종 중립적 용어 사용.' },
                  { role: 'user', content: prompt }
                ],
                max_tokens: 300,
                temperature: 0.5,
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
