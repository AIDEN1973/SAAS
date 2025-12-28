/**
 * TaskCard 승인/실행 Edge Function (ChatOps L2 레벨)
 *
 * 챗봇.md 6.3 참조
 * Zero-Trust 원칙: Role 검증 후 실행
 *
 * 엔드포인트:
 * - POST /functions/v1/execute-task-card?action=request-approval&task_id={id} (Teacher)
 * - POST /functions/v1/execute-task-card?action=approve-and-execute&task_id={id} (Admin, SSOT)
 *
 * [불변 규칙] 실행 입력은 TaskCard.suggested_action(Plan snapshot)에서만 읽음
 * [불변 규칙] Policy/RBAC는 실행 시점에 재평가 (Fail-Closed)
 * [불변 규칙] L2-B는 Domain Action Catalog 확정 전까지 항상 차단 (Fail-Closed)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getTenantSettingByPath } from '../_shared/policy-utils.ts';
import { withTenant } from '../_shared/withTenant.ts';
import { envServer } from '../_shared/env-registry.ts';
import { maskPII } from '../_shared/pii-utils.ts';
import { assertAutomationEventType } from '../_shared/automation-event-catalog.ts';
import { getHandler, hasHandler } from '../execute-student-task/handlers/registry.ts';
import type { HandlerContext } from '../execute-student-task/handlers/types.ts';
import { getIntent } from '../_shared/intent-registry.ts';
import { isDomainActionKey } from '../_shared/domain-action-catalog.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// P0: Execute API Contract (강제)
// 클라이언트 입력은 { action, task_id }만 허용
// plan/params를 API에서 받지 않거나, 받더라도 무시한다 (문서로 명확히 고정)
interface ExecuteRequest {
  action?: 'request-approval' | 'approve-and-execute';
  task_id?: string;
  // ⚠️ 중요: plan/params는 받지 않거나 무시 (Fail-Closed)
  // 클라이언트는 { action, task_id }만 전송
}

// Plan 스냅샷 타입 (챗봇.md 4.3 참조)
interface SuggestedActionChatOpsPlanV1 {
  schema_version?: 'chatops.plan.v1';
  intent_key: string;
  params: unknown;
  // ⚠️ 중요: 실행 시점 검증을 위한 메타데이터
  automation_level: 'L1' | 'L2';
  execution_class?: 'A' | 'B'; // L2일 때만 존재
  event_type?: string; // L2-A일 때만 존재 (Policy 재평가용)
  plan_snapshot: {
    summary: string;
    target_count: number;
    targets: {
      kind: 'student_id_list';
      student_ids: string[];
    };
    samples?: Array<{
      label: string;
      preview: string;
    }>;
    channel?: string;
    template_id?: string;
    risks?: string[];
  };
  security: {
    requested_by_user_id: string;
    requested_at_utc: string;
    candidate_resolution?: {
      kind: 'token';
      token_id: string;
    };
  };
}

/**
 * Plan 스냅샷 검증
 * 챗봇.md 4.3, 6.3.1 참조
 */
function validatePlan(plan: unknown): plan is SuggestedActionChatOpsPlanV1 {
  if (!plan || typeof plan !== 'object') {
    return false;
  }

  const p = plan as Partial<SuggestedActionChatOpsPlanV1>;

  // 최소 필수 필드 검증 (챗봇.md 4.3 참조)
  // ⚠️ P0-SCHEMA: Fail-Closed 검증 기준은 '본 문서 스키마'가 아니라 'SSOT 정본의 최소 필수 필드'로 둔다
  if (
    !p.intent_key ||
    typeof p.intent_key !== 'string' ||
    !p.params || // params는 필수 필드 (unknown 타입이지만 존재해야 함)
    !p.automation_level ||
    (p.automation_level !== 'L1' && p.automation_level !== 'L2') ||
    !p.plan_snapshot ||
    !p.plan_snapshot.summary ||
    typeof p.plan_snapshot.summary !== 'string' ||
    typeof p.plan_snapshot.target_count !== 'number' ||
    !p.plan_snapshot.targets ||
    p.plan_snapshot.targets.kind !== 'student_id_list' ||
    !Array.isArray(p.plan_snapshot.targets.student_ids) ||
    !p.security ||
    !p.security.requested_by_user_id ||
    typeof p.security.requested_by_user_id !== 'string' ||
    !p.security.requested_at_utc ||
    typeof p.security.requested_at_utc !== 'string'
  ) {
    return false;
  }

  // L2일 때 execution_class 필수 검증
  if (p.automation_level === 'L2') {
    if (!p.execution_class || (p.execution_class !== 'A' && p.execution_class !== 'B')) {
      return false;
    }
    // L2-A일 때 event_type 필수 (Policy 재평가용)
    if (p.execution_class === 'A' && !p.event_type) {
      return false;
    }
  }

  return true;
}

/**
 * JWT에서 role 추출
 */
function extractRoleFromJWT(authHeader: string): string | null {
  try {
    const token = authHeader.replace('Bearer ', '');
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // JWT payload 디코딩 (base64url)
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const payload = JSON.parse(atob(base64));
    return payload.role || null;
  } catch {
    return null;
  }
}

/**
 * JWT에서 tenant_id 추출
 * [불변 규칙] Zero-Trust: 클라이언트 입력값 신뢰하지 않음, JWT에서만 추출
 */
function extractTenantIdFromJWT(authHeader: string): string | null {
  try {
    const token = authHeader.replace('Bearer ', '');
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // JWT payload 디코딩 (base64url)
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const payload = JSON.parse(atob(base64));
    return payload.tenant_id || null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
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

    // body에서도 파라미터를 읽을 수 있도록 지원
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

    // ⚠️ P1: action_type 정규화 (체크리스트.md 6. 데이터 정규화 규칙)
    // 레거시 'approve'는 'approve-and-execute'로 정규화
    // 언더스코어 형태는 하이픈으로 정규화
    if (action === 'approve') {
      action = 'approve-and-execute';
    } else if (action === 'request_approval') {
      action = 'request-approval';
    } else if (action === 'approve_and_execute') {
      action = 'approve-and-execute';
    }

    // ⚠️ P0: action enum 검증 (SSOT 정본)
    if (action !== 'request-approval' && action !== 'approve-and-execute') {
      return new Response(
        JSON.stringify({ error: `Invalid action: ${action}. Allowed: request-approval, approve-and-execute` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ⚠️ 중요: JWT에서 tenant_id 추출 (Zero-Trust)
    // [불변 규칙] Zero-Trust: 클라이언트 입력값 신뢰하지 않음, JWT에서만 추출
    const jwtTenantId = extractTenantIdFromJWT(authHeader);
    if (!jwtTenantId) {
      return new Response(
        JSON.stringify({ error: 'tenant_id not found in JWT claims' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // TaskCard 조회 (withTenant 사용하여 tenant_id 필터 강제)
    const { data: taskCard, error: taskError } = await withTenant(
      supabase
        .from('task_cards')
        .select('*, tenant_id')
        .eq('id', taskId),
      jwtTenantId
    ).single();

    if (taskError || !taskCard) {
      return new Response(
        JSON.stringify({ error: 'Task card not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ⚠️ 중요: tenant_id 일치 검증 (방어 깊이)
    // JWT의 tenant_id와 TaskCard의 tenant_id가 일치해야 함
    if (taskCard.tenant_id !== jwtTenantId) {
      return new Response(
        JSON.stringify({ error: 'Tenant ID mismatch' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ⚠️ P0: Plan 스냅샷 검증 (Fail-Closed)
    // 실행 입력은 TaskCard.suggested_action(Plan snapshot)에서만 읽음
    if (!taskCard.suggested_action) {
      return new Response(
        JSON.stringify({ error: 'TaskCard suggested_action (Plan snapshot) is required for execution' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Plan 스냅샷 검증
    if (!validatePlan(taskCard.suggested_action)) {
      return new Response(
        JSON.stringify({ error: 'Invalid Plan snapshot schema' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const plan = taskCard.suggested_action as SuggestedActionChatOpsPlanV1;

    // ⚠️ 중요: Role 확인 (JWT claim에서 추출, SSOT 준수)
    // [불변 규칙] Zero-Trust: user_tenant_roles 테이블 조회 금지, JWT claim에서 role 추출
    const userRole = extractRoleFromJWT(authHeader);

    if (!userRole) {
      return new Response(
        JSON.stringify({ error: 'User role not found in JWT claims' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Teacher의 request-approval: 요청만 기록, 실행 안 함
    // 챗봇.md 6.3: 사용자(권한 낮음)는 request-approval 가능
    // ⚠️ 참고: L1/L2 모두 request-approval 가능 (실행이 아니라 요청이므로)
    if (action === 'request-approval') {
      if (userRole !== 'teacher') {
        return new Response(
          JSON.stringify({ error: 'Only teachers can request approval' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ⚠️ P0-IDEMP: request_id 생성 (서버에서 생성, 클라이언트 입력 금지)
      // request-approval은 완전 멱등 (버킷 없이)
      const requestId = `${taskId}:request-approval`;

      // ⚠️ P0-IDEMP: request_id 멱등 처리 (유니크 제약으로 강제)
      const { data: existingAction } = await withTenant(
        supabase
          .from('automation_actions')
          .select('id')
          .eq('request_id', requestId),
        taskCard.tenant_id
      ).single();

      if (existingAction) {
        // 이미 처리됨 - 즉시 성공 반환 (멱등)
        return new Response(
          JSON.stringify({ status: 'requested', message: '이미 처리된 요청입니다.', request_id: requestId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const requestedAt = new Date().toISOString();

      // ⚠️ P0-1: 승인 요청 기록 (automation_actions 테이블에 기록)
      const { data: actionData, error: logError } = await supabase
        .from('automation_actions')
        .insert({
          task_id: taskId,
          action_type: 'request-approval',
          executed_by: user.id,
          tenant_id: taskCard.tenant_id,
          request_id: requestId,
          requested_by_user_id: user.id,
          requested_at_utc: requestedAt,
          executor_role: userRole,
          execution_context: {
            requested_at: requestedAt,
            intent_key: plan.intent_key,
          },
        })
        .select('id')
        .single();

      if (logError) {
        // ⚠️ P0: PII 마스킹 필수 (체크리스트.md 4. PII 마스킹)
        const maskedLogError = maskPII(logError);
        console.error('[execute-task-card] Failed to log approval request:', maskedLogError);
        return new Response(
          JSON.stringify({ error: 'Failed to log approval request' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ⚠️ 중요: task_cards.status는 SSOT 허용값만 사용 (pending/approved/executed/expired)
      // request-approval 기록 후에도 status는 'pending' 유지
      // 챗봇.md 598: 승인 요청(request-approval)이 기록되더라도 status는 'pending' 유지
      const { error: updateError } = await withTenant(
        supabase
          .from('task_cards')
          .update({
            status: 'pending',
            last_action_at_utc: requestedAt,
            last_action_id: actionData.id,
            updated_at: requestedAt,
          })
          .eq('id', taskId),
        taskCard.tenant_id
      );

      if (updateError) {
        // ⚠️ P0: PII 마스킹 필수 (체크리스트.md 4. PII 마스킹)
        const maskedUpdateError = maskPII(updateError);
        console.error('[execute-task-card] Failed to update task card status:', maskedUpdateError);
      }

      return new Response(
        JSON.stringify({ status: 'requested', message: '승인 요청이 기록되었습니다.', request_id: requestId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Admin의 approve-and-execute: Role 검증 후 실행 (SSOT)
    if (action === 'approve-and-execute') {
      if (userRole !== 'admin' && userRole !== 'owner') {
        return new Response(
          JSON.stringify({ error: 'Only admins can approve and execute' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ⚠️ 중요: L1 레벨은 approve-and-execute 불가
      // 챗봇.md 6.2: L1은 TaskCard 생성(업무화)까지, 실행 없음
      if (plan.automation_level === 'L1') {
        return new Response(
          JSON.stringify({
            error: 'L1 intent does not support execution',
            message: '이 작업은 업무 카드 생성만 가능하며 실행은 지원하지 않습니다.',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ⚠️ P0-4: L2-B 실행 차단 규칙 (방어 깊이)
      // execution_class='B'인 intent는 Domain Action Catalog에 등록된 경우에만 실행 허용
      // 챗봇.md 6.3, 9 참조
      if (plan.automation_level === 'L2' && plan.execution_class === 'B') {
        // Domain Action Catalog 확인
        const intent = getIntent(plan.intent_key);
        const actionKey = intent?.action_key;

        if (!actionKey || !isDomainActionKey(actionKey)) {
          return new Response(
            JSON.stringify({
              error: 'L2-B intent execution is blocked: action_key not found in Domain Action Catalog',
              message: '이 작업은 데이터 변경 작업입니다. Domain Action Catalog에 등록되지 않아 실행할 수 없습니다.',
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // ⚠️ P0-5: request_id 생성 (서버에서 생성, 클라이언트 입력 금지)
      // approve-and-execute는 버킷 멱등 (5분 버킷)
      const attemptWindow = Math.floor(Date.now() / (5 * 60 * 1000)); // 5분 버킷
      const requestId = `${taskId}:approve-and-execute:${attemptWindow}`;

      // ⚠️ P0-5: request_id 멱등 처리 (유니크 제약으로 강제)
      const { data: existingAction } = await withTenant(
        supabase
          .from('automation_actions')
          .select('id, result')
          .eq('request_id', requestId),
        taskCard.tenant_id
      ).single();

      if (existingAction) {
        // 이미 처리됨 - 즉시 성공 반환 (멱등)
        return new Response(
          JSON.stringify({
            status: 'executed',
            message: '이미 처리된 요청입니다.',
            request_id: requestId,
            result: existingAction.result || null
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ⚠️ 중요: 실행 시점 재평가(필수, Fail-Closed)
      // 챗봇.md 6.3: 실행 시점마다 Policy/RBAC를 다시 로드/평가
      // Plan 스냅샷은 "요청 당시 의도"이며 허가가 아님
      // L2-A(알림/발송) 실행은 `auto_notification.<event_type>.*` 정책을 재평가
      if (plan.automation_level === 'L2' && plan.execution_class === 'A') {
        const eventType = plan.event_type;
        if (!eventType) {
          return new Response(
            JSON.stringify({ error: 'event_type is required for L2-A execution', message: '실행에 필요한 event_type이 없습니다.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // ⚠️ P0: event_type 검증 (AUTOMATION_EVENT_CATALOG에 존재하는지 확인)
        // Fail-Closed: 카탈로그에 없는 event_type이면 즉시 차단
        try {
          assertAutomationEventType(eventType);
        } catch (eventTypeError) {
          const maskedError = maskPII(eventTypeError);
          console.error('[execute-task-card] Invalid event_type:', maskedError);
          return new Response(
            JSON.stringify({
              error: 'Invalid event_type',
              message: `유효하지 않은 event_type입니다: ${eventType}`,
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Policy 재평가 (Fail-Closed)
        // 챗봇.md 6.3: event_type이 카탈로그 미등록이면 Fail-Closed (policy-utils.ts에서 자동 검증)
        const policyEnabled = await getTenantSettingByPath(
          supabase,
          taskCard.tenant_id,
          `auto_notification.${eventType}.enabled`
        );

        if (!policyEnabled || policyEnabled !== true) {
          return new Response(
            JSON.stringify({
              error: 'Policy disabled or not found',
              message: '실행 정책이 비활성화되어 있거나 존재하지 않습니다.',
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // 실제 액션 실행 (Plan 스냅샷 기반)
      // ⚠️ 중요: duration_ms 계산을 위해 실행 시작 시간 기록
      const executionStartTime = Date.now();

      // Intent Registry 연동하여 intent_key 기반 실행 로직 라우팅
      // 챗봇.md 592-593: automation_actions.result는 {status: "success" | "failed", error_code?: string, message?: string} 형태
      let executionResult: { status: 'success' | 'failed'; error_code?: string; message?: string } = {
        status: 'success',
        message: 'Execution completed',
      };

      try {
        // L2-A Intent 실행 (Handler Registry 사용)
        if (plan.automation_level === 'L2' && plan.execution_class === 'A') {
          if (hasHandler(plan.intent_key)) {
            const handler = getHandler(plan.intent_key);
            if (handler) {
              // Handler 실행 컨텍스트 생성
              const handlerContext: HandlerContext = {
                tenant_id: taskCard.tenant_id,
                user_id: user.id,
                user_role: userRole,
                now_kst: new Date().toISOString(),
                supabase: supabase,
              };

              // Handler 실행
              const handlerResult = await handler.execute(plan, handlerContext);

              // Handler 결과를 executionResult로 변환
              if (handlerResult.status === 'success') {
                executionResult = {
                  status: 'success',
                  message: handlerResult.message || `Intent '${plan.intent_key}' 실행 완료`,
                };
              } else if (handlerResult.status === 'partial') {
                executionResult = {
                  status: 'failed',
                  error_code: handlerResult.error_code || 'PARTIAL_SUCCESS',
                  message: handlerResult.message || '일부 실행에 실패했습니다.',
                };
              } else {
                executionResult = {
                  status: 'failed',
                  error_code: handlerResult.error_code || 'EXECUTION_FAILED',
                  message: handlerResult.message || '실행에 실패했습니다.',
                };
              }
            } else {
              executionResult = {
                status: 'failed',
                error_code: 'HANDLER_NOT_FOUND',
                message: `Intent '${plan.intent_key}'에 대한 핸들러를 찾을 수 없습니다.`,
              };
            }
          } else {
            executionResult = {
              status: 'failed',
              error_code: 'HANDLER_NOT_REGISTERED',
              message: `Intent '${plan.intent_key}'에 대한 핸들러가 등록되지 않았습니다.`,
            };
          }
        } else {
          // L2-B는 이미 위에서 차단되었으므로 여기서는 L2-A만 처리
          executionResult = {
            status: 'failed',
            error_code: 'INVALID_AUTOMATION_LEVEL',
            message: `이 Intent는 실행할 수 없습니다: automation_level=${plan.automation_level}, execution_class=${plan.execution_class}`,
          };
        }
      } catch (execError) {
        // P0: PII 마스킹 필수
        const maskedExecError = maskPII(execError);
        console.error('[execute-task-card] Execution error:', maskedExecError);
        executionResult = {
          status: 'failed',
          error_code: 'EXECUTION_ERROR',
          message: execError instanceof Error ? execError.message : 'Execution failed',
        };
      }

      const executedAt = new Date().toISOString();
      // ⚠️ 중요: duration_ms 계산 (액티비티.md 8.1 참조)
      const durationMs = Date.now() - executionStartTime;
      const approvedAt = executedAt; // approve-and-execute는 승인과 실행이 동시

      // ⚠️ P0-1: 실행 로그 기록 (automation_actions)
      const { data: actionData, error: logError } = await supabase
        .from('automation_actions')
        .insert({
          task_id: taskId,
          action_type: 'approve-and-execute',
          executed_by: user.id,
          tenant_id: taskCard.tenant_id,
          request_id: requestId,
          result: executionResult,
          approved_by: user.id,
          approved_at: approvedAt,
          executor_role: userRole,
          execution_context: {
            intent_key: plan.intent_key,
            suggested_action: taskCard.suggested_action,
            executed_at: executedAt,
          },
        })
        .select('id')
        .single();

      if (logError) {
        // ⚠️ P0: PII 마스킹 필수 (체크리스트.md 4. PII 마스킹)
        const maskedLogError = maskPII(logError);
        console.error('[execute-task-card] Failed to log execution:', maskedLogError);
        return new Response(
          JSON.stringify({ error: 'Failed to log execution' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ⚠️ P0-10: Execution Audit 기록 (체크리스트.md 10. Execution Audit 규칙)
      // 액티비티.md 12: automation_actions 기록 후 execution_audit_runs도 생성되어야 함
      // intent_key → operation_type 매핑은 meta.operation_registry 테이블에서 조회
      let operationType = 'unknown_operation';
      let auditStatus: 'success' | 'failed' | 'partial' = executionResult.status === 'success' ? 'success' : 'failed';
      let errorCode: string | undefined = executionResult.error_code;
      let errorSummary: string | undefined = executionResult.message;

      // intent_key → operation_type 매핑 (액티비티.md 8.A.2 매핑 규칙)
      // ⚠️ P0-10: details allowlist 조회를 위해 allowed_details_keys도 함께 조회
      let allowedDetailsKeys: Record<string, boolean> | null = null;
      if (plan.intent_key) {
        try {
          const { data: registryEntry, error: registryError } = await supabase
            .from('meta.operation_registry')
            .select('operation_type, is_enabled, allowed_details_keys')
            .eq('intent_key', plan.intent_key)
            .single();

          if (registryError) {
            // 테이블이 없거나 조회 실패 시 unknown_operation으로 기록
            // ⚠️ P0: PII 마스킹 필수
            const maskedRegistryError = maskPII(registryError);
            console.error('[execute-task-card] Failed to query operation_registry:', maskedRegistryError);
            operationType = 'unknown_operation';
            auditStatus = 'failed';
            errorCode = 'unknown_operation';
            errorSummary = 'operation_registry 조회 실패';
          } else if (registryEntry && registryEntry.is_enabled !== false) {
            operationType = registryEntry.operation_type;
            allowedDetailsKeys = registryEntry.allowed_details_keys as Record<string, boolean> | null;
          } else {
            // 매핑 실패 또는 미등록: unknown_operation으로 기록 (액티비티.md 8.A.3)
            operationType = 'unknown_operation';
            auditStatus = 'failed';
            errorCode = 'unknown_operation';
            errorSummary = `Intent '${plan.intent_key}'에 대한 operation_type이 meta.operation_registry에 등록되지 않았습니다.`;
          }
        } catch (registryError) {
          // ⚠️ P0: PII 마스킹 필수
          const maskedRegistryError = maskPII(registryError);
          console.error('[execute-task-card] Failed to query operation_registry:', maskedRegistryError);
          // 조회 실패 시 unknown_operation으로 기록
          operationType = 'unknown_operation';
          auditStatus = 'failed';
          errorCode = 'unknown_operation';
          errorSummary = 'operation_registry 조회 실패';
        }
      }

      // execution_audit_runs 생성 (액티비티.md 8.1, 12 참조)
      // ⚠️ P0-10: Correlation Key 필수 (request_id 우선, 체크리스트.md 10. Execution Audit 규칙)
      const { error: auditError } = await supabase
        .from('execution_audit_runs')
        .insert({
          tenant_id: taskCard.tenant_id,
          occurred_at: executedAt,
          operation_type: operationType,
          status: auditStatus,
          source: 'ai', // automation_actions.action_type='approve-and-execute'는 source='ai' (액티비티.md 12 참조)
          actor_type: 'user',
          actor_id: `user:${user.id}`,
          summary: plan.plan_snapshot?.summary || executionResult.message || `Intent '${plan.intent_key}' 실행 완료`,
          details: (() => {
            // ⚠️ P0-10: details allowlist 적용 (체크리스트.md 10. Execution Audit 규칙)
            // 액티비티.md 8.1: details는 allowlist 기반으로만 저장, PII 직접 저장 금지
            if (executionResult.status !== 'success') {
              return null;
            }

            const rawDetails: Record<string, unknown> = {
              intent_key: plan.intent_key,
            };

            // allowlist 적용: allowed_details_keys에 있는 키만 저장
            if (allowedDetailsKeys && typeof allowedDetailsKeys === 'object') {
              const filteredDetails: Record<string, unknown> = {};
              for (const key in rawDetails) {
                if (allowedDetailsKeys[key] === true) {
                  filteredDetails[key] = rawDetails[key];
                }
              }
              return Object.keys(filteredDetails).length > 0 ? filteredDetails : null;
            }

            // allowlist가 없으면 기본 필드만 저장 (intent_key는 항상 허용 가정)
            return rawDetails;
          })(),
          reference: {
            request_id: requestId, // ⚠️ P0-10: correlation key 필수 (request_id 우선)
            task_id: taskId,
            entity_type: taskCard.entity_type,
            entity_id: taskCard.entity_id,
          },
          counts: plan.plan_snapshot?.target_count ? { affected: plan.plan_snapshot.target_count } : null, // 액티비티.md 8.1: counts는 선택적
          error_code: errorCode,
          error_summary: errorSummary,
          duration_ms: durationMs, // 액티비티.md 8.1: duration_ms 기록
          version: plan.schema_version || 'chatops.plan.v1', // 액티비티.md 8.1: version 기록 (Plan schema version 사용)
        });

      if (auditError) {
        // ⚠️ P0: PII 마스킹 필수
        const maskedAuditError = maskPII(auditError);
        console.error('[execute-task-card] Failed to create execution_audit_run:', maskedAuditError);
        // Execution Audit 기록 실패는 경고만 로그 (automation_actions는 이미 기록됨)
      }

      // ⚠️ 중요: TaskCard 상태 전이
      // 챗봇.md 596-600: approve-and-execute가 "처리 완료"되면 'executed' 상태로 변경
      // 성공/실패/에러 상세는 TaskCard.status가 아니라 automation_actions.result로 표현
      // automation_actions 기록 성공 후에만 전이 (Fail-Closed)
      const { error: updateError } = await withTenant(
        supabase
          .from('task_cards')
          .update({
            status: 'executed', // SSOT 허용값: pending/approved/executed/expired
            approved_by: user.id,
            approved_at: approvedAt,
            executed_at: executedAt,
            last_action_at_utc: executedAt,
            last_action_id: actionData.id,
            updated_at: executedAt,
          })
          .eq('id', taskId),
        taskCard.tenant_id
      );

      if (updateError) {
        // ⚠️ P0: PII 마스킹 필수 (체크리스트.md 4. PII 마스킹)
        const maskedUpdateError = maskPII(updateError);
        console.error('[execute-task-card] Failed to update task card status:', maskedUpdateError);
      }

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
    // ⚠️ P0: PII 마스킹 필수 (체크리스트.md 4. PII 마스킹)
    const maskedFatalError = maskPII(error);
    console.error('[execute-task-card] Fatal error:', maskedFatalError);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error
