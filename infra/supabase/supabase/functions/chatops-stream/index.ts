// 🚀 AGENT-MODE: Agent 전용 ChatOps Edge Function (Streaming)
// LAYER: EDGE_FUNCTION
/**
 * ChatOps Streaming Edge Function
 *
 * SSE (Server-Sent Events) 기반 실시간 응답 전송
 * 체감 응답 시간 70-80% 단축
 *
 * [불변 규칙] Zero-Trust: tenant_id는 JWT에서 추출
 * [불변 규칙] GPT 모델: gpt-4o-mini, temperature: 0.3
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { envServer } from '../_shared/env-registry.ts';
import { maskPII } from '../_shared/pii-utils.ts';
import { getTenantIdFromVerifiedUser, requireTenantScope } from '../chatops/handlers/auth.ts';
import { getCorsHeaders } from '../chatops/handlers/cors.ts';
import { maskErr, tenantLogKey } from '../chatops/handlers/utils.ts';
import { runAgentStreaming, type AgentMessage } from '../_shared/agent-engine-streaming.ts';

interface ChatOpsStreamRequest {
  session_id: string;
  message: string;
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
    console.log('[ChatOpsStream] ===== Streaming 시작 =====');

    // 환경 변수 검증
    const supabaseUrl = envServer.SUPABASE_URL;
    const supabaseServiceRoleKey = envServer.SERVICE_ROLE_KEY;
    const openaiApiKey = envServer.OPENAI_API_KEY;

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'SERVER_CONFIG_ERROR', message: 'OpenAI API 키가 설정되지 않았습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Supabase 클라이언트 생성
    const supabaseSvc = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
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

    const { tenant_id, user_id } = await getTenantIdFromVerifiedUser(supabaseSvc, authHeader);

    if (!tenant_id || !user_id) {
      return new Response(
        JSON.stringify({ error: 'FORBIDDEN', message: 'Tenant 정보가 없습니다.' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const tenantKey = await tenantLogKey(tenant_id);

    // 요청 파싱
    const body: ChatOpsStreamRequest = await req.json();
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

    console.log('[ChatOpsStream] 사용자 메시지 수신:', {
      session_id: session_id.substring(0, 8) + '...',
      message_preview: maskPII(message.substring(0, 100)),
      tenant: tenantKey,
    });

    // 세션 조회 또는 생성
    const { data: existingSession } = await supabaseSvc
      .from('chatops_sessions')
      .select('id, summary')
      .eq('id', session_id)
      .eq('tenant_id', requireTenantScope(tenant_id))
      .maybeSingle();

    if (!existingSession) {
      await supabaseSvc.from('chatops_sessions').insert({
        id: session_id,
        tenant_id: requireTenantScope(tenant_id),
        user_id: user_id,
        summary: null,
      });
    }

    // 대화 히스토리 조회 (최근 6개)
    const { data: recentMessages } = await supabaseSvc
      .from('chatops_messages')
      .select('role, content')
      .eq('session_id', session_id)
      .eq('tenant_id', requireTenantScope(tenant_id))
      .order('created_at', { ascending: false })
      .limit(6);

    const conversationHistory: AgentMessage[] = (recentMessages || [])
      .reverse()
      .map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

    // 🚀 Agent Streaming 실행
    console.log('[ChatOpsStream] Agent Streaming 모드로 처리 시작');

    const stream = await runAgentStreaming(
      message,
      conversationHistory,
      {
        tenant_id: requireTenantScope(tenant_id),
        user_id: user_id,
        session_id: session_id,
        supabase: supabaseSvc,
        openai_api_key: openaiApiKey,
      }
    );

    // SSE 헤더 설정
    const sseHeaders = {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    };

    return new Response(stream, {
      status: 200,
      headers: sseHeaders,
    });
  } catch (error) {
    console.error('[ChatOpsStream] 오류 발생:', maskErr(error));
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

