/**
 * StudentTaskCard 승인/실행 Edge Function
 *
 * 프론트 자동화 문서 2.4 섹션 참조
 * Zero-Trust 원칙: Role 검증 후 실행
 *
 * 엔드포인트:
 * - POST /functions/v1/execute-student-task?action=request-approval&task_id={id} (Teacher)
 * - POST /functions/v1/execute-student-task?action=approve-and-execute&task_id={id} (Admin, SSOT)
 * - POST /functions/v1/execute-student-task?action=approve&task_id={id} (Admin, 레거시 alias, 일몰 예정)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getTenantSettingByPath } from '../_shared/policy-utils.ts';
import { withTenant } from '../_shared/withTenant.ts';
import { envServer } from '../_shared/env-registry.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExecuteRequest {
  action?: 'request-approval' | 'approve-and-execute' | 'approve';
  task_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // [불변 규칙] Edge Functions도 env-registry를 통해 환경변수 접근
    const supabase = createClient(envServer.SUPABASE_URL, envServer.SERVICE_ROLE_KEY);

    // JWT 토큰에서 사용자 정보 추출
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 요청 파라미터 파싱 (쿼리 파라미터 또는 body 모두 지원)
    const url = new URL(req.url);
    let action = url.searchParams.get('action') as ExecuteRequest['action'] | null;
    let taskId = url.searchParams.get('task_id');

    // body에서도 파라미터를 읽을 수 있도록 지원 (Supabase functions.invoke는 body만 지원)
    if (!action || !taskId) {
      try {
        const body = await req.json() as ExecuteRequest;
        if (body.action) action = body.action;
        if (body.task_id) taskId = body.task_id;
      } catch {
        // body 파싱 실패 시 무시 (쿼리 파라미터만 사용)
      }
    }

    if (!action || !taskId) {
      return new Response(
        JSON.stringify({ error: 'action and task_id parameters required (query params or body)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // TaskCard 조회 (정본)
    const { data: taskCard, error: taskError } = await supabase
      .from('task_cards')
      .select('*, tenant_id')
      .eq('id', taskId)
      .single();

    if (taskError || !taskCard) {
      return new Response(
        JSON.stringify({ error: 'Task card not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ⚠️ 중요: Role 확인 (JWT claim에서 추출, SSOT 준수)
    // [불변 규칙] Zero-Trust: user_tenant_roles 테이블 조회 금지, JWT claim에서 role 추출
    // PgBouncer Transaction Pooling 호환성을 위해 JWT claim 기반으로 단일화
    let userRole: string | null = null;
    try {
      const token = authHeader.replace('Bearer ', '');
      const parts = token.split('.');
      if (parts.length === 3) {
        // JWT payload 디코딩 (base64url)
        let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) {
          base64 += '=';
        }
        const payload = JSON.parse(atob(base64));
        userRole = payload.role || null;
      }
    } catch (error) {
      console.error('[execute-student-task] JWT parsing error:', error);
    }

    if (!userRole) {
      return new Response(
        JSON.stringify({ error: 'User role not found in JWT claims' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Teacher의 request-approval: 요청만 기록, 실행 안 함
    if (action === 'request-approval') {
      if (userRole !== 'teacher') {
        return new Response(
          JSON.stringify({ error: 'Only teachers can request approval' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 승인 요청 기록 (automation_actions 테이블에 기록)
      const { error: logError } = await supabase
        .from('automation_actions')
        .insert({
          task_id: taskId,
          action_type: 'request_approval',
          executed_by: user.id,
          tenant_id: taskCard.tenant_id,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          executor_role: userRole,  // instructor는 정본 키, teacher는 backward compatibility
          execution_context: {
            requested_at: new Date().toISOString(),
          },
        });

      if (logError) {
        console.error('[execute-student-task] Failed to log approval request:', logError);
      }

      return new Response(
        JSON.stringify({ status: 'requested', message: '승인 요청이 기록되었습니다.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Admin의 approve-and-execute: Role 검증 후 실행 (SSOT)
    // ⚠️ approve는 레거시 alias (일몰 예정), approve-and-execute가 SSOT
    if (action === 'approve-and-execute' || action === 'approve') {
      if (userRole !== 'admin' && userRole !== 'owner') {
        return new Response(
          JSON.stringify({ error: 'Only admins can approve and execute' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // TaskCard 상태 업데이트 (정본)
      const { error: updateError } = await supabase
        .from('task_cards')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (updateError) {
        console.error('[execute-student-task] Failed to update task card:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update task card' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ⚠️ 중요: 자동 실행 자기 억제 메커니즘 체크 (프론트 자동화 문서 2.5.2 섹션 참조)
      // 프론트 자동화 문서 2.5.2: 모든 서버 사이드(Edge Function/DB Trigger/Scheduler)는 자동 실행 전 반드시 이 체크를 수행해야 합니다
      if (taskCard.suggested_action) {
        const suggestedAction = taskCard.suggested_action as { type: string; payload?: Record<string, unknown> };
        const actionType = suggestedAction.type;

        // automation_safety_state 체크
        const now = new Date();
        const kstOffset = 9 * 60;
        const kstTime = new Date(now.getTime() + (kstOffset * 60 * 1000));
        const todayStart = new Date(kstTime);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(kstTime);
        todayEnd.setHours(23, 59, 59, 999);

        const { data: safetyState, error: safetyError } = await withTenant(
          supabase
          .from('automation_safety_state')
          .select('*')
          .eq('action_type', actionType)
          .gte('window_start', todayStart.toISOString())
            .lte('window_end', todayEnd.toISOString()),
          taskCard.tenant_id
        ).single();

        if (safetyError && safetyError.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('[execute-student-task] Failed to check automation safety:', safetyError);
        }

        // 안전성 체크
        if (safetyState) {
          if (safetyState.state === 'paused') {
            return new Response(
              JSON.stringify({
                error: 'Automation is paused for this action type',
                status: 'paused',
                message: '이 액션 타입의 자동화가 일시 중지되었습니다.',
              }),
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          if (safetyState.executed_count >= safetyState.max_allowed) {
            // 상태를 paused로 변경
            await supabase
              .from('automation_safety_state')
              .update({ state: 'paused' })
              .eq('id', safetyState.id);

            return new Response(
              JSON.stringify({
                error: 'Automation limit exceeded',
                status: 'limit_exceeded',
                message: '일일 자동화 실행 한도를 초과했습니다.',
              }),
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // 실행 카운트 증가
          await supabase
            .from('automation_safety_state')
            .update({
              executed_count: safetyState.executed_count + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', safetyState.id);
        } else {
          // 초기 상태 생성
          // ⚠️ 중요: max_allowed는 Policy에서 조회 (Fail Closed)
          // Automation Config First 원칙: 기본값 하드코딩 금지
          const maxAllowedPolicy = await getTenantSettingByPath(
            supabase,
            taskCard.tenant_id,
            `automation_safety.${actionType}.max_allowed`
          );
          if (!maxAllowedPolicy || typeof maxAllowedPolicy !== 'number') {
            // Policy가 없으면 실행하지 않음 (Fail Closed)
            console.error(`[execute-student-task] Max allowed policy not found for action ${actionType}, tenant ${taskCard.tenant_id}`);
            return new Response(
              JSON.stringify({ error: '자동화 안전 설정이 없습니다.' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          const maxAllowed = maxAllowedPolicy; // Policy에서 조회한 값만 사용

          await supabase.from('automation_safety_state').insert({
            tenant_id: taskCard.tenant_id,
            action_type: actionType,
            window_start: todayStart.toISOString(),
            window_end: todayEnd.toISOString(),
            max_allowed: maxAllowed,
            state: 'normal',
          });
        }
      }

      // 실제 액션 실행 (suggested_action에 따라)
      let executionResult: unknown = null;
      if (taskCard.suggested_action) {
        const suggestedAction = taskCard.suggested_action as { type: string; payload?: Record<string, unknown> };

        // 액션 타입에 따른 실행 로직
        switch (suggestedAction.type) {
          case 'send_message':
            // 메시지 발송 로직 (실제 구현 필요)
            executionResult = { message_sent: true };
            break;
          case 'contact_guardian':
            // 보호자 연락 로직 (실제 구현 필요, 업종 중립)
            executionResult = { guardian_contacted: true, reason: suggestedAction.payload?.reason };
            break;
          case 'create_consultation':
            // 상담 생성 로직 (실제 구현 필요)
            executionResult = { consultation_created: true };
            break;
          case 'run_analysis':
            // 분석 실행 로직 (실제 구현 필요)
            executionResult = { analysis_completed: true };
            break;
          default:
            executionResult = { action_type: suggestedAction.type, executed: true };
        }
      }

      // 실행 로그 기록
      const { error: logError } = await supabase
        .from('automation_actions')
        .insert({
          task_id: taskId,
          action_type: 'approve_and_execute',
          executed_by: user.id,
          tenant_id: taskCard.tenant_id,
          result: executionResult,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          executor_role: userRole,  // instructor는 정본 키, teacher는 backward compatibility
          execution_context: {
            suggested_action: taskCard.suggested_action,
            executed_at: new Date().toISOString(),
          },
        });

      if (logError) {
        console.error('[execute-student-task] Failed to log execution:', logError);
      }

      // TaskCard 상태를 executed로 업데이트 (정본)
      await supabase
        .from('task_cards')
        .update({
          status: 'executed',
          executed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      return new Response(
        JSON.stringify({ status: 'executed', result: executionResult }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[execute-student-task] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
