// LAYER: SHARED_UTILITY
/**
 * ChatOps Planner
 *
 * 챗봇.md 6.2, 6.3 참조
 * 목적: IntentEnvelope를 받아서 Plan 스냅샷 생성
 *
 * [불변 규칙] Plan 스냅샷은 '요청 당시 의도/계획'일 뿐 '허가'가 아니다
 * [불변 규칙] 실행 시점에 Policy/RBAC를 다시 평가하며, 스냅샷은 실행 입력의 유일 근거
 * [불변 규칙] PII 마스킹 필수 (전화번호 뒤 4자리만, 주소/상담내용 원문 저장 금지)
 */

import type { IntentEnvelope } from './types';
import type { SuggestedActionChatOpsPlanV1 } from './types';
import { getIntent } from './registry';

/**
 * Plan 생성 옵션
 */
export interface CreatePlanOptions {
  requested_by_user_id: string;
  candidate_resolution?: {
    kind: 'token';
    token_id: string;
  };
  // Plan 생성 시 필요한 추가 정보 (예: 대상 리스트, 템플릿 등)
  // 실제 구현 시 Intent별로 필요한 정보를 받아야 함
  target_student_ids?: string[];
  summary?: string;
  channel?: string;
  template_id?: string;
  samples?: Array<{
    label: string;
    preview: string; // PII 마스킹 필수
  }>;
}

/**
 * Plan 생성
 *
 * @param envelope IntentEnvelope
 * @param options Plan 생성 옵션
 * @returns Plan 스냅샷
 */
export function createPlan(
  envelope: IntentEnvelope,
  options: CreatePlanOptions
): SuggestedActionChatOpsPlanV1 {
  // Intent Registry에서 Intent 정보 조회
  const intent = getIntent(envelope.intent_key);
  if (!intent) {
    throw new Error(`Intent not found: ${envelope.intent_key}`);
  }

  // L0 Intent는 Plan 생성 불가 (조회만 가능)
  if (intent.automation_level === 'L0') {
    throw new Error(`L0 Intent does not create Plan: ${envelope.intent_key}`);
  }

  // params 검증 (Intent Registry의 paramsSchema 사용)
  try {
    intent.paramsSchema.parse(envelope.params);
  } catch (error) {
    throw new Error(
      `Invalid params for intent ${envelope.intent_key}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // L2-A Intent는 event_type 필수 검증 (Fail-Closed 원칙)
  // 중요: 빌드타임 검증(validateRegistryIntegrity)에서도 검증하지만,
  // 런타임에도 Fail-Closed 원칙을 강화하기 위해 추가 검증
  if (intent.automation_level === 'L2' && intent.execution_class === 'A') {
    if (!intent.event_type) {
      throw new Error(
        `L2-A Intent requires event_type: ${envelope.intent_key} (불변 규칙: "L2-A intent는 event_type 결정적 매핑 필수")`
      );
    }
  }

  // 대상 리스트 추출 (params에서 student_ids 추출 또는 options에서)
  // 타입 안정성: student_ids가 배열인지 확인
  const targetStudentIds =
    options.target_student_ids ||
    (envelope.params &&
    typeof envelope.params === 'object' &&
    envelope.params !== null &&
    'student_ids' in envelope.params &&
    Array.isArray((envelope.params as { student_ids?: unknown }).student_ids)
      ? (envelope.params as { student_ids: string[] }).student_ids
      : []);

  // Registry의 warnings를 risks에 포함
  const risks = intent.warnings ? [...intent.warnings] : [];

  // Plan 스냅샷 생성
  const plan: SuggestedActionChatOpsPlanV1 = {
    schema_version: 'chatops.plan.v1',
    intent_key: envelope.intent_key,
    params: envelope.params,
    // 중요: 실행 시점 검증을 위한 메타데이터 포함
    // 챗봇.md 6.3: 실행 시점 Policy/RBAC 재평가에 필요
    automation_level: intent.automation_level,
    ...(intent.automation_level === 'L2' && {
      execution_class: intent.execution_class,
      // L2-A일 때만 event_type 포함 (Policy 재평가용)
      // 중요: 위에서 이미 event_type 필수 검증을 수행했으므로, 여기서는 항상 존재함
      ...(intent.execution_class === 'A' && {
        event_type: intent.event_type!,
      }),
    }),
    plan_snapshot: {
      summary:
        options.summary ||
        `${intent.description} (대상: ${targetStudentIds.length}명)`,
      target_count: targetStudentIds.length,
      targets: {
        kind: 'student_id_list',
        student_ids: targetStudentIds,
      },
      ...(options.samples && { samples: options.samples }),
      ...(options.channel && { channel: options.channel }),
      ...(options.template_id && { template_id: options.template_id }),
      ...(risks.length > 0 && { risks }),
    },
    security: {
      requested_by_user_id: options.requested_by_user_id,
      // UTC 타임스탬프 생성 (requested_at_utc 필드는 UTC 기준이므로 toISOString() 사용)
      requested_at_utc: new Date().toISOString(),
      ...(options.candidate_resolution && {
        candidate_resolution: options.candidate_resolution,
      }),
    },
  };

  return plan;
}

/**
 * Plan 검증
 * TaskCard.suggested_action에서 로드한 Plan 스냅샷 검증
 *
 * @param plan Plan 스냅샷
 * @returns 검증 성공 여부
 */
export function validatePlan(plan: unknown): plan is SuggestedActionChatOpsPlanV1 {
  if (!plan || typeof plan !== 'object') {
    return false;
  }

  const p = plan as Partial<SuggestedActionChatOpsPlanV1>;

  // 최소 필수 필드 검증 (챗봇.md 4.3 참조)
  // P0-SCHEMA: Fail-Closed 검증 기준은 '본 문서 스키마'가 아니라 'SSOT 정본의 최소 필수 필드'로 둔다
  // SSOT 정본에 정의된 필수 필드만 검증하며, 본 문서의 추가 필드는 선택적이다
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

