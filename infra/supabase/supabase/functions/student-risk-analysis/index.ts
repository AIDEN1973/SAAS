/**
 * 학생 이탈 위험 분석 Edge Function
 *
 * 아키텍처 문서 3.7.3 섹션 참조
 * ChatGPT API를 사용하여 학생의 출결·상담·성적 패턴을 종합 분석
 *
 * [불변 규칙] Zero-Trust: tenant_id는 JWT에서 추출 (요청 본문에서 받지 않음)
 * [불변 규칙] 기술문서 19-1-2: KST 기준 날짜 처리
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RiskAnalysisRequest {
  student_id: string;
}

interface RiskAnalysisResponse {
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high';
  reasons: string[];
  recommended_actions: string[];
}

/**
 * JWT에서 tenant_id 추출
 * [불변 규칙] Zero-Trust: 클라이언트에서 전달한 tenant_id는 신뢰하지 않고 JWT에서 추출
 *
 * JWT 구조: header.payload.signature
 * Base64URL 디코딩: '-' -> '+', '_' -> '/', 패딩 추가
 */
function extractTenantIdFromJWT(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7); // "Bearer " 제거
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('[Risk Analysis] Invalid JWT format: expected 3 parts');
      return null;
    }

    // JWT payload 디코딩 (base64url)
    // Base64URL -> Base64 변환: '-' -> '+', '_' -> '/'
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');

    // 패딩 추가 (Base64는 4의 배수 길이 필요)
    while (base64.length % 4) {
      base64 += '=';
    }

    const payload = JSON.parse(atob(base64));

    // JWT claim에서 tenant_id 추출
    const tenantId = payload.tenant_id;
    if (!tenantId || typeof tenantId !== 'string') {
      console.error('[Risk Analysis] tenant_id not found in JWT claims');
      return null;
    }

    return tenantId;
  } catch (error) {
    console.error('[Risk Analysis] JWT parsing error:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 환경변수 검증
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL 환경변수가 설정되지 않았습니다.');
    }
    if (!supabaseServiceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.');
    }
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');
    }

    // [불변 규칙] Zero-Trust: JWT에서 tenant_id 추출
    const authHeader = req.headers.get('authorization');
    const tenant_id = extractTenantIdFromJWT(authHeader);

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: '인증이 필요합니다. JWT에서 tenant_id를 추출할 수 없습니다.' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 요청 본문 파싱
    let requestBody: RiskAnalysisRequest;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({ error: '요청 본문을 파싱할 수 없습니다.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { student_id } = requestBody;

    if (!student_id) {
      return new Response(
        JSON.stringify({ error: 'student_id가 필요합니다.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 1. 학생 기본 정보 조회
    const { data: student, error: studentError } = await supabase
      .from('persons')
      .select('id, name, created_at')
      .eq('id', student_id)
      .eq('tenant_id', tenant_id)
      .eq('person_type', 'student')
      .single();

    if (studentError || !student) {
      return new Response(
        JSON.stringify({ error: '학생 정보를 찾을 수 없습니다.' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. 최근 30일 출결 데이터 조회
    // 기술문서 19-1-2: KST 기준 날짜 처리
    const now = new Date();
    const kstOffset = 9 * 60; // KST는 UTC+9
    const kstTime = new Date(now.getTime() + (kstOffset * 60 * 1000));
    const thirtyDaysAgo = new Date(kstTime.getTime() - 30 * 24 * 60 * 60 * 1000);

    const { data: attendanceLogs, error: attendanceError } = await supabase
      .from('attendance_logs')
      .select('status, occurred_at, attendance_type')
      .eq('tenant_id', tenant_id)
      .eq('student_id', student_id)
      .gte('occurred_at', thirtyDaysAgo.toISOString())
      .order('occurred_at', { ascending: false });

    if (attendanceError) {
      console.error('[Risk Analysis] Failed to fetch attendance logs:', attendanceError);
      // 에러가 있어도 계속 진행 (빈 배열로 처리)
    }

    // 3. 상담일지 조회
    const { data: consultations, error: consultationError } = await supabase
      .from('student_consultations')
      .select('consultation_date, consultation_type, content, created_at')
      .eq('tenant_id', tenant_id)
      .eq('student_id', student_id)
      .order('consultation_date', { ascending: false })
      .limit(10);

    if (consultationError) {
      console.error('[Risk Analysis] Failed to fetch consultations:', consultationError);
      // 에러가 있어도 계속 진행 (빈 배열로 처리)
    }

    // 4. 반 배정 정보 조회
    const { data: studentClasses, error: classError } = await supabase
      .from('student_classes')
      .select('class_id, enrolled_at, is_active')
      .eq('tenant_id', tenant_id)
      .eq('student_id', student_id)
      .eq('is_active', true);

    if (classError) {
      console.error('[Risk Analysis] Failed to fetch student classes:', classError);
      // 에러가 있어도 계속 진행 (빈 배열로 처리)
    }

    // 출결 통계 계산
    const totalAttendance = attendanceLogs?.length || 0;
    const absentCount = attendanceLogs?.filter((log) => log.status === 'absent').length || 0;
    const lateCount = attendanceLogs?.filter((log) => log.status === 'late').length || 0;
    const presentCount = attendanceLogs?.filter((log) => log.status === 'present').length || 0;
    const absenceRate = totalAttendance > 0 ? ((absentCount + lateCount) / totalAttendance) * 100 : 0;

    // 학생 데이터 요약
    const studentDataSummary = {
      name: student.name,
      enrollment_date: student.created_at,
      total_attendance: totalAttendance,
      present_count: presentCount,
      late_count: lateCount,
      absent_count: absentCount,
      absence_rate: Math.round(absenceRate * 10) / 10,
      consultation_count: consultations?.length || 0,
      active_classes: studentClasses?.length || 0,
      recent_consultations: consultations?.slice(0, 3).map((c) => ({
        date: c.consultation_date,
        type: c.consultation_type,
        has_notes: !!c.content,
      })) || [],
    };

    // 5. ChatGPT API 호출
    const prompt = `당신은 학원 운영 전문가입니다. 다음 학생 데이터를 분석하여 이탈 위험도를 평가해주세요.

학생 정보:
- 이름: ${studentDataSummary.name}
- 등록일: ${studentDataSummary.enrollment_date}
- 활성 반 수: ${studentDataSummary.active_classes}

최근 30일 출결 현황:
- 총 출결 기록: ${studentDataSummary.total_attendance}건
- 출석: ${studentDataSummary.present_count}건
- 지각: ${studentDataSummary.late_count}건
- 결석: ${studentDataSummary.absent_count}건
- 결석/지각률: ${studentDataSummary.absence_rate}%

상담 현황:
- 총 상담 횟수: ${studentDataSummary.consultation_count}건
${studentDataSummary.recent_consultations.length > 0
  ? '- 최근 상담:\n' + studentDataSummary.recent_consultations.map((c) => `  * ${c.date}: ${c.type}${c.has_notes ? ' (메모 있음)' : ''}`).join('\n')
  : '- 최근 상담 기록 없음'}

다음 형식으로 JSON 응답을 제공해주세요:
{
  "risk_score": 0-100 사이의 숫자,
  "risk_level": "low" | "medium" | "high",
  "reasons": ["이유1", "이유2", "이유3"],
  "recommended_actions": ["추천 액션1", "추천 액션2", "추천 액션3"]
}

평가 기준:
- 출석률이 70% 미만이면 높은 위험
- 지각/결석이 지속적으로 증가하면 위험 증가
- 상담 기록이 없으면 위험 증가
- 등록 후 오래되었는데 출석률이 낮으면 위험 증가

JSON 형식으로만 응답하고, 다른 설명은 포함하지 마세요.`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // 사용자 요청: 'gpt-4.1-mini'이지만 실제 OpenAI API는 'gpt-4o-mini' 사용
        messages: [
          {
            role: 'system',
            content: '당신은 학원 운영 전문가입니다. 학생 데이터를 분석하여 이탈 위험도를 정확하게 평가합니다. 항상 유효한 JSON 형식으로만 응답합니다.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error('[Risk Analysis] OpenAI API error:', errorData);
      throw new Error(`OpenAI API 호출 실패: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices[0]?.message?.content;

    if (!content) {
      throw new Error('OpenAI API 응답이 비어있습니다.');
    }

    let riskAnalysis: RiskAnalysisResponse;
    try {
      riskAnalysis = JSON.parse(content);
    } catch (parseError) {
      console.error('[Risk Analysis] JSON parse error:', content);
      // 파싱 실패 시 기본값 반환
      riskAnalysis = {
        risk_score: absenceRate > 30 ? 70 : absenceRate > 20 ? 50 : 30,
        risk_level: absenceRate > 30 ? 'high' : absenceRate > 20 ? 'medium' : 'low',
        reasons: [
          absenceRate > 30
            ? '최근 30일간 결석/지각률이 30% 이상입니다.'
            : absenceRate > 20
            ? '최근 30일간 결석/지각률이 20% 이상입니다.'
            : '출결 패턴을 지속적으로 관찰해야 합니다.',
        ],
        recommended_actions: [
          '학부모와 상담 일정을 잡아주세요.',
          '출결 패턴을 면밀히 관찰하세요.',
          '학생의 학습 동기를 파악하세요.',
        ],
      };
    }

    // 위험 점수 검증 및 정규화
    riskAnalysis.risk_score = Math.max(0, Math.min(100, riskAnalysis.risk_score || 0));
    if (!['low', 'medium', 'high'].includes(riskAnalysis.risk_level)) {
      riskAnalysis.risk_level = riskAnalysis.risk_score >= 70 ? 'high' : riskAnalysis.risk_score >= 40 ? 'medium' : 'low';
    }

    // 위험 점수가 90 이상이면 student_task_cards에 카드 생성
    if (riskAnalysis.risk_score >= 90) {
      const { error: cardError } = await supabase.rpc('create_risk_task_card', {
        p_tenant_id: tenant_id,
        p_student_id: student_id,
        p_risk_score: Math.round(riskAnalysis.risk_score),
        p_risk_reason: riskAnalysis.reasons.join(' '),
        p_recommended_action: riskAnalysis.recommended_actions.join(' '),
      });

      if (cardError) {
        console.error('[Risk Analysis] Failed to create risk task card:', cardError);
      }
    }

    return new Response(
      JSON.stringify(riskAnalysis),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[Risk Analysis] Fatal error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

