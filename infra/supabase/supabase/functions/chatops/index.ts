// 🚀 AGENT-MODE: Agent 전용 ChatOps Edge Function
// LAYER: EDGE_FUNCTION
/**
 * ChatOps Edge Function (Agent Mode Only)
 *
 * 챗봇.md 참조
 * 목적: 자연어 입력을 받아 Agent가 Tool을 사용하여 작업 수행
 *
 * [불변 규칙] Zero-Trust: tenant_id는 JWT에서 추출 (요청 본문에서 받지 않음)
 * [불변 규칙] GPT 모델: gpt-4o-mini, temperature: 0.3
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { envServer } from '../_shared/env-registry.ts';
import { maskPII } from '../_shared/pii-utils.ts';
import { getTenantIdFromVerifiedUser, requireTenantScope } from './handlers/auth.ts';
import { getCorsHeaders } from './handlers/cors.ts';
import { maskErr, tenantLogKey } from './handlers/utils.ts';
// 🚀 AGENT-MODE: Agent 엔진 import
import { runAgent, type AgentMessage } from '../_shared/agent-engine-final.ts';

interface ChatOpsRequest {
  session_id: string;
  message: string;
}

interface ChatOpsResponse {
  response: string;
  agent_mode: true;
  tool_results?: Array<{
    tool_name: string;
    result: unknown;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    console.log('[ChatOps] ===== 작업 시작 =====');

    // 환경 변수 검증
    const supabaseUrl = envServer.SUPABASE_URL;
    const supabaseServiceRoleKey = envServer.SERVICE_ROLE_KEY;
    const openaiApiKey = envServer.OPENAI_API_KEY;

    console.log('[ChatOps] 환경변수 로드:', {
      has_supabase_url: !!supabaseUrl,
      has_service_role_key: !!supabaseServiceRoleKey,
      has_openai_key: !!openaiApiKey,
      supabase_url_preview: supabaseUrl?.substring(0, 30),
    });

    // ✅ 필수 환경 변수 검증
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'SERVER_CONFIG_ERROR', message: 'OpenAI API 키가 설정되지 않았습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Supabase 클라이언트 생성
    console.log('[ChatOps] createClient 호출 전:', { typeof_createClient: typeof createClient });
    const supabaseSvc = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log('[ChatOps] Supabase 클라이언트 생성:', {
      is_defined: !!supabaseSvc,
      has_auth: !!supabaseSvc?.auth,
      has_getUser: !!supabaseSvc?.auth?.getUser,
    });

    // JWT 검증 및 tenant_id 추출
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'UNAUTHORIZED', message: '인증이 필요합니다.' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // JWT 검증 및 tenant_id, user_id 추출
    const { tenant_id, user_id } = await getTenantIdFromVerifiedUser(supabaseSvc, authHeader);

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: 'FORBIDDEN', message: 'Tenant 정보가 없습니다.' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // ✅ P0-SEC: user_id 검증 추가 (UUID 타입 컬럼 삽입 오류 방지)
    if (!user_id) {
      return new Response(
        JSON.stringify({
          error: 'UNAUTHORIZED',
          message: '사용자 인증 정보를 확인할 수 없습니다. 다시 로그인해주세요.'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ P0-SEC: user_id UUID 형식 검증
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(user_id)) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_USER_ID',
          message: '잘못된 사용자 ID 형식입니다. 다시 로그인해주세요.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantKey = await tenantLogKey(tenant_id);

    // 성능 최적화: industry_type 조회 (한 번만)
    const { data: tenantData } = await supabaseSvc
      .from('tenants')
      .select('industry_type')
      .eq('id', tenant_id)
      .single();
    
    const industryType = tenantData?.industry_type || 'academy';

    // 요청 파싱
    const body: ChatOpsRequest = await req.json();
    const { session_id, message } = body;

    if (!session_id || !message) {
      return new Response(
        JSON.stringify({ error: 'INVALID_REQUEST', message: 'session_id와 message는 필수입니다.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[ChatOps] 사용자 메시지 수신:', {
      session_id: session_id.substring(0, 8) + '...',
      message_preview: maskPII(message.substring(0, 100)),
      message_length: message.length,
      tenant: tenantKey,
    });

    // 성능 최적화: 세션 upsert (조회 없이 생성/업데이트)
    await supabaseSvc
      .from('chatops_sessions')
      .upsert({
        id: session_id,
        tenant_id: requireTenantScope(tenant_id),
        user_id: user_id,
        summary: null,
      }, {
        onConflict: 'id',
        ignoreDuplicates: true,  // 기존 세션은 업데이트하지 않음
      });
    
    console.log('[ChatOps] 세션 준비 완료:', { session_id: session_id.substring(0, 8) + '...' });

    // 대화 히스토리 조회 (최근 6개로 제한 - 응답 시간 최적화)
    const { data: recentMessages } = await supabaseSvc
        .from('chatops_messages')
        .select('role, content')
        .eq('session_id', session_id)
        .eq('tenant_id', requireTenantScope(tenant_id))
        .order('created_at', { ascending: false })
      .limit(6);

    console.log('[ChatOps] 최근 메시지 조회 성공:', { count: recentMessages?.length || 0 });

    const conversationHistory: AgentMessage[] = (recentMessages || [])
      .reverse()
      .map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

    // 🚀 AGENT-MODE: Agent 실행
    console.log('[ChatOps] Agent 모드로 처리 시작');

    const agentResult = await runAgent(
      message,
      conversationHistory,
      {
        tenant_id: requireTenantScope(tenant_id),
        user_id: user_id,
        session_id: session_id,
        supabase: supabaseSvc,
        openai_api_key: openaiApiKey,
        industry_type: industryType,  // 성능 최적화: industry_type 전달
      },
      3 // maxIterations (5→3 감소: 응답 시간 최적화)
    );

    console.log('[ChatOps] Agent 처리 완료:', {
      response_length: agentResult.response.length,
      tool_count: agentResult.tool_results?.length || 0,
      usage: agentResult.usage,
    });

    // 메시지 저장
    await supabaseSvc.from('chatops_messages').insert([
      {
          session_id: session_id,
          tenant_id: requireTenantScope(tenant_id),
          user_id: user_id,
          role: 'user',
          content: message,
      },
      {
          session_id: session_id,
          tenant_id: requireTenantScope(tenant_id),
          user_id: user_id,
          role: 'assistant',
        content: agentResult.response,
      },
    ]);

    console.log('[ChatOps] ===== 최종 응답 반환 =====');
    console.log('[ChatOps] 최종 응답:', {
      response_length: agentResult.response.length,
      agent_mode: true,
      tool_count: agentResult.tool_results?.length || 0,
    });

    return new Response(
      JSON.stringify({
        response: agentResult.response,
        agent_mode: true,
        tool_results: agentResult.tool_results,
        usage: agentResult.usage,
      } as ChatOpsResponse),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[ChatOps] 오류 발생:', maskErr(error));
    const origin = req.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin);
    return new Response(
      JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: '요청을 처리하는 중 오류가 발생했습니다. 다시 시도해주세요.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
