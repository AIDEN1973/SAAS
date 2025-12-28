/**
 * Execution Audit 유틸리티 함수 (Edge Function용)
 *
 * 액티비티.md 3.3, 12 참조
 * Edge Function에서 Execution Audit 기록을 생성하는 공통 함수
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { maskPII } from './pii-utils.ts';

export interface CreateExecutionAuditParams {
  tenant_id: string;
  operation_type: string;
  status: 'success' | 'failed' | 'partial';
  source: 'ai' | 'automation' | 'scheduler' | 'manual' | 'webhook';
  actor_type: 'user' | 'system' | 'external';
  actor_id?: string;
  summary: string;
  details?: Record<string, unknown> | null;
  reference: {
    entity_type?: string;
    entity_id?: string;
    source_event_id?: string;
    [key: string]: unknown;
  };
  counts?: { affected?: number; success?: number; failed?: number } | null;
  duration_ms?: number;
  error_code?: string;
  error_summary?: string;
  version?: string;
}

/**
 * Execution Audit 기록 생성 (Edge Function용)
 *
 * 액티비티.md 8.1, 12 참조
 */
export async function createExecutionAuditRecord(
  supabase: SupabaseClient,
  params: CreateExecutionAuditParams
): Promise<void> {
  try {
    const occurredAt = new Date().toISOString();

    // execution_audit_runs 생성 (액티비티.md 8.1, 12 참조)
    // ⚠️ P0-10: Correlation Key 필수 (source_event_id 사용, 액티비티.md 7.2 참조)
    const auditPayload = {
      tenant_id: params.tenant_id,
      occurred_at: occurredAt,
      operation_type: params.operation_type,
      status: params.status,
      source: params.source,
      actor_type: params.actor_type,
      actor_id: params.actor_id || null,
      summary: params.summary,
      details: params.details || null,
      reference: {
        ...params.reference,
        // source_event_id가 없으면 자동 생성
        source_event_id: params.reference.source_event_id || `${params.source}:${params.operation_type}:${params.reference.entity_id || 'unknown'}:${Date.now()}`,
      },
      counts: params.counts || null,
      duration_ms: params.duration_ms || null,
      error_code: params.error_code || null,
      error_summary: params.error_summary || null,
      version: params.version || null,
    };

    const { error: auditError } = await supabase
      .from('execution_audit_runs')
      .insert(auditPayload)
      .select('id')
      .single();

    if (auditError) {
      // ⚠️ P0: PII 마스킹 필수
      const maskedAuditError = maskPII(auditError);
      console.error('[createExecutionAuditRecord] Execution Audit 기록 실패:', {
        error_code: auditError.code,
        error_message: maskPII(auditError.message),
        operation_type: params.operation_type,
        status: params.status,
      });
      // Execution Audit 기록 실패는 경고만 로그 (원본 작업은 이미 성공)
    } else {
      console.error('[createExecutionAuditRecord] Execution Audit 기록 성공:', {
        operation_type: params.operation_type,
        status: params.status,
        source: params.source,
      });
    }
  } catch (auditError) {
    // Execution Audit 기록 실패는 경고만 로그 (원본 작업은 이미 성공)
    const maskedError = maskPII(auditError);
    console.error('[createExecutionAuditRecord] Execution Audit 기록 중 예외 발생:', maskedError);
  }
}

