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
 */
function maskPIIInContent(content: string): string {
  let masked = content;

  // 1. 전화번호 마스킹: 010-1234-5678 → 010-****-****
  masked = masked.replace(/(\d{3})-(\d{4})-(\d{4})/g, '010-****-****');

  // 2. 학생 실명 마스킹: 2-4자 한글 이름 → [학생]
  // 주의: 너무 광범위하게 매칭하지 않도록 주변 컨텍스트 확인
  masked = masked.replace(/(?:학생|아이|아동)\s*([가-힣]{2,4})(?:\s|\.|,|이|가|을|를|에게|의)/g, (match, name) => {
    // "학생 홍길동이" → "학생 [학생]이"
    return match.replace(name, '[학생]');
  });
  // 단독으로 나오는 2-4자 한글 이름도 마스킹 (단, 일반 단어는 제외)
  const commonWords = ['오늘', '내일', '어제', '시간', '수업', '과제', '시험', '성적', '학습', '공부'];
  masked = masked.replace(/\b([가-힣]{2,4})\b/g, (match, name) => {
    if (commonWords.includes(name)) return match;
    // 문맥상 이름일 가능성이 높은 경우만 마스킹
    if (match.match(/^[가-힣]{2,4}$/) && !match.match(/[은는이가을를]/)) {
      return '[학생]';
    }
    return match;
  });

  // 3. 학원명 마스킹: "XX학원", "XX아카데미", "XX교육원" → [학원명]
  masked = masked.replace(/([가-힣]+(?:학원|아카데미|교육원))/g, '[학원명]');

  // 4. 주소 마스킹: "XX시 XX구 XX동" → [주소]
  masked = masked.replace(/[가-힣]+시\s*[가-힣]+구\s*[가-힣]+동/g, '[주소]');

  // 5. 이메일 마스킹: user@example.com → u***@example.com
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
      return new Response(
        JSON.stringify({ error: '인증 정보가 유효하지 않습니다.' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 요청 본문 파싱
    let requestBody: ConsultationAISummaryRequest;
    try {
      requestBody = await req.json();
    } catch (error) {
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
      return new Response(
        JSON.stringify({ error: 'consultation_id가 필요합니다.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Supabase 클라이언트 생성
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. 상담기록 조회
    const { data: consultation, error: consultationError } = await supabase
      .from('student_consultations')
      .select('id, content, consultation_date, consultation_type, student_id')
      .eq('tenant_id', tenant_id)
      .eq('id', consultation_id)
      .single();

    if (consultationError || !consultation) {
      console.error('[Consultation AI Summary] Failed to fetch consultation:', consultationError);
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
      console.error('[Consultation AI Summary] OpenAI API error:', errorText);
      throw new Error(`OpenAI API 호출 실패: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const aiSummary = openaiData.choices?.[0]?.message?.content?.trim();

    if (!aiSummary) {
      throw new Error('AI 요약 생성에 실패했습니다.');
    }

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
    console.error('[Consultation AI Summary] Fatal error:', error instanceof Error ? error.message : String(error));
    return new Response(
      JSON.stringify({
        error: 'AI 요약 생성 중 오류가 발생했습니다.',
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

