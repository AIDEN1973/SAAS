import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface GenerateMessageRequest {
  tenantId: string;
  filterTags: Array<{
    id: string;
    name: string;
    type: 'grade' | 'course' | 'status' | 'custom';
  }>;
  targetCount: number; // 대상 인원 수 (업종 중립)
  messageContext?: {
    purpose?: string; // "공지사항", "알림", "이벤트" 등
    tone?: 'formal' | 'friendly' | 'urgent';
  };
}

interface MessageSuggestion {
  title: string;
  content: string;
  reasoning: string;
}

serve(async (req) => {
  // CORS 헤더
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    // 요청 파싱
    const { tenantId, filterTags, targetCount, messageContext }: GenerateMessageRequest =
      await req.json();

    if (!tenantId || !filterTags || filterTags.length === 0) {
      return new Response(
        JSON.stringify({ error: '필수 파라미터가 누락되었습니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authorization 헤더에서 JWT 토큰 추출
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '인증 토큰이 필요합니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Supabase Client 생성 (RLS 검증용)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // RLS 검증: 해당 tenant에 접근 권한이 있는지 확인
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: '테넌트 접근 권한이 없습니다.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GPT-4o-mini API 호출
    const systemPrompt = `당신은 조직 관리자를 위한 메시지 생성 어시스턴트입니다.
회원/고객에게 보낼 맞춤형 메시지를 생성합니다.

**중요 규칙**:
1. 개인화 변수는 반드시 {{변수명}} 형식 사용 (예: {{회원이름}}, {{수업날짜}})
2. 절대 [회원 이름], [수업 날짜] 같은 대괄호 형식 사용 금지
3. 사용 가능한 변수: {{회원이름}}, {{연락처}}, {{수업날짜}}, {{출석률}}, {{미납금액}}
4. 명확하고 간결하게 작성
5. 필터 태그 정보를 반영한 맞춤형 내용
6. 존댓말 사용
7. 제목: 20자 이내, 내용: 500자 이내`;

    const userPrompt = `
**필터 태그**: ${filterTags.map((t) => `${t.name} (${t.type})`).join(', ')}
**대상 인원 수**: ${targetCount}명
**메시지 목적**: ${messageContext?.purpose || '일반 공지사항'}
**톤**: ${messageContext?.tone === 'formal' ? '공식적' : messageContext?.tone === 'urgent' ? '긴급' : '친근함'}

위 조건에 맞는 메시지를 생성해주세요.
**중요**: 개인화가 필요한 부분은 반드시 {{회원이름}}, {{수업날짜}} 등의 형식으로 작성하세요.

응답은 반드시 다음 JSON 형식으로만 제공하세요:
{
  "title": "메시지 제목 (20자 이내)",
  "content": "메시지 본문 (500자 이내, {{변수명}} 형식 사용)",
  "reasoning": "이 메시지를 추천한 이유 (간략히)"
}`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API Error:', errorText);
      return new Response(
        JSON.stringify({ error: 'AI 메시지 생성에 실패했습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiData = await openaiResponse.json();
    const messageContent = openaiData.choices[0]?.message?.content;

    if (!messageContent) {
      return new Response(
        JSON.stringify({ error: 'AI 응답이 비어있습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const suggestion: MessageSuggestion = JSON.parse(messageContent);

    // 응답 반환
    return new Response(JSON.stringify(suggestion), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || '서버 오류가 발생했습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
