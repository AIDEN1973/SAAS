import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface RecommendFilterRequest {
  tenantId: string;
  naturalLanguageQuery: string;
}

interface FilterTagRecommendation {
  tag_ids: string[];
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
  suggested_query: string;
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
    const { tenantId, naturalLanguageQuery }: RecommendFilterRequest = await req.json();

    if (!tenantId || !naturalLanguageQuery) {
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

    // Supabase Client 생성 (RLS 자동 적용)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // 현재 tenant의 모든 message_filter_tags 조회 (RLS 자동 검증)
    // 성능 최적화: display_label, category만 조회 (condition_params 제외)
    const { data: filterTags, error: filterError } = await supabase
      .from('message_filter_tags')
      .select('id, display_label, category')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('usage_count', { ascending: false }) // 인기 태그 우선 정렬
      .limit(30); // 상위 30개만 조회 (성능 최적화 - 50→30)

    if (filterError) {
      console.error('Filter tags query error:', filterError);
      return new Response(
        JSON.stringify({ error: '필터 태그 조회에 실패했습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!filterTags || filterTags.length === 0) {
      return new Response(
        JSON.stringify({
          tag_ids: [],
          reasoning: '사용 가능한 필터 태그가 없습니다. 먼저 태그를 생성해주세요.',
          confidence: 'low',
          suggested_query: '',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GPT-4o-mini API 호출 (성능 최적화: 간소화된 프롬프트)
    const systemPrompt = `필터 태그 추천 AI. 최대 3개 추천. JSON만.`;

    // 성능 최적화: 간소화된 태그 설명 (카테고리별 그룹화)
    const filterTagsDescription = filterTags
      .map((tag) => `${tag.id}:${tag.display_label}(${tag.category})`)
      .join(',');

    const userPrompt = `태그:[${filterTagsDescription}]
질의:"${naturalLanguageQuery}"
JSON응답:{tag_ids:[],reasoning:"",confidence:"",suggested_query:""}`;

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
        temperature: 0.1, // 0.2 → 0.1 (더 결정적, 더 빠름)
        max_tokens: 200, // 300 → 200 (응답 시간 단축)
        response_format: { type: 'json_object' },
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API Error:', errorText);
      return new Response(
        JSON.stringify({ error: 'AI 필터 추천에 실패했습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiData = await openaiResponse.json();
    const recommendationContent = openaiData.choices[0]?.message?.content;

    if (!recommendationContent) {
      return new Response(
        JSON.stringify({ error: 'AI 응답이 비어있습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const recommendation: FilterTagRecommendation = JSON.parse(recommendationContent);

    // 추천된 tag_ids가 실제로 존재하는지 검증 + 상위 3개로 제한
    const validTagIds = recommendation.tag_ids
      .filter((tagId) => filterTags.some((tag) => tag.id === tagId))
      .slice(0, 3); // 최대 3개만 반환 (성능 최적화)

    const finalRecommendation: FilterTagRecommendation = {
      ...recommendation,
      tag_ids: validTagIds,
    };

    // 응답 반환
    return new Response(JSON.stringify(finalRecommendation), {
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
