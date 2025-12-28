// LAYER: EDGE_FUNCTION_SHARED
/**
 * Handler Contract 타입 정의
 * 챗봇.md 12.1 참조
 *
 * [불변 규칙] 모든 Handler는 이 Contract를 준수해야 함
 * [불변 규칙] 입력은 Plan 스냅샷만 사용 (클라이언트 입력 무시)
 * [불변 규칙] 출력은 표준화된 실행 결과 형식 사용
 */

/**
 * Plan 스냅샷 타입 (챗봇.md 4.3 참조)
 * TaskCard.suggested_action에 저장되는 Plan 스냅샷 구조
 */
export interface SuggestedActionChatOpsPlanV1 {
  schema_version?: 'chatops.plan.v1';
  intent_key: string;
  params: unknown;
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

/**
 * Handler 실행 컨텍스트
 */
export interface HandlerContext {
  tenant_id: string;
  user_id: string;
  user_role: string;
  now_kst: string;
  supabase: any; // SupabaseClient 타입 (Deno 환경 제약)
}

/**
 * Handler 실행 결과
 * ChatOps_계약_붕괴_방지_체계_분석.md 2.2.6 참조: 부분 성공 처리 모델
 */
export interface HandlerResult {
  status: 'success' | 'failed' | 'partial';
  result?: {
    total_count?: number;
    success_count?: number;
    error_count?: number;
    // 부분 성공 시 성공/실패 리스트
    success_list?: Array<{
      entity_id: string;
      entity_name?: string;
    }>;
    failure_list?: Array<{
      entity_id: string;
      entity_name?: string;
      reason?: string;
    }>;
    // 기타 결과 데이터
    [key: string]: unknown;
  };
  error_code?: string;
  contract_category?: ContractErrorCategory; // 계약 카테고리별 에러 태깅
  message?: string;
  affected_count?: number; // 대량 작업 시 (하위 호환성)
}

/**
 * Handler 인터페이스 (표준)
 * 챗봇.md 12.1 Handler Contract 정의 참조
 */
export interface IntentHandler {
  // intent_key로 핸들러 매핑 (Registry 기반)
  intent_key: string;

  // 실행 함수
  execute(
    plan: SuggestedActionChatOpsPlanV1,
    context: HandlerContext
  ): Promise<HandlerResult>;
}

/**
 * 표준 에러 코드 체계
 */
export enum HandlerErrorCode {
  POLICY_DISABLED = 'POLICY_DISABLED',
  INSUFFICIENT_PERMISSION = 'INSUFFICIENT_PERMISSION',
  TARGET_NOT_FOUND = 'TARGET_NOT_FOUND',
  INVALID_PARAMS = 'INVALID_PARAMS',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  PARTIAL_SUCCESS = 'PARTIAL_SUCCESS',
}

/**
 * 계약 카테고리별 에러 분류
 * ChatOps_계약_붕괴_방지_체계_분석.md 2.2.5 참조
 * 인텐트별 에러가 아닌 계약 카테고리별로 집계하여 원인 추적 개선
 */
export enum ContractErrorCategory {
  CONTRACT_INPUT_TYPE = 'CONTRACT_INPUT_TYPE',
  CONTRACT_RESOLUTION_AMBIGUOUS = 'CONTRACT_RESOLUTION_AMBIGUOUS',
  CONTRACT_DB_SCHEMA_MISMATCH = 'CONTRACT_DB_SCHEMA_MISMATCH',
  CONTRACT_POLICY_DISABLED = 'CONTRACT_POLICY_DISABLED',
  CONTRACT_IDEMPOTENCY_VIOLATION = 'CONTRACT_IDEMPOTENCY_VIOLATION',
  CONTRACT_STATE_CHANGED = 'CONTRACT_STATE_CHANGED',
  CONTRACT_TARGET_NOT_FOUND = 'CONTRACT_TARGET_NOT_FOUND',
  CONTRACT_SESSION_MISMATCH = 'CONTRACT_SESSION_MISMATCH',
  CONTRACT_LEVEL_MISMATCH = 'CONTRACT_LEVEL_MISMATCH',
  EXTERNAL_PROVIDER_FAILURE = 'EXTERNAL_PROVIDER_FAILURE',
}

