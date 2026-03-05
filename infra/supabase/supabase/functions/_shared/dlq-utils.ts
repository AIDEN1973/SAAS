/**
 * Dead Letter Queue (DLQ) Utility
 *
 * [Phase 3] 재시도 소진된 실패 작업을 DLQ 테이블에 저장하고 재처리하는 유틸리티
 * [불변 규칙] 모든 DLQ 항목은 tenant_id 기반 RLS 적용
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface DLQEntry {
  tenant_id: string | null;
  function_name: string;
  payload: Record<string, unknown>;
  error_message: string;
  error_code?: string;
  max_retries?: number;
}

export interface DLQRecord {
  id: string;
  tenant_id: string | null;
  function_name: string;
  payload: Record<string, unknown>;
  error_message: string;
  error_code: string | null;
  retry_count: number;
  max_retries: number;
  status: 'pending' | 'retrying' | 'failed' | 'resolved';
  created_at: string;
  last_retried_at: string | null;
  resolved_at: string | null;
}

export interface DLQStats {
  function_name: string;
  pending_count: number;
  failed_count: number;
  resolved_count: number;
  total_count: number;
}

/**
 * 실패한 작업을 DLQ에 추가
 *
 * @param supabase Supabase 클라이언트 (service_role 권한)
 * @param entry DLQ 항목 정보
 */
export async function enqueueDLQ(
  supabase: SupabaseClient,
  entry: DLQEntry
): Promise<void> {
  try {
    const { error } = await supabase.from('dead_letter_queue').insert({
      tenant_id: entry.tenant_id,
      function_name: entry.function_name,
      payload: entry.payload,
      error_message: entry.error_message.substring(0, 2000),
      error_code: entry.error_code || null,
      max_retries: entry.max_retries ?? 3,
      status: 'pending',
      retry_count: 0,
    });

    if (error) {
      // DLQ 적재 실패는 콘솔에 로깅 (원본 에러 정보 손실 방지)
      console.error('[DLQ] Failed to enqueue:', error.message, {
        function_name: entry.function_name,
        tenant_id: entry.tenant_id,
      });
    } else {
      console.warn('[DLQ] Enqueued failed operation:', {
        function_name: entry.function_name,
        tenant_id: entry.tenant_id,
        error_code: entry.error_code,
      });
    }
  } catch (e) {
    console.error('[DLQ] Exception in enqueueDLQ:', e instanceof Error ? e.message : String(e));
  }
}

/**
 * DLQ 레코드를 원자적으로 claim (SELECT + UPDATE in single transaction)
 *
 * FOR UPDATE SKIP LOCKED 패턴으로 동시 worker 간 중복 처리 방지.
 * claim 즉시 status='retrying'으로 변경하여 다른 worker가 같은 레코드를 가져가지 못하게 함.
 *
 * @param supabase Supabase 클라이언트 (service_role 권한)
 * @param functionName 함수명 필터 (선택, 미지정 시 전체)
 * @param limit 최대 claim 건수 (기본값: 50)
 */
export async function claimDLQRecords(
  supabase: SupabaseClient,
  functionName?: string,
  limit = 50
): Promise<DLQRecord[]> {
  try {
    const { data, error } = await supabase.rpc('claim_dlq_records', {
      p_function_name: functionName || null,
      p_limit: limit,
    });

    if (error) {
      // RPC 실패 시 fallback: 낙관적 잠금 (optimistic locking)
      console.warn('[DLQ] claim_dlq_records RPC failed, using optimistic claim:', error.message);
      return await optimisticClaimDLQ(supabase, functionName, limit);
    }

    return (data || []) as DLQRecord[];
  } catch (e) {
    console.error('[DLQ] Exception in claimDLQRecords:', e instanceof Error ? e.message : String(e));
    return [];
  }
}

/**
 * 낙관적 잠금 기반 DLQ claim (RPC가 없는 환경에서의 fallback)
 *
 * SELECT 후 UPDATE with status='pending' 조건으로 경합 시 중복 방지.
 * 완벽하지 않지만 중복 처리 확률을 크게 줄임.
 */
async function optimisticClaimDLQ(
  supabase: SupabaseClient,
  functionName?: string,
  limit = 50
): Promise<DLQRecord[]> {
  // 1. pending 레코드 조회
  let query = supabase
    .from('dead_letter_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (functionName) {
    query = query.eq('function_name', functionName);
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) return [];

  // 2. 각 레코드를 개별 claim (status='pending' 조건으로 경합 방지)
  const claimed: DLQRecord[] = [];
  for (const record of data as DLQRecord[]) {
    const { data: updated, error: updateError } = await supabase
      .from('dead_letter_queue')
      .update({
        status: 'retrying',
        last_retried_at: new Date().toISOString(),
      })
      .eq('id', record.id)
      .eq('status', 'pending') // 낙관적 잠금: 아직 pending인 경우만 claim
      .select();

    if (!updateError && updated && updated.length > 0) {
      claimed.push(updated[0] as DLQRecord);
    }
  }

  return claimed;
}

/**
 * DLQ 항목 처리 완료 표시
 */
export async function resolveDLQ(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from('dead_letter_queue')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('[DLQ] Failed to resolve:', error.message);
  }
}

/**
 * DLQ 항목 재시도 실패 처리 (retry_count 증가)
 *
 * max_retries 초과 시 status를 'failed'로 변경
 */
export async function failDLQRetry(
  supabase: SupabaseClient,
  record: DLQRecord
): Promise<boolean> {
  const newRetryCount = record.retry_count + 1;
  const isFinalFailure = newRetryCount >= record.max_retries;

  const { error } = await supabase
    .from('dead_letter_queue')
    .update({
      status: isFinalFailure ? 'failed' : 'pending',
      retry_count: newRetryCount,
      last_retried_at: new Date().toISOString(),
    })
    .eq('id', record.id);

  if (error) {
    console.error('[DLQ] Failed to update retry count:', error.message);
  }

  return isFinalFailure;
}

/**
 * DLQ 통계 조회 (모니터링용)
 */
export async function getDLQStats(
  supabase: SupabaseClient
): Promise<DLQStats[]> {
  const { data, error } = await supabase
    .rpc('get_dlq_stats');

  if (error) {
    // RPC가 없으면 fallback 쿼리
    console.warn('[DLQ] get_dlq_stats RPC not found, using fallback query');

    const { data: rawData, error: fallbackError } = await supabase
      .from('dead_letter_queue')
      .select('function_name, status');

    if (fallbackError || !rawData) {
      console.error('[DLQ] Failed to get stats:', fallbackError?.message);
      return [];
    }

    // 수동 집계
    const statsMap = new Map<string, DLQStats>();
    for (const row of rawData as Array<{ function_name: string; status: string }>) {
      const existing = statsMap.get(row.function_name) || {
        function_name: row.function_name,
        pending_count: 0,
        failed_count: 0,
        resolved_count: 0,
        total_count: 0,
      };
      existing.total_count++;
      if (row.status === 'pending') existing.pending_count++;
      else if (row.status === 'failed') existing.failed_count++;
      else if (row.status === 'resolved') existing.resolved_count++;
      statsMap.set(row.function_name, existing);
    }

    return Array.from(statsMap.values());
  }

  return (data || []) as DLQStats[];
}
