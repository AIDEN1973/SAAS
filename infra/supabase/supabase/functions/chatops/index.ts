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
import { runAgent, runAgentWithProgress, type AgentMessage } from '../_shared/agent-engine-final.ts';
import { runAgentStreaming } from '../_shared/agent-engine-streaming.ts';
// Execution Audit 유틸리티 import
import { createExecutionAuditRecord } from '../_shared/execution-audit-utils.ts';

interface ChatOpsRequest {
  session_id: string;
  message: string;
  stream?: boolean;  // 스트리밍 옵션
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
    const { session_id, message, stream = false } = body;

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

    // P0-FIX: 대화 히스토리 조회 (최근 10개로 증가 - Draft ID 유지 보장)
    // 이유: Draft 생성 + 중간 대화 + 동의 턴을 모두 포함하려면 최소 10개 필요
    const { data: recentMessages } = await supabaseSvc
        .from('chatops_messages')
        .select('role, content')
        .eq('session_id', session_id)
        .eq('tenant_id', requireTenantScope(tenant_id))
        .order('created_at', { ascending: false })
      .limit(10);

    console.log('[ChatOps] 최근 메시지 조회 성공:', { count: recentMessages?.length || 0 });

    const conversationHistory: AgentMessage[] = (recentMessages || [])
      .reverse()
      .map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

    // 🚀 AGENT-MODE: Agent 실행 (스트리밍 또는 일반)
    if (stream) {
      console.log('[ChatOps] Agent 스트리밍 모드 (진행 상황 포함)로 처리 시작');

      // 사용자 메시지 즉시 저장
      await supabaseSvc.from('chatops_messages').insert({
        session_id: session_id,
        tenant_id: requireTenantScope(tenant_id),
        user_id: user_id,
        role: 'user',
        content: message,
      });

      // ✅ runAgentWithProgress 사용: Tool 실행 + 진행 상황 SSE
      const originalStream = await runAgentWithProgress(
        message,
        conversationHistory,
        {
          tenant_id: requireTenantScope(tenant_id),
          user_id: user_id,
          session_id: session_id,
          supabase: supabaseSvc,
          openai_api_key: openaiApiKey,
          industry_type: industryType,
        },
        3
      );

      // P1-13: 스트리밍 응답을 가로채서 assistant 메시지를 DB에 저장
      let fullResponse = '';
      let toolResults: Array<{ tool: string; success: boolean; result: any }> = [];
      const wrappedStream = new ReadableStream({
        async start(controller) {
          const reader = originalStream.getReader();
          const decoder = new TextDecoder();

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              // 클라이언트로 전달
              controller.enqueue(value);

              // 전체 응답 수집
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (line.trim().startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.trim().slice(6));
                    console.log('[ChatOps:Wrapper] SSE 이벤트:', { type: data.type, hasResponse: !!data.response, hasContent: !!data.content });

                    if (data.type === 'content') {
                      fullResponse += data.content;
                      console.log('[ChatOps:Wrapper] content 누적:', { length: fullResponse.length });
                    } else if (data.type === 'done') {
                      // 스트리밍 완료 - assistant 메시지 저장
                      // ✅ FIX: agent-engine-final.ts는 'response' 필드 사용 (line 1944)
                      const prevLength = fullResponse.length;
                      fullResponse = data.response || fullResponse;
                      toolResults = data.tool_results || [];
                      console.log('[ChatOps:Wrapper] done 이벤트 처리:', {
                        prevLength,
                        newLength: fullResponse.length,
                        hasDataResponse: !!data.response,
                        toolResultsCount: toolResults.length
                      });
                    }
                  } catch {
                    // JSON 파싱 실패는 무시
                  }
                }
              }
            }

            // P0-FIX: 스트리밍 완료 - assistant 메시지 DB 저장 (스트림 종료 전)
            // 중요: controller.close() 전에 DB 저장을 완료해야 다음 요청이 메시지를 볼 수 있음
            if (fullResponse) {
              const insertResult = await supabaseSvc.from('chatops_messages').insert({
                session_id: session_id,
                tenant_id: requireTenantScope(tenant_id),
                user_id: user_id,
                role: 'assistant',
                content: fullResponse,
              });

              if (insertResult.error) {
                console.error('[ChatOps] Assistant 메시지 저장 실패:', insertResult.error);
              } else {
                console.log('[ChatOps] Assistant 메시지 저장 완료:', { length: fullResponse.length });
              }

              // ✅ ExecutionAudit 기록 생성 - 실제 Tool이 성공한 경우에만
              // confirm_action, register, discharge 등 L2 작업이 성공한 경우에만 액티비티에 표시
              const successfulTools = toolResults.filter(t =>
                t.success &&
                ['confirm_action', 'register', 'discharge', 'pause', 'resume', 'assign_tags'].includes(t.tool)
              );

              if (successfulTools.length > 0) {
                console.log('[ChatOps] 성공한 Tool 실행 발견:', {
                  tools: successfulTools.map(t => t.tool),
                  count: successfulTools.length
                });

                // Tool 실행 결과 기반으로 요약 생성 및 entity 정보 추출
                let entityType = 'chatops_session';
                let entityId = session_id;

                const toolSummaries = successfulTools.map(t => {
                  const toolName = t.tool;
                  const result = t.result;

                  // Tool별 사용자 친화적 요약 생성
                  if (toolName === 'register') {
                    // register의 경우 result에서 학생명, ID 추출
                    const studentName = result?.student_name || result?.name || '학생';
                    const studentId = result?.student_id || result?.id;
                    if (studentId) {
                      entityType = 'student';
                      entityId = studentId;
                    }
                    return `${studentName} 학생등록 완료`;
                  } else if (toolName === 'discharge') {
                    const studentName = result?.student_name || result?.name || '학생';
                    const studentId = result?.student_id || result?.id;
                    if (studentId) {
                      entityType = 'student';
                      entityId = studentId;
                    }
                    return `${studentName} 퇴원 처리 완료`;
                  } else if (toolName === 'pause') {
                    const studentName = result?.student_name || result?.name || '학생';
                    const studentId = result?.student_id || result?.id;
                    if (studentId) {
                      entityType = 'student';
                      entityId = studentId;
                    }
                    return `${studentName} 일시정지 처리 완료`;
                  } else if (toolName === 'resume') {
                    const studentName = result?.student_name || result?.name || '학생';
                    const studentId = result?.student_id || result?.id;
                    if (studentId) {
                      entityType = 'student';
                      entityId = studentId;
                    }
                    return `${studentName} 재개 처리 완료`;
                  } else if (toolName === 'assign_tags') {
                    const studentId = result?.student_id || result?.id;
                    if (studentId) {
                      entityType = 'student';
                      entityId = studentId;
                    }
                    return '태그 할당 완료';
                  } else if (toolName === 'confirm_action') {
                    // confirm_action은 일반적인 작업 완료
                    return result?.summary || '작업 처리 완료';
                  }
                  return `${toolName} 실행 완료`;
                }).join(', ');

                const messageHash = message.substring(0, 50).replace(/\s/g, '_');
                await createExecutionAuditRecord(supabaseSvc, {
                  tenant_id: requireTenantScope(tenant_id),
                  operation_type: 'chatops-message',
                  status: 'success',
                  source: 'ai',
                  actor_type: 'user',
                  actor_id: user_id,
                  summary: toolSummaries, // 대화 내용 대신 Tool 실행 결과 요약 사용
                  details: null,
                  reference: {
                    entity_type: entityType, // student, chatops_session 등
                    entity_id: entityId, // student_id 또는 session_id
                    source_event_id: `ai:chatops:${session_id}:${messageHash}`,
                  },
                });
              } else {
                console.log('[ChatOps] 성공한 L2 Tool 없음 - ExecutionAudit 생성 생략:', {
                  totalTools: toolResults.length,
                  toolList: toolResults.map(t => ({ tool: t.tool, success: t.success }))
                });
              }
            }

            // DB 저장 완료 후 스트림 종료
            controller.close();
          } catch (error) {
            console.error('[ChatOps] 스트리밍 처리 오류:', error);
            controller.error(error);
          }
        },
      });

      // SSE 헤더 설정
      return new Response(wrappedStream, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      console.log('[ChatOps] Agent 일반 모드로 처리 시작');

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

      // ✅ ExecutionAudit 기록 생성 - 실제 Tool이 성공한 경우에만
      // confirm_action, register, discharge 등 L2 작업이 성공한 경우에만 액티비티에 표시
      const toolResults = agentResult.tool_results || [];
      const successfulTools = toolResults.filter(t =>
        t.success &&
        ['confirm_action', 'register', 'discharge', 'pause', 'resume', 'assign_tags'].includes(t.tool)
      );

      if (successfulTools.length > 0) {
        console.log('[ChatOps] 성공한 Tool 실행 발견:', {
          tools: successfulTools.map(t => t.tool),
          count: successfulTools.length
        });

        // Tool 실행 결과 기반으로 요약 생성 및 entity 정보 추출
        let entityType = 'chatops_session';
        let entityId = session_id;

        const toolSummaries = successfulTools.map(t => {
          const toolName = t.tool;
          const result = t.result;

          // Tool별 사용자 친화적 요약 생성
          if (toolName === 'register') {
            const studentName = result?.student_name || result?.name || '학생';
            const studentId = result?.student_id || result?.id;
            if (studentId) {
              entityType = 'student';
              entityId = studentId;
            }
            return `${studentName} 학생등록 완료`;
          } else if (toolName === 'discharge') {
            const studentName = result?.student_name || result?.name || '학생';
            const studentId = result?.student_id || result?.id;
            if (studentId) {
              entityType = 'student';
              entityId = studentId;
            }
            return `${studentName} 퇴원 처리 완료`;
          } else if (toolName === 'pause') {
            const studentName = result?.student_name || result?.name || '학생';
            const studentId = result?.student_id || result?.id;
            if (studentId) {
              entityType = 'student';
              entityId = studentId;
            }
            return `${studentName} 일시정지 처리 완료`;
          } else if (toolName === 'resume') {
            const studentName = result?.student_name || result?.name || '학생';
            const studentId = result?.student_id || result?.id;
            if (studentId) {
              entityType = 'student';
              entityId = studentId;
            }
            return `${studentName} 재개 처리 완료`;
          } else if (toolName === 'assign_tags') {
            const studentId = result?.student_id || result?.id;
            if (studentId) {
              entityType = 'student';
              entityId = studentId;
            }
            return '태그 할당 완료';
          } else if (toolName === 'confirm_action') {
            return result?.summary || '작업 처리 완료';
          }
          return `${toolName} 실행 완료`;
        }).join(', ');

        await createExecutionAuditRecord(supabaseSvc, {
          tenant_id: requireTenantScope(tenant_id),
          operation_type: 'chatops-message',
          status: 'success',
          source: 'ai',
          actor_type: 'user',
          actor_id: user_id,
          summary: toolSummaries, // 대화 내용 대신 Tool 실행 결과 요약 사용
          details: null,
          reference: {
            entity_type: entityType, // student, chatops_session 등
            entity_id: entityId, // student_id 또는 session_id
            source_event_id: `ai:chatops:${session_id}:${Date.now()}`,
          },
        });
      } else {
        console.log('[ChatOps] 성공한 L2 Tool 없음 - ExecutionAudit 생성 생략:', {
          totalTools: toolResults.length,
          toolList: toolResults.map(t => ({ tool: t.tool, success: t.success }))
        });
      }

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
    }
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
