/**
 * 상담일지 AI 요약 생성 Edge Function
 *
 * 아키텍처 문서 3.1.5, 3.7.1 섹션 참조
 * ChatGPT API를 사용하여 상담일지 내용을 요약
 *
 * [불변 규칙] Zero-Trust: tenant_id는 JWT에서 추출 (요청 본문에서 받지 않음)
 * [불변 규칙] PII 마스킹: 상담일지 요약 시 개인정보 마스킹 필수 (아키텍처 문서 3.1.5, 898-950줄)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConsultationAISummaryRequest {
  consultation_id: string;
}

interface ConsultationAISummaryResponse {
  ai_summary: string;
}

/**
 * JWT에서 tenant_id 추출
 * [불변 규칙] Zero-Trust: 클라이언트에서 전달한 tenant_id는 신뢰하지 않고 JWT에서 추출
 */
function extractTenantIdFromJWT(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7); // "Bearer " 제거
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('[Consultation AI Summary] Invalid JWT format: expected 3 parts');
      return null;
    }

    // JWT payload 디코딩 (base64url)
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }

    const payload = JSON.parse(atob(base64));
    const tenantId = payload.tenant_id;
    if (!tenantId || typeof tenantId !== 'string') {
      console.error('[Consultation AI Summary] tenant_id not found in JWT claims');
      return null;
    }

    return tenantId;
  } catch (error) {
    console.error('[Consultation AI Summary] JWT parsing error:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * PII 마스킹 함수
 * 아키텍처 문서 3.1.5, 898-950줄: 상담일지 요약 시 개인정보 마스킹 규칙
 *
 * 마스킹 규칙:
 * - 학생 실명: /[가-힣]{2,4}/g → [학생] (preserve_length: false)
 * - 전화번호: /(\d{3})-(\d{4})-(\d{4})/g → 010-****-**** (preserve_length: true)
 * - 학원명: /([가-힣]+학원|([가-힣]+(학원|아카데미|교육원)))/g → [학원명] (conditional_masking: true)
 * - 주소: /[가-힣]+시[가-힣]+구[가-힣]+동/g → [주소] (preserve_length: false)
 */
function maskPIIInContent(content: string): string {
  let masked = content;

  // 1. 전화번호 마스킹: 010-1234-5678 → 010-****-****
  // 문서 규칙: pattern: /(\d{3})-(\d{4})-(\d{4})/g, replacement: '010-****-****', preserve_length: true
  masked = masked.replace(/(\d{3})-(\d{4})-(\d{4})/g, '010-****-****');

  // 2. 학생 실명 마스킹: 2-4자 한글 이름 → [학생]
  // 문서 규칙: pattern: /[가-힣]{2,4}/g, replacement: '[학생]', preserve_length: false
  // 주의: 너무 광범위하게 매칭하지 않도록 일반 단어 제외
  const commonWords = new Set([
    '오늘', '내일', '어제', '시간', '수업', '과제', '시험', '성적', '학습', '공부',
    '학생', '선생', '교사', '원장', '부모', '학부', '학원', '학교', '반', '수업',
    '과목', '국어', '영어', '수학', '과학', '사회', '역사', '체육', '음악', '미술',
    '월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일',
    '오전', '오후', '저녁', '밤', '낮', '아침', '점심',
  ]);

  // 2-4자 한글 이름 패턴 (일반 단어 제외)
  masked = masked.replace(/[가-힣]{2,4}/g, (match) => {
    if (commonWords.has(match)) {
      return match;
    }
    return '[학생]';
  });

  // 3. 학원명 마스킹: "XX학원", "XX아카데미", "XX교육원" → [학원명]
  // 문서 규칙: pattern: /([가-힣]+학원|([가-힣]+(학원|아카데미|교육원)))/g, replacement: '[학원명]'
  // 주의: 문서의 정확한 패턴 사용 (conditional_masking: true - 필요한 경우만)
  masked = masked.replace(/([가-힣]+(?:학원|아카데미|교육원))/g, '[학원명]');

  // 4. 주소 마스킹: "XX시 XX구 XX동" → [주소]
  // 문서 규칙: pattern: /[가-힣]+시[가-힣]+구[가-힣]+동/g, replacement: '[주소]'
  masked = masked.replace(/[가-힣]+시\s*[가-힣]+구\s*[가-힣]+동/g, '[주소]');

  // 5. 이메일 마스킹: user@example.com → u***@example.com
  // 문서에는 명시되지 않았지만, PII 보호를 위해 추가
  masked = masked.replace(/([a-zA-Z0-9._-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, (match, user, domain) => {
    const maskedUser = user.length > 1 ? user.charAt(0) + '***' : '***';
    return `${maskedUser}@${domain}`;
  });

  return masked;
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
      console.error('[Consultation AI Summary] Failed to extract tenant_id from JWT');
      return new Response(
        JSON.stringify({ error: '인증이 필요합니다. JWT에서 tenant_id를 추출할 수 없습니다.' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[Consultation AI Summary] tenant_id extracted:', tenant_id);

    // 요청 본문 파싱
    let requestBody: ConsultationAISummaryRequest;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('[Consultation AI Summary] Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: '요청 본문을 파싱할 수 없습니다.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { consultation_id } = requestBody;

    if (!consultation_id) {
      console.error('[Consultation AI Summary] consultation_id is missing in request body');
      return new Response(
        JSON.stringify({ error: 'consultation_id가 필요합니다.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[Consultation AI Summary] Processing request for consultation_id:', consultation_id);

    // Supabase 클라이언트 생성
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. 상담기록 조회
    const { data: consultation, error: consultationError } = await supabase
      .from('student_consultations')
      .select('id, content, consultation_date, consultation_type, student_id')
      .eq('tenant_id', tenant_id)
      .eq('id', consultation_id)
      .single();

    if (consultationError) {
      console.error('[Consultation AI Summary] Failed to fetch consultation:', consultationError);
      return new Response(
        JSON.stringify({ error: '상담기록을 조회하는 중 오류가 발생했습니다.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!consultation) {
      console.error('[Consultation AI Summary] Consultation not found:', consultation_id);
      return new Response(
        JSON.stringify({ error: '상담기록을 찾을 수 없습니다.' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!consultation.content || consultation.content.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: '상담 내용이 없어 요약을 생성할 수 없습니다.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. PII 마스킹 적용 (아키텍처 문서 3.1.5, 898-950줄)
    const maskedContent = maskPIIInContent(consultation.content);

    console.log('[Consultation AI Summary] PII masking applied:', {
      consultation_id: consultation.id,
      original_length: consultation.content.length,
      masked_length: maskedContent.length,
      has_content: !!consultation.content,
    });

    // 3. ChatGPT API 호출
    const prompt = `다음은 학원 상담일지 내용입니다. 이 내용을 간결하고 명확하게 요약해주세요.

상담일지 내용:
${maskedContent}

요약 요구사항:
- 핵심 내용을 3-5문장으로 요약
- 학생의 상태, 상담 내용, 필요한 조치사항을 포함
- 개인정보는 마스킹되어 있으므로 그대로 유지
- 자연스러운 한국어로 작성

요약:`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: '당신은 학원 상담일지 전문 요약가입니다. 상담 내용을 간결하고 명확하게 요약합니다.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('[Consultation AI Summary] OpenAI API error:', {
        status: openaiResponse.status,
        statusText: openaiResponse.statusText,
        error: errorText.substring(0, 500), // PII 보호를 위해 일부만 로깅
      });
      throw new Error(`OpenAI API 호출 실패: ${openaiResponse.status}`);
    }

    let openaiData;
    try {
      openaiData = await openaiResponse.json();
    } catch (parseError) {
      console.error('[Consultation AI Summary] Failed to parse OpenAI response:', parseError);
      throw new Error('OpenAI 응답을 파싱할 수 없습니다.');
    }

    const aiSummary = openaiData.choices?.[0]?.message?.content?.trim();

    if (!aiSummary) {
      console.error('[Consultation AI Summary] AI summary is empty:', {
        consultation_id: consultation.id,
        response_structure: Object.keys(openaiData),
      });
      throw new Error('AI 요약 생성에 실패했습니다.');
    }

    console.log('[Consultation AI Summary] AI summary generated:', {
      consultation_id: consultation.id,
      summary_length: aiSummary.length,
    });

    // 4. 상담기록에 AI 요약 저장
    const { error: updateError } = await supabase
      .from('student_consultations')
      .update({ ai_summary: aiSummary })
      .eq('tenant_id', tenant_id)
      .eq('id', consultation_id);

    if (updateError) {
      console.error('[Consultation AI Summary] Failed to update consultation:', updateError);
      throw new Error('AI 요약 저장에 실패했습니다.');
    }

    console.log('[Consultation AI Summary] Success:', {
      consultation_id: consultation.id,
      summary_length: aiSummary.length,
    });

    // 5. 응답 반환
    const response: ConsultationAISummaryResponse = {
      ai_summary: aiSummary,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[Consultation AI Summary] Fatal error:', errorMessage);
    if (errorStack) {
      console.error('[Consultation AI Summary] Error stack:', errorStack);
    }
    return new Response(
      JSON.stringify({
        error: 'AI 요약 생성 중 오류가 발생했습니다.',
        message: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

