/**
 * Execution Audit 유틸리티 함수
 *
 * 액티비티.md 3.3, 12 참조
 * 모든 데이터 변경 작업에 Execution Audit 기록을 생성하는 공통 함수
 */

import { apiClient, getApiContext } from '@api-sdk/core';
import type { ApiResponse } from '@api-sdk/core';

export interface CreateExecutionAuditParams {
  operation_type: string;
  status: 'success' | 'failed' | 'partial';
  summary: string;
  details?: Record<string, unknown> | null;
  reference: {
    entity_type: string;
    entity_id: string;
    source_event_id?: string;
    [key: string]: unknown;
  };
  duration_ms?: number;
  error_code?: string;
  error_summary?: string;
}

/**
 * Execution Audit 기록 생성 (공통 함수)
 *
 * 액티비티.md 8.1, 12 참조
 * - source='manual' (수동 실행)
 * - actor_type='user'
 * - actor_id='user:{userId}'
 */
export async function createExecutionAuditRecord(
  params: CreateExecutionAuditParams,
  userId?: string
): Promise<void> {
  const context = getApiContext();
  const tenantId = context.tenantId;

  if (!tenantId) {
    console.warn('[createExecutionAuditRecord] tenantId가 없어 Execution Audit 기록을 생성하지 않습니다.');
    return;
  }

  if (!userId) {
    console.warn('[createExecutionAuditRecord] userId가 없어 Execution Audit 기록을 생성하지 않습니다.');
    return;
  }

  try {
    const occurredAt = new Date().toISOString();

    // execution_audit_runs 생성 (액티비티.md 8.1, 12 참조)
    // ⚠️ P0-10: Correlation Key 필수 (source_event_id 사용, 액티비티.md 7.2 참조)
    const auditPayload = {
      tenant_id: tenantId,
      occurred_at: occurredAt,
      operation_type: params.operation_type,
      status: params.status,
      source: 'manual' as const, // 수동 실행 (액티비티.md 6.1 참조)
      actor_type: 'user' as const,
      actor_id: `user:${userId}`,
      summary: params.summary,
      details: params.details || null,
      reference: {
        ...params.reference,
        // source_event_id가 없으면 자동 생성
        source_event_id: params.reference.source_event_id || `manual:${params.operation_type}:${params.reference.entity_id}:${Date.now()}`,
      },
      duration_ms: params.duration_ms,
      error_code: params.error_code || null,
      error_summary: params.error_summary || null,
    };

    // execution_audit_runs 테이블에 직접 INSERT
    await apiClient.post('execution_audit_runs', auditPayload);
  } catch (auditError) {
    // Execution Audit 기록 실패는 경고만 로그 (원본 작업은 이미 성공)
    console.error('[createExecutionAuditRecord] Execution Audit 기록 실패:', auditError);
  }
}

