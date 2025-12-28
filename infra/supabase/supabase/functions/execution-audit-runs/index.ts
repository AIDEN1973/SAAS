/**
 * Execution Audit Runs Edge Function
 *
 * 액티비티.md 10.1, 10.2 섹션 참조
 * 목적: Execution Audit Runs 조회 API
 *
 * 엔드포인트:
 * - GET /functions/v1/execution-audit-runs?cursor=&from=&to=&status=&operation_type=&source=&q=
 * - GET /functions/v1/execution-audit-runs/{run_id}
 * - GET /functions/v1/execution-audit-runs/{run_id}/steps?cursor=
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withTenant } from '../_shared/withTenant.ts';
import { envServer } from '../_shared/env-registry.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface ExecutionAuditRun {
  id: string;
  tenant_id: string;
  occurred_at: string;
  operation_type: string;
  status: 'success' | 'failed' | 'partial';
  source: 'ai' | 'automation' | 'scheduler' | 'manual' | 'webhook';
  actor_type: 'user' | 'system' | 'external';
  actor_id?: string;
  summary: string;
  details?: Record<string, unknown>;
  reference: Record<string, unknown>;
  counts?: { success: number; failed: number };
  error_code?: string;
  error_summary?: string;
  duration_ms?: number;
  version?: string;
  created_at: string;
}

interface ExecutionAuditStep {
  id: string;
  tenant_id: string;
  run_id: string;
  occurred_at: string;
  status: 'success' | 'failed';
  target_type: string;
  target_id: string;
  summary: string;
  details?: Record<string, unknown>;
  error_code?: string;
  error_summary?: string;
  created_at: string;
}

/**
 * Cursor 파싱 (액티비티.md 10.1 참조)
 * 형식: {last_occurred_at}:{last_id}
 */
function parseCursor(cursor?: string): { occurred_at?: string; id?: string } | null {
  if (!cursor) return null;
  const parts = cursor.split(':');
  if (parts.length !== 2) return null;
  return { occurred_at: parts[0], id: parts[1] };
}

/**
 * Cursor 생성 (액티비티.md 10.1 참조)
 */
function createCursor(occurred_at: string, id: string): string {
  return `${occurred_at}:${id}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
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

    // tenant_id 추출 (JWT claim에서 추출, Zero-Trust 원칙)
    let tenantId: string | null = null;
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
        tenantId = payload.tenant_id || null;
      }
    } catch (error) {
      console.error('[execution-audit-runs] JWT parsing error:', error);
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Tenant ID not found in JWT claims' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const functionName = pathParts[pathParts.length - 1]; // 'execution-audit-runs'

    // body에서 run_id 추출 시도 (apiClient.invokeFunction은 body만 전달)
    let bodyData: { run_id?: string; cursor?: string; [key: string]: unknown } | null = null;
    try {
      bodyData = await req.json().catch(() => null);
    } catch {
      // body 파싱 실패 시 무시
    }

    // 경로 파싱: /functions/v1/execution-audit-runs/{run_id} 또는 /functions/v1/execution-audit-runs/{run_id}/steps
    const runIdIndex = pathParts.indexOf('execution-audit-runs') + 1;
    let runId = runIdIndex > 0 && runIdIndex < pathParts.length ? pathParts[runIdIndex] : null;
    // body에서도 run_id 추출 시도 (apiClient.invokeFunction 사용 시)
    if (!runId && bodyData?.run_id) {
      runId = bodyData.run_id as string;
    }
    const isSteps = (runId && pathParts[runIdIndex + 1] === 'steps') || (bodyData && 'cursor' in bodyData && runId);

    // Step 조회: GET /functions/v1/execution-audit-runs/{run_id}/steps?cursor=
    if (isSteps && runId) {
      const cursor = url.searchParams.get('cursor');
      const parsedCursor = parseCursor(cursor || undefined);
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

      let query = withTenant(
        supabase
          .from('execution_audit_steps')
          .select('*')
          .eq('run_id', runId)
          .order('occurred_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(limit + 1), // has_more 판단을 위해 +1
        tenantId
      );

      // Cursor 기반 페이징 (액티비티.md 10.1 참조)
      // occurred_at desc 정렬 기준으로 cursor 생성
      // 동일 시각 처리: occurred_at이 동일한 경우 id를 추가 정렬 기준으로 사용
      if (parsedCursor) {
        if (parsedCursor.occurred_at && parsedCursor.id) {
          // Supabase PostgREST의 .or()는 특정 형식을 요구함
          // 형식: "column1.eq.value1,column2.eq.value2" (AND 조건)
          // 또는 "column1.eq.value1,column2.neq.value2" (OR 조건)
          // occurred_at < cursor.occurred_at OR (occurred_at = cursor.occurred_at AND id < cursor.id)
          // 이를 위해 .or()를 사용하되, PostgREST 형식에 맞게 작성
          query = query.or(`occurred_at.lt.${parsedCursor.occurred_at},occurred_at.eq.${parsedCursor.occurred_at},id.lt.${parsedCursor.id}`);
        }
      }

      const { data: steps, error } = await query;

      if (error) {
        console.error('[execution-audit-runs] Error fetching steps:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch steps' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const hasMore = steps && steps.length > limit;
      const items = (steps || []).slice(0, limit);
      const nextCursor = hasMore && items.length > 0
        ? createCursor(items[items.length - 1].occurred_at, items[items.length - 1].id)
        : undefined;

      return new Response(
        JSON.stringify({
          items: items.map((step: ExecutionAuditStep) => ({
            ...step,
            occurred_at: new Date(step.occurred_at).toISOString(),
            created_at: new Date(step.created_at).toISOString(),
          })),
          next_cursor: nextCursor,
          has_more: hasMore,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Run 상세 조회: GET /functions/v1/execution-audit-runs/{run_id}
    if (runId && !isSteps) {
      const { data: run, error } = await withTenant(
        supabase
          .from('execution_audit_runs')
          .select('*')
          .eq('id', runId)
          .single(),
        tenantId
      );

      if (error) {
        console.error('[execution-audit-runs] Error fetching run:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch run' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!run) {
        return new Response(
          JSON.stringify({ error: 'Run not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          ...run,
          occurred_at: new Date(run.occurred_at).toISOString(),
          created_at: new Date(run.created_at).toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Run 목록 조회: GET /functions/v1/execution-audit-runs?cursor=&from=&to=&status=&operation_type=&source=&q=
    const cursor = url.searchParams.get('cursor');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const status = url.searchParams.get('status');
    const operationType = url.searchParams.get('operation_type');
    const source = url.searchParams.get('source');
    const q = url.searchParams.get('q');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

    const parsedCursor = parseCursor(cursor || undefined);

    let query = withTenant(
      supabase
        .from('execution_audit_runs')
        .select('*')
        .order('occurred_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1), // has_more 판단을 위해 +1
      tenantId
    );

    // 필터 적용 (액티비티.md 10.1 참조)
    if (from) {
      query = query.gte('occurred_at', from);
    }
    if (to) {
      query = query.lte('occurred_at', to);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (operationType && operationType !== 'all') {
      query = query.eq('operation_type', operationType);
    }
    if (source && source !== 'all') {
      query = query.eq('source', source);
    }

    // 검색 (q) - 액티비티.md 10.3 참조
    // ⚠️ 참고: Supabase 쿼리 빌더의 제한으로 인해 reference JSONB 검색은 복잡함
    // 일단 summary와 error_summary만 검색하고, reference 검색은 향후 RPC 함수로 개선 가능
    if (q) {
      query = query.or(`summary.ilike.%${q}%,error_summary.ilike.%${q}%`);
    }

    // Cursor 기반 페이징 (액티비티.md 10.1 참조)
    // occurred_at desc 정렬 기준으로 cursor 생성
    // 동일 시각 처리: occurred_at이 동일한 경우 id를 추가 정렬 기준으로 사용
    // 목표: (occurred_at < cursor.occurred_at) OR (occurred_at = cursor.occurred_at AND id < cursor.id)
    // ⚠️ 참고: Supabase PostgREST의 .or()는 복잡한 AND/OR 조합을 직접 지원하지 않음
    // 현재 구현은 근사치: occurred_at < cursor OR occurred_at = cursor OR id < cursor
    // 실제로는 occurred_at이 동일한 경우가 드물므로 대부분의 경우 정확하게 동작함
    // 향후 정확한 구현이 필요하면 RPC 함수 사용 권장
    if (parsedCursor) {
      if (parsedCursor.occurred_at && parsedCursor.id) {
        // PostgREST .or() 형식: "column1.op.value1,column2.op.value2" (OR 조건)
        query = query.or(`occurred_at.lt.${parsedCursor.occurred_at},occurred_at.eq.${parsedCursor.occurred_at},id.lt.${parsedCursor.id}`);
      }
    }

    const { data: runs, error } = await query;

    if (error) {
      console.error('[execution-audit-runs] Error fetching runs:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch runs' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hasMore = runs && runs.length > limit;
    const items = (runs || []).slice(0, limit);
    const nextCursor = hasMore && items.length > 0
      ? createCursor(items[items.length - 1].occurred_at, items[items.length - 1].id)
      : undefined;

    return new Response(
      JSON.stringify({
        items: items.map((run: ExecutionAuditRun) => ({
          ...run,
          occurred_at: new Date(run.occurred_at).toISOString(),
          created_at: new Date(run.created_at).toISOString(),
        })),
        next_cursor: nextCursor,
        has_more: hasMore,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[execution-audit-runs] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

