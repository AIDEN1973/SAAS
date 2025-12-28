// LAYER: SHARED_UTILITY
/**
 * ChatOps TaskCard 생성 유틸리티
 *
 * 챗봇.md 6.2 참조
 * 목적: Plan 스냅샷에서 TaskCard 데이터 구조 생성
 *
 * [불변 규칙] TaskCard 생성은 반드시 UPSERT로만 수행 (dedup_key 기반)
 * [불변 규칙] dedup_key 포맷: "{tenantId}:{trigger}:{entityType}:{entityId}:{window}"
 * [불변 규칙] entityType='tenant'일 때 dedup_key의 entityId 세그먼트는 'global' 사용
 */

import type { SuggestedActionChatOpsPlanV1 } from './types';
import { getIntent, type IntentRegistryItem } from './registry';
import { toKST } from '@lib/date-utils';

/**
 * TaskCard 생성 입력 데이터 타입
 * 프론트 자동화.md 2.3, 챗봇.md 4.2 참조
 */
export interface TaskCardInput {
  tenant_id: string;
  entity_id: string; // UUID
  entity_type: string;
  student_id?: string | null; // 레거시 필드, entity_type='student'일 때만 사용
  task_type: string;
  source?: string | null;
  priority: number; // 0-100, Policy에서 조회 필수
  title: string;
  description?: string | null;
  action_url?: string | null;
  expires_at: string; // ISO 8601 timestamptz
  dedup_key: string; // 정본 포맷: "{tenantId}:{trigger}:{entityType}:{entityId}:{window}"
  status?: 'pending' | 'approved' | 'executed' | 'expired';
  suggested_action?: unknown; // Plan 스냅샷 (SuggestedActionChatOpsPlanV1)
  metadata?: unknown | null;
}

/**
 * TaskCard 생성 옵션
 */
export interface CreateTaskCardFromPlanOptions {
  tenant_id: string;
  plan: SuggestedActionChatOpsPlanV1;
  priority: number; // 0-100, Policy에서 조회 필수
  expires_at: string; // ISO 8601 timestamptz
  title?: string;
  description?: string;
  action_url?: string;
  // entity_id는 Plan의 targets에서 추출 (대량 작업의 경우 첫 번째 대상 사용)
  // 또는 entity_type='tenant'인 경우 tenant_id 사용
  entity_id?: string; // 선택적, 없으면 Plan의 targets에서 추출
  // window는 Intent Registry의 taskcard.window 사용
  // now_kst는 envelope.server_context.now_kst 사용
  now_kst: string; // ISO 8601 또는 YYYY-MM-DD 형식
}

/**
 * window 형식에 따라 window 값 생성
 * 챗봇.md 4.2.2 참조
 */
function formatWindow(
  windowType: 'YYYY-MM-DD' | 'YYYY-MM' | 'session_id' | 'iso_hour' | 'batch',
  nowKst: string
): string {
  const dateKst = toKST(new Date(nowKst));

  switch (windowType) {
    case 'YYYY-MM-DD':
      // KST 기준 YYYY-MM-DD 형식
      return dateKst.format('YYYY-MM-DD');
    case 'YYYY-MM':
      // KST 기준 YYYY-MM 형식
      return dateKst.format('YYYY-MM');
    case 'session_id':
      // session_id는 별도로 제공되어야 함 (현재는 nowKst 기반으로 생성)
      // 실제 구현 시 session_id를 별도로 받아야 할 수 있음
      return `session_${dateKst.valueOf()}`;
    case 'iso_hour':
      // ISO 8601 hour 형식 (YYYY-MM-DDTHH, KST 기준)
      return dateKst.format('YYYY-MM-DDTHH');
    case 'batch':
      // 배치 단위는 YYYY-MM-DD 형식 사용 (KST 기준)
      return dateKst.format('YYYY-MM-DD');
    default:
      // 기본값: YYYY-MM-DD (KST 기준)
      return dateKst.format('YYYY-MM-DD');
  }
}

/**
 * dedup_key 생성
 * 챗봇.md 4.2 참조
 * 정본 포맷: "{tenantId}:{trigger}:{entityType}:{entityId}:{window}"
 */
function generateDedupKey(
  tenantId: string,
  trigger: string,
  entityType: string,
  entityId: string,
  window: string
): string {
  // entityType='tenant'일 때 dedup_key의 entityId 세그먼트는 'global' 사용
  // 챗봇.md 4.2.3 참조
  const dedupEntityId = entityType === 'tenant' ? 'global' : entityId;

  return `${tenantId}:${trigger}:${entityType}:${dedupEntityId}:${window}`;
}

/**
 * Plan에서 TaskCard 입력 데이터 생성
 * 챗봇.md 6.2 참조
 *
 * [불변 규칙] L0 Intent는 TaskCard 생성 불가
 * [불변 규칙] L1/L2 Intent만 TaskCard 생성 가능
 * [불변 규칙] priority는 Policy에서 조회 필수 (Fail-Closed)
 *
 * @param options TaskCard 생성 옵션
 * @returns TaskCard 입력 데이터
 */
export function createTaskCardFromPlan(
  options: CreateTaskCardFromPlanOptions
): TaskCardInput {
  const { tenant_id, plan, priority, expires_at, now_kst, entity_id } = options;

  // Intent Registry에서 Intent 정보 조회
  const intent = getIntent(plan.intent_key);
  if (!intent) {
    throw new Error(`Intent not found: ${plan.intent_key}`);
  }

  // L0 Intent는 TaskCard 생성 불가
  // 챗봇.md 6.1 참조: L0는 조회/초안/추천만 수행, TaskCard 생성 없음
  if (intent.automation_level === 'L0') {
    throw new Error(`L0 Intent does not create TaskCard: ${plan.intent_key}`);
  }

  // L1/L2 Intent만 TaskCard 생성 가능
  // 챗봇.md 6.2, 6.3 참조: L1은 업무화(TaskCard 생성), L2는 승인 후 실행
  if (intent.automation_level !== 'L1' && intent.automation_level !== 'L2') {
    throw new Error(
      `Invalid automation_level for TaskCard creation: ${intent.automation_level} (expected L1 or L2)`
    );
  }

  // priority 검증 (Fail-Closed)
  // 정본 규칙: priority는 Policy에서 조회하고 없으면 생성하지 않음 (Fail-Closed)
  // create-task-card-with-dedup.ts 참조: priority는 Policy에서 조회 필수
  if (priority === undefined || priority === null) {
    throw new Error(
      `priority is required (must be retrieved from Policy): intent=${plan.intent_key}`
    );
  }

  // priority 범위 검증 (0-100)
  if (typeof priority !== 'number' || !Number.isFinite(priority)) {
    throw new Error(
      `priority must be a finite number (0-100): intent=${plan.intent_key}, priority=${priority}`
    );
  }

  if (priority < 0 || priority > 100) {
    throw new Error(
      `priority must be between 0 and 100: intent=${plan.intent_key}, priority=${priority}`
    );
  }

  // entity_id 결정 (챗봇.md 4.2.3 참조)
  // 우선순위:
  // 1. options에서 제공된 경우 사용 (명시적 지정)
  // 2. entity_type='tenant'인 경우 tenant_id 사용 (챗봇.md 4.2.3: TaskCard.entity_id는 UUID)
  // 3. Plan의 targets에서 첫 번째 대상 사용 (대량 작업의 경우)
  // 중요: entity_type='tenant'일 때 TaskCard.entity_id는 tenant_id(UUID) 저장
  // 중요: dedup_key 내부의 entityId 세그먼트는 별도로 'global' 사용 (generateDedupKey에서 처리)
  let finalEntityId: string;
  let finalEntityType: string = intent.taskcard.entity_type;

  if (entity_id) {
    // 명시적으로 제공된 경우 우선 사용
    finalEntityId = entity_id;
  } else if (finalEntityType === 'tenant') {
    // entity_type='tenant'일 때 entity_id는 tenant_id(UUID) 사용
    // 챗봇.md 4.2.3: TaskCard 컬럼은 UUID 타입이므로 tenantId(UUID) 저장
    finalEntityId = tenant_id;
  } else if (
    plan.plan_snapshot.targets.kind === 'student_id_list' &&
    Array.isArray(plan.plan_snapshot.targets.student_ids) &&
    plan.plan_snapshot.targets.student_ids.length > 0
  ) {
    // 대량 작업의 경우 첫 번째 대상 사용
    // 챗봇.md 4.2: 대량 작업은 첫 번째 대상으로 TaskCard 생성
    // 타입 안정성: 배열인지 확인 후 접근
    const firstStudentId = plan.plan_snapshot.targets.student_ids[0];
    if (typeof firstStudentId !== 'string') {
      throw new Error(
        `Invalid student_id type in plan targets: intent=${plan.intent_key}, expected string, got ${typeof firstStudentId}`
      );
    }
    finalEntityId = firstStudentId;
  } else {
    throw new Error(
      `Cannot determine entity_id for TaskCard: intent=${plan.intent_key}, entity_type=${finalEntityType}`
    );
  }

  // student_id 결정 (레거시 호환)
  // 챗봇.md 4.2.4, 마이그레이션 126 참조: entity_type='student'일 때만 student_id=entity_id
  // entity_type이 'tenant', 'billing', 'report', 'system' 등일 때는 student_id=NULL
  const studentId =
    finalEntityType === 'student' ? finalEntityId : null;

  // window 형식에 따라 window 값 생성
  // 챗봇.md 4.2.2 참조: window는 task_type/entity_type에 따라 결정
  const window = formatWindow(intent.taskcard.window, now_kst);

  // dedup_key 생성 (챗봇.md 4.2 참조)
  // 정본 포맷: "{tenantId}:{trigger}:{entityType}:{entityId}:{window}"
  // 중요: entityType='tenant'일 때 dedup_key의 entityId 세그먼트는 'global' 사용
  // generateDedupKey 함수 내부에서 자동 처리됨
  const dedupKey = generateDedupKey(
    tenant_id,
    intent.taskcard.trigger,
    finalEntityType,
    finalEntityId,
    window
  );

  // title 및 description 생성
  // 기본값: Intent 설명 + 대상 수 또는 Plan 요약
  const title =
    options.title ||
    `${intent.description} (${plan.plan_snapshot.target_count}명)`;
  const description =
    options.description || plan.plan_snapshot.summary;

  // action_url 생성 (기본값: task_type에 따라 결정)
  // 주의: 실제 구현 시 업종별 라우팅 필요 (업종 중립 규칙 준수)
  // 챗봇.md 3.1: 업종별 차이는 prop을 통한 확장 포인트로 처리
  const actionUrl =
    options.action_url ||
    (finalEntityType === 'student'
      ? `/students/${finalEntityId}/tasks`
      : `/tasks/${dedupKey}`);

  // TaskCard 입력 데이터 생성
  // 챗봇.md 4.3 참조: Plan 스냅샷은 suggested_action에 저장
  const taskCard: TaskCardInput = {
    tenant_id,
    entity_id: finalEntityId, // UUID (entity_type='tenant'일 때는 tenant_id)
    entity_type: finalEntityType,
    student_id: studentId, // 레거시 호환: entity_type='student'일 때만 채움
    task_type: intent.taskcard.task_type, // SSOT 허용 집합 사용
    source: 'chatops', // ChatOps에서 생성된 TaskCard
    priority, // Policy에서 조회한 값 (0-100)
    title,
    description,
    action_url: actionUrl,
    expires_at, // ISO 8601 timestamptz
    dedup_key: dedupKey, // 정본 포맷: "{tenantId}:{trigger}:{entityType}:{entityId}:{window}"
    status: 'pending', // 기본 상태: pending
    suggested_action: plan, // Plan 스냅샷 저장 (챗봇.md 4.3 참조)
    metadata: null,
  };

  return taskCard;
}

