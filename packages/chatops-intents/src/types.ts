// LAYER: SHARED_TYPES
/**
 * ChatOps Intent 관련 타입 정의
 * 챗봇.md 참조
 */

/**
 * IntentEnvelope 타입
 * 챗봇.md 7.1 참조
 */
export type IntentEnvelopeBase<TParams = unknown> = {
  intent_key: string;
  params: TParams;
  dry_run?: boolean;
  requested_by: 'chatops';
  client_context?: {
    scope_hint?: {
      class_id?: string;
      teacher_id?: string;
      grade?: string;
    };
  };
  server_context: {
    tenant_id: string;
    scope: {
      class_id?: string;
      teacher_id?: string;
      grade?: string;
    };
    now_kst: string;
  };
};

export type IntentEnvelope<TParams = unknown> =
  | (IntentEnvelopeBase<TParams> & {
      automation_level: 'L0' | 'L1';
      execution_class?: never;
    })
  | (IntentEnvelopeBase<TParams> & {
      automation_level: 'L2';
      execution_class: 'A' | 'B';
    });

/**
 * Plan 스냅샷 타입
 * 챗봇.md 4.3 참조
 * TaskCard.suggested_action에 저장되는 Plan 스냅샷 구조
 */
export interface SuggestedActionChatOpsPlanV1 {
  schema_version?: 'chatops.plan.v1';
  intent_key: string;
  params: unknown;
  // 중요: 실행 시점 검증을 위한 메타데이터
  // execution_class와 event_type은 L2 실행 시 Policy 재평가에 필요
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
      preview: string; // PII 마스킹 필수
    }>;
    channel?: string;
    template_id?: string;
    risks?: string[];
  };
  security: {
    requested_by_user_id: string;
    requested_at_utc: string; // ISO 8601
    candidate_resolution?: {
      kind: 'token';
      token_id: string;
    };
  };
}

