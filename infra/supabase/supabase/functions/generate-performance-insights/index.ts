/**
 * AI 성과 분석 인사이트 생성 Edge Function
 *
 * 아키텍처 문서 3.7.1 섹션 참조
 * 반별 종합 성과 데이터를 분석하여 AI 기반 인사이트 생성
 *
 * 분석 항목:
 * - 출석률/지각률/결석률
 * - 학생 등록/이탈 추이
 * - 상담 기록 현황
 * - 수납률/미납 현황
 * - 정원 대비 현재 인원
 * - 강사 배정 상태
 *
 * [불변 규칙] Zero-Trust: tenant_id는 JWT에서 추출 (요청 본문에서 받지 않음)
 * [불변 규칙] PII 마스킹: 개인정보 마스킹 필수
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withTenant } from '../_shared/withTenant.ts';
import { envServer } from '../_shared/env-registry.ts';
import { toKSTDate, toKST } from '../_shared/date-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface DetailInsight {
  type: 'improvement' | 'strength' | 'pattern' | 'comparison' | 'warning' | 'opportunity';
  title: string;
  description: string;
  severity?: 'high' | 'medium' | 'low';
  category?: 'attendance' | 'enrollment' | 'consultation' | 'billing' | 'capacity' | 'teacher';
}

interface ClassPerformanceData {
  class_id: string;
  class_name: string;
  subject?: string;
  grade?: string;
  attendance_rate: number;
  absent_rate: number;
  late_rate: number;
  attendance_trend: string;
  total_sessions: number;
  student_count: number;
  max_students: number;
  capacity_rate: number;
  new_enrollments: number;
  withdrawals: number;
  enrollment_trend: string;
  consultation_count: number;
  learning_consultations: number;
  behavior_consultations: number;
  billing_collection_rate: number;
  overdue_count: number;
  total_revenue: number;
  teacher_count: number;
  has_main_teacher: boolean;
}

function extractTenantIdFromJWT(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.substring(7);
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const payload = JSON.parse(atob(base64));
    return payload.tenant_id || null;
  } catch {
    return null;
  }
}

async function generateAIInsights(openaiApiKey: string, classData: ClassPerformanceData): Promise<DetailInsight[]> {
  const prompt = `다음은 학원 반(클래스)의 종합 성과 데이터입니다. 분석하여 3-5개의 핵심 인사이트를 JSON 배열로 제공해주세요.

## 반 기본 정보
- 반 이름: ${classData.class_name}
${classData.subject ? `- 과목: ${classData.subject}` : ''}
${classData.grade ? `- 대상 학년: ${classData.grade}` : ''}

## 출석 현황 (최근 7일)
- 출석률: ${classData.attendance_rate}%, 결석률: ${classData.absent_rate}%, 지각률: ${classData.late_rate}%
- 출석 추세: ${classData.attendance_trend}, 총 수업 횟수: ${classData.total_sessions}회

## 학생 현황
- 현재 학생 수: ${classData.student_count}명, 정원: ${classData.max_students}명, 정원 충족률: ${classData.capacity_rate}%
- 최근 신규 등록: ${classData.new_enrollments}명, 이탈: ${classData.withdrawals}명, 등록 추세: ${classData.enrollment_trend}

## 상담 현황 (최근 30일)
- 총 상담: ${classData.consultation_count}건, 학습: ${classData.learning_consultations}건, 행동: ${classData.behavior_consultations}건

## 수납 현황
- 수납률: ${classData.billing_collection_rate}%, 미납: ${classData.overdue_count}건, 총 매출: ${classData.total_revenue.toLocaleString()}원

## 강사 배정
- 담당 강사: ${classData.teacher_count}명, 담임 배정: ${classData.has_main_teacher ? '있음' : '없음'}

응답 형식:
[{"type": "improvement|strength|pattern|warning|opportunity", "title": "제목(15자이내)", "description": "설명(80자이내)", "severity": "high|medium|low", "category": "attendance|enrollment|consultation|billing|capacity|teacher"}]`;

  const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiApiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '학원 운영 데이터 분석 전문가. JSON 배열만 응답.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 800,
    }),
  });

  if (!openaiResponse.ok) throw new Error(`OpenAI API 호출 실패: ${openaiResponse.status}`);
  const openaiData = await openaiResponse.json();
  const content = openaiData.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('AI 인사이트 생성에 실패했습니다.');
  const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleanContent) as DetailInsight[];
}

function getPerformanceGrade(data: ClassPerformanceData): string {
  let score = 0;
  if (data.attendance_rate >= 95) score += 30;
  else if (data.attendance_rate >= 85) score += 20;
  else if (data.attendance_rate >= 75) score += 10;
  if (data.capacity_rate >= 80) score += 20;
  else if (data.capacity_rate >= 60) score += 15;
  else if (data.capacity_rate >= 40) score += 10;
  if (data.billing_collection_rate >= 95) score += 20;
  else if (data.billing_collection_rate >= 85) score += 15;
  else if (data.billing_collection_rate >= 75) score += 10;
  const churnRate = data.student_count > 0 ? (data.withdrawals / data.student_count) * 100 : 0;
  if (churnRate <= 5) score += 15;
  else if (churnRate <= 10) score += 10;
  else if (churnRate <= 15) score += 5;
  if (data.has_main_teacher && data.teacher_count >= 1) score += 15;
  else if (data.teacher_count >= 1) score += 10;
  if (score >= 85) return '우수';
  if (score >= 70) return '양호';
  if (score >= 50) return '보통';
  return '개선 필요';
}

function getTrend(currentRate: number, previousRate: number | null): string {
  if (previousRate === null) return '데이터 수집 중';
  const diff = currentRate - previousRate;
  if (diff > 5) return '상승';
  if (diff < -5) return '하락';
  return '유지';
}

function generateFallbackInsights(data: ClassPerformanceData): DetailInsight[] {
  const insights: DetailInsight[] = [];
  if (data.attendance_rate >= 90) {
    insights.push({ type: 'strength', title: '우수한 출석률', description: `출석률 ${data.attendance_rate}%로 양호합니다.`, severity: 'low', category: 'attendance' });
  } else if (data.attendance_rate < 75) {
    insights.push({ type: 'warning', title: '출석률 개선 필요', description: `출석률 ${data.attendance_rate}%로 낮습니다.`, severity: 'high', category: 'attendance' });
  }
  if (data.capacity_rate < 50) {
    insights.push({ type: 'opportunity', title: '정원 여유', description: `정원 충족률 ${data.capacity_rate}%.`, severity: 'medium', category: 'capacity' });
  }
  if (!data.has_main_teacher) {
    insights.push({ type: 'warning', title: '담임 강사 미배정', description: '담임 강사가 배정되지 않았습니다.', severity: 'medium', category: 'teacher' });
  }
  return insights.length > 0 ? insights : [{ type: 'pattern', title: '데이터 분석 중', description: '더 많은 데이터가 축적되면 상세한 인사이트를 제공합니다.', severity: 'low', category: 'attendance' }];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const openaiApiKey = envServer.OPENAI_API_KEY;
    if (!openaiApiKey) throw new Error('OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');

    const authHeader = req.headers.get('authorization');
    const tenant_id = extractTenantIdFromJWT(authHeader);
    const isCronJob = !tenant_id && req.headers.get('x-cron-job') === 'true';

    const supabase = createClient(envServer.SUPABASE_URL, envServer.SERVICE_ROLE_KEY);
    const kstTime = toKST();
    const today = toKSTDate();
    const sevenDaysAgo = toKSTDate(new Date(kstTime.getTime() - 7 * 24 * 60 * 60 * 1000));
    const fourteenDaysAgo = toKSTDate(new Date(kstTime.getTime() - 14 * 24 * 60 * 60 * 1000));
    const thirtyDaysAgo = toKSTDate(new Date(kstTime.getTime() - 30 * 24 * 60 * 60 * 1000));

    let tenantsToProcess: { id: string }[] = [];

    if (isCronJob) {
      const { data: tenants, error: tenantsError } = await supabase.from('tenants').select('id').eq('status', 'active');
      if (tenantsError) throw new Error(`Failed to fetch tenants: ${tenantsError.message}`);
      tenantsToProcess = tenants || [];
      console.log(`[Performance Insights] Cron job: found ${tenantsToProcess.length} active tenants`);
    } else if (tenant_id) {
      tenantsToProcess = [{ id: tenant_id }];
    } else {
      return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let totalGenerated = 0;
    const debugInfo: Record<string, unknown>[] = [];

    for (const tenant of tenantsToProcess) {
      try {
        console.log(`[Performance Insights] Processing tenant: ${tenant.id}`);

        // AI 기능 활성화 여부 확인 (tenant_features 테이블에서 직접 조회)
        const { data: aiFeature, error: aiFeatureError } = await supabase
          .from('tenant_features')
          .select('enabled')
          .eq('tenant_id', tenant.id)
          .eq('feature_key', 'ai')
          .single();

        // AI 기능이 명시적으로 비활성화(enabled=false)된 경우에만 skip
        // 레코드가 없거나 에러면 기본 활성화로 처리 (신규 테넌트를 위해)
        const aiEnabled = aiFeatureError ? true : aiFeature?.enabled !== false;
        console.log(`[Performance Insights] Tenant ${tenant.id}: AI feature=${JSON.stringify(aiFeature)}, error=${aiFeatureError?.message || 'none'}, enabled=${aiEnabled}`);

        if (!aiEnabled) {
          debugInfo.push({ tenant_id: tenant.id, skipped: true, reason: 'AI disabled' });
          continue;
        }

        // 오늘 생성된 같은 타입의 인사이트 삭제
        await supabase.from('ai_insights').delete()
          .eq('tenant_id', tenant.id)
          .eq('insight_type', 'performance_analysis')
          .gte('created_at', `${today}T00:00:00`)
          .lte('created_at', `${today}T23:59:59`);

        const { data: classes, error: classesError } = await withTenant(
          supabase.from('academy_classes').select('id, name, subject, grade, capacity, current_count').eq('status', 'active'),
          tenant.id
        );

        console.log(`[Performance Insights] Tenant ${tenant.id}: found ${classes?.length || 0} active classes`);

        if (classesError || !classes || classes.length === 0) {
          debugInfo.push({ tenant_id: tenant.id, skipped: true, reason: 'No active classes', classesError: classesError?.message });
          continue;
        }

        const classInsights: Array<{
          tenant_id: string;
          insight_type: string;
          title: string;
          summary: string;
          details: Record<string, unknown>;
          related_entity_type: string;
          related_entity_id: string;
          status: string;
        }> = [];

        for (const cls of classes) {
          const { data: recentAttendance } = await withTenant(
            supabase.from('attendance_logs').select('status, occurred_at, student_id').eq('class_id', cls.id).gte('occurred_at', `${sevenDaysAgo}T00:00:00`).lte('occurred_at', `${today}T23:59:59`),
            tenant.id
          );

          const { data: previousAttendance } = await withTenant(
            supabase.from('attendance_logs').select('status').eq('class_id', cls.id).gte('occurred_at', `${fourteenDaysAgo}T00:00:00`).lt('occurred_at', `${sevenDaysAgo}T00:00:00`),
            tenant.id
          );

          const totalLogs = recentAttendance?.length || 0;
          const presentCount = recentAttendance?.filter((log: { status: string }) => log.status === 'present').length || 0;
          const absentCount = recentAttendance?.filter((log: { status: string }) => log.status === 'absent').length || 0;
          const lateCount = recentAttendance?.filter((log: { status: string }) => log.status === 'late').length || 0;

          const attendanceRate = totalLogs > 0 ? Math.round((presentCount / totalLogs) * 100) : 0;
          const absentRate = totalLogs > 0 ? Math.round((absentCount / totalLogs) * 100) : 0;
          const lateRate = totalLogs > 0 ? Math.round((lateCount / totalLogs) * 100) : 0;

          let previousRate: number | null = null;
          if (previousAttendance && previousAttendance.length > 0) {
            const prevPresent = previousAttendance.filter((log: { status: string }) => log.status === 'present').length;
            previousRate = Math.round((prevPresent / previousAttendance.length) * 100);
          }
          const attendanceTrend = getTrend(attendanceRate, previousRate);

          const { data: enrollments } = await withTenant(
            supabase.from('student_classes').select('enrolled_at, left_at, is_active').eq('class_id', cls.id),
            tenant.id
          );

          const activeStudents = enrollments?.filter((e: { is_active: boolean }) => e.is_active).length || 0;
          const newEnrollments = enrollments?.filter((e: { enrolled_at: string }) => e.enrolled_at >= thirtyDaysAgo).length || 0;
          const withdrawals = enrollments?.filter((e: { left_at: string | null }) => e.left_at && e.left_at >= thirtyDaysAgo).length || 0;
          const enrollmentTrend = newEnrollments > withdrawals ? '증가' : newEnrollments < withdrawals ? '감소' : '유지';

          const maxStudents = cls.capacity || 20;
          const capacityRate = Math.round((activeStudents / maxStudents) * 100);

          const studentIds = recentAttendance ? [...new Set(recentAttendance.map((a: { student_id: string }) => a.student_id))] : [];
          let consultationCount = 0, learningConsultations = 0, behaviorConsultations = 0;

          if (studentIds.length > 0) {
            const { data: consultations } = await withTenant(
              supabase.from('student_consultations').select('consultation_type').in('student_id', studentIds).gte('consultation_date', thirtyDaysAgo),
              tenant.id
            );
            if (consultations) {
              consultationCount = consultations.length;
              learningConsultations = consultations.filter((c: { consultation_type: string }) => c.consultation_type === 'learning').length;
              behaviorConsultations = consultations.filter((c: { consultation_type: string }) => c.consultation_type === 'behavior').length;
            }
          }

          let billingCollectionRate = 100, overdueCount = 0, totalRevenue = 0;
          if (studentIds.length > 0) {
            const { data: invoices } = await withTenant(
              supabase.from('invoices').select('amount, amount_paid, status').in('student_id', studentIds).gte('period_start', thirtyDaysAgo),
              tenant.id
            );
            if (invoices && invoices.length > 0) {
              const totalAmount = invoices.reduce((sum: number, inv: { amount?: number }) => sum + (inv.amount || 0), 0);
              const paidAmount = invoices.reduce((sum: number, inv: { amount_paid?: number }) => sum + (inv.amount_paid || 0), 0);
              billingCollectionRate = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 100;
              overdueCount = invoices.filter((inv: { status: string }) => inv.status === 'overdue').length;
              totalRevenue = paidAmount;
            }
          }

          const { data: classTeachers } = await withTenant(
            supabase.from('class_teachers').select('role').eq('class_id', cls.id).eq('is_active', true),
            tenant.id
          );

          const teacherCount = classTeachers?.length || 0;
          const hasMainTeacher = classTeachers?.some((t: { role: string }) => t.role === 'teacher') || false;

          const classData: ClassPerformanceData = {
            class_id: cls.id, class_name: cls.name, subject: cls.subject, grade: cls.grade,
            attendance_rate: attendanceRate, absent_rate: absentRate, late_rate: lateRate,
            attendance_trend: attendanceTrend, total_sessions: totalLogs,
            student_count: activeStudents, max_students: maxStudents, capacity_rate: capacityRate,
            new_enrollments: newEnrollments, withdrawals: withdrawals, enrollment_trend: enrollmentTrend,
            consultation_count: consultationCount, learning_consultations: learningConsultations, behavior_consultations: behaviorConsultations,
            billing_collection_rate: billingCollectionRate, overdue_count: overdueCount, total_revenue: totalRevenue,
            teacher_count: teacherCount, has_main_teacher: hasMainTeacher,
          };

          let detailInsights: DetailInsight[] = [];
          try {
            detailInsights = await generateAIInsights(openaiApiKey, classData);
          } catch (aiError) {
            console.error(`[Performance Insights] AI generation failed for class ${cls.id}:`, aiError);
            detailInsights = generateFallbackInsights(classData);
          }

          const performance = getPerformanceGrade(classData);
          let recommendation = '현재 운영 상태가 양호합니다.';
          if (performance === '개선 필요') recommendation = '여러 지표에서 개선이 필요합니다.';
          else if (performance === '보통') recommendation = '일부 영역에서 개선 여지가 있습니다.';

          // trend 필드 계산: 성과 등급에 따른 추세 표시
          const trendValue = performance === '우수' ? '+5%' :
                             performance === '양호' ? '+2%' :
                             performance === '보통' ? '0%' : '-5%';

          classInsights.push({
            tenant_id: tenant.id,
            insight_type: 'performance_analysis',
            title: `${cls.name} 종합 성과 분석`,
            summary: `종합 등급: ${performance} | 출석 ${attendanceRate}% | 정원 ${capacityRate}% | 수납 ${billingCollectionRate}%`,
            details: {
              class_id: cls.id, class_name: cls.name, subject: cls.subject, grade: cls.grade,
              performance, trend: trendValue, recommendation, insights: [recommendation], action_url: `/classes/${cls.id}`,
              attendance_rate: attendanceRate, absent_rate: absentRate, late_rate: lateRate,
              attendance_trend: attendanceTrend, previous_attendance_rate: previousRate,
              student_count: activeStudents, max_students: maxStudents, capacity_rate: capacityRate,
              new_enrollments: newEnrollments, withdrawals: withdrawals, enrollment_trend: enrollmentTrend,
              consultation_count: consultationCount, learning_consultations: learningConsultations, behavior_consultations: behaviorConsultations,
              billing_collection_rate: billingCollectionRate, overdue_count: overdueCount, total_revenue: totalRevenue,
              teacher_count: teacherCount, has_main_teacher: hasMainTeacher,
              detail_insights: detailInsights, analysis_period: { start: sevenDaysAgo, end: today },
            },
            related_entity_type: 'class',
            related_entity_id: cls.id,
            status: 'active',
          });
        }

        if (classInsights.length > 0) {
          console.log(`[Performance Insights] Inserting ${classInsights.length} insights for tenant ${tenant.id}`);
          const { error: insertError } = await supabase.from('ai_insights').insert(classInsights);
          if (!insertError) {
            totalGenerated += classInsights.length;
            debugInfo.push({ tenant_id: tenant.id, generated: classInsights.length });
            console.log(`[Performance Insights] Successfully generated ${classInsights.length} insights for tenant ${tenant.id}`);
          } else {
            debugInfo.push({ tenant_id: tenant.id, error: insertError.message });
            console.error(`[Performance Insights] Failed to insert for tenant ${tenant.id}:`, JSON.stringify(insertError));
          }
        }
      } catch (error) {
        console.error(`[Performance Insights] Error processing tenant ${tenant.id}:`, error);
        debugInfo.push({ tenant_id: tenant.id, error: String(error) });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      generated_count: totalGenerated,
      date: today,
      debug: { tenants_processed: tenantsToProcess.length, details: debugInfo }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    console.error('[Performance Insights] Fatal error:', errorMessage);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
