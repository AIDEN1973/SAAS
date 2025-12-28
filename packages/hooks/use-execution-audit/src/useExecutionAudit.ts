/**
 * useExecutionAudit Hook
 *
 * React Query 기반 Execution Audit Hook
 * [SSOT 준수] 액티비티.md 문서 기준 엄격히 준수
 * [불변 규칙] tenant 변경 시 invalidateQueries() 자동 발생
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import type {
  ExecutionAuditRun,
  ExecutionAuditStep,
  ExecutionAuditFilters,
} from '@ui-core/react';

/**
 * Execution Audit Runs 목록 조회 응답 (액티비티.md 10.1 참조)
 */
interface ExecutionAuditRunsResponse {
  items: ExecutionAuditRun[];
  next_cursor?: string;
  has_more: boolean;
}

/**
 * Execution Audit Steps 목록 조회 응답 (액티비티.md 10.2 참조)
 */
interface ExecutionAuditStepsResponse {
  items: ExecutionAuditStep[];
  next_cursor?: string;
  has_more: boolean;
}

/**
 * Execution Audit Runs 목록 조회 함수
 */
async function fetchExecutionAuditRuns(
  tenantId: string,
  filters?: ExecutionAuditFilters,
  cursor?: string
): Promise<ExecutionAuditRunsResponse> {
  if (!tenantId) {
    return { items: [], has_more: false };
  }

  // 쿼리 파라미터 구성 (액티비티.md 10.1 참조)
  const params: Record<string, string> = {};
  if (cursor) {
    params.cursor = cursor;
  }
  if (filters?.dateFrom) {
    params.from = filters.dateFrom.toISOString();
  }
  if (filters?.dateTo) {
    params.to = filters.dateTo.toISOString();
  }
  if (filters?.status && filters.status !== 'all') {
    params.status = filters.status;
  }
  if (filters?.operation_type && filters.operation_type !== 'all') {
    params.operation_type = filters.operation_type;
  }
  if (filters?.source && filters.source !== 'all') {
    params.source = filters.source;
  }
  if (filters?.searchQuery) {
    params.q = filters.searchQuery;
  }
  params.limit = '20'; // 기본 페이지 크기

  // Edge Function 호출 (액티비티.md 10.1 참조)
  // GET /functions/v1/execution-audit-runs?cursor=&from=&to=&status=&operation_type=&source=&q=
  const response = await apiClient.invokeFunction<ExecutionAuditRunsResponse>(
    'execution-audit-runs',
    params
  );

  if (response.error) {
    throw new Error(response.error.message);
  }

  // Date 문자열을 Date 객체로 변환
  const items = (response.data?.items || []).map((run) => ({
    ...run,
    occurred_at: new Date(run.occurred_at),
    ...(run.created_at && { created_at: new Date(run.created_at) }),
  }));

  return {
    items,
    next_cursor: response.data?.next_cursor,
    has_more: response.data?.has_more || false,
  };
}

/**
 * Execution Audit Run 상세 조회 함수
 */
async function fetchExecutionAuditRun(
  tenantId: string,
  runId: string
): Promise<ExecutionAuditRun> {
  if (!tenantId || !runId) {
    throw new Error('Tenant ID and Run ID are required');
  }

  // Edge Function 호출 (액티비티.md 10.2 참조)
  // GET /functions/v1/execution-audit-runs/{run_id}
  // ⚠️ 참고: apiClient.invokeFunction은 body만 지원하므로, run_id를 body로 전달
  // Edge Function에서 URL 경로를 파싱하여 run_id 추출
  const response = await apiClient.invokeFunction<ExecutionAuditRun>(
    'execution-audit-runs',
    { run_id: runId } as unknown as Record<string, unknown>
  );

  if (response.error) {
    throw new Error(response.error.message);
  }

  if (!response.data) {
    throw new Error('Run not found');
  }

  // Date 문자열을 Date 객체로 변환
  return {
    ...response.data,
    occurred_at: new Date(response.data.occurred_at),
    ...(response.data.created_at && { created_at: new Date(response.data.created_at) }),
  };
}

/**
 * Execution Audit Steps 목록 조회 함수 (외부에서도 사용 가능)
 */
export async function fetchExecutionAuditSteps(
  tenantId: string,
  runId: string,
  cursor?: string
): Promise<ExecutionAuditStepsResponse> {
  if (!tenantId || !runId) {
    return { items: [], has_more: false };
  }

  const params: Record<string, string> = {
    run_id: runId,
  };
  if (cursor) {
    params.cursor = cursor;
  }
  params.limit = '20'; // 기본 페이지 크기

  // Edge Function 호출 (액티비티.md 10.2 참조)
  // GET /functions/v1/execution-audit-runs/{run_id}/steps?cursor=
  // ⚠️ 참고: apiClient.invokeFunction은 body만 지원하므로, run_id와 cursor를 body로 전달
  // Edge Function에서 URL 경로를 파싱하여 run_id 추출
  const response = await apiClient.invokeFunction<ExecutionAuditStepsResponse>(
    'execution-audit-runs',
    {
      run_id: runId,
      ...params,
    } as unknown as Record<string, unknown>
  );

  if (response.error) {
    throw new Error(response.error.message);
  }

  // Date 문자열을 Date 객체로 변환
  const items = (response.data?.items || []).map((step) => ({
    ...step,
    occurred_at: new Date(step.occurred_at),
    ...(step.created_at && { created_at: new Date(step.created_at) }),
  }));

  return {
    items,
    next_cursor: response.data?.next_cursor,
    has_more: response.data?.has_more || false,
  };
}

/**
 * Execution Audit Runs 목록 조회 Hook
 */
export function useExecutionAuditRuns(
  filters?: ExecutionAuditFilters,
  cursor?: string
) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['execution-audit-runs', tenantId, filters, cursor],
    queryFn: () => fetchExecutionAuditRuns(tenantId || '', filters, cursor),
    enabled: !!tenantId,
    staleTime: 30 * 1000, // 30초
  });
}

/**
 * Execution Audit Run 상세 조회 Hook
 */
export function useExecutionAuditRun(runId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['execution-audit-run', tenantId, runId],
    queryFn: () => fetchExecutionAuditRun(tenantId || '', runId || ''),
    enabled: !!tenantId && !!runId,
    staleTime: 60 * 1000, // 1분
  });
}

/**
 * Execution Audit Steps 목록 조회 Hook
 */
export function useExecutionAuditSteps(
  runId: string | null,
  cursor?: string
) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['execution-audit-steps', tenantId, runId, cursor],
    queryFn: () => fetchExecutionAuditSteps(tenantId || '', runId || '', cursor),
    enabled: !!tenantId && !!runId,
    staleTime: 60 * 1000, // 1분
  });
}

