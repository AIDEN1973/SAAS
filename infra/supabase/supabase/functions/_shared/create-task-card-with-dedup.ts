/**
 * TaskCard 생성 유틸리티
 *
 * [불변 규칙] 유니크 인덱스 (tenant_id, dedup_key)로 고정 (부분조건 없음)
 * [불변 규칙] Supabase client upsert() 직접 사용 가능 (문서 SSOT 준수)
 * [문서 준수] docu/프론트 자동화.md 2.3 섹션 엄격 준수
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * TaskCard 생성 입력 타입 (SSOT)
 */
export interface CreateTaskCardInput {
  tenant_id: string;
  student_id?: string;
  entity_id: string;
  entity_type: string;
  task_type: string;
  source?: string;
  priority?: number;
  title: string;
  description?: string;
  action_url?: string;
  expires_at: string;
  dedup_key?: string;
  status?: 'pending' | 'approved' | 'executed' | 'expired';
  suggested_action?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * TaskCard 생성 결과 타입
 */
export interface CreateTaskCardResult {
  id: string;
  tenant_id: string;
  entity_id: string;
  entity_type: string;
  task_type: string;
  dedup_key?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * TaskCard 생성
 *
 * ⚠️ 정본 규칙: 유니크 인덱스 (tenant_id, dedup_key)로 고정
 * 이 함수는 RPC 함수 create_task_card_with_dedup_v1을 호출합니다.
 *
 * @param supabase Supabase 클라이언트
 * @param card TaskCard 생성 입력 데이터
 * @returns 생성/업데이트된 TaskCard 또는 null (에러 시)
 */
export async function createTaskCardWithDedup(
  supabase: SupabaseClient,
  card: CreateTaskCardInput
): Promise<CreateTaskCardResult | null> {
  // ⚠️ 정본 규칙: priority는 Policy에서 조회하고 없으면 생성하지 않음 (Fail-Closed)
  // 호출자는 반드시 Policy에서 priority를 조회하여 전달해야 함
  if (card.priority === undefined || card.priority === null) {
    console.error('[createTaskCardWithDedup] priority is required (must be retrieved from Policy)');
    return null;
  }

  // 입력 데이터를 jsonb로 변환
  // ⚠️ 중요: action_url은 NOT NULL 제약조건이 있으므로 null 대신 빈 문자열 사용
  const cardJsonb = {
    tenant_id: card.tenant_id,
    student_id: card.student_id || null,
    entity_id: card.entity_id,
    entity_type: card.entity_type,
    task_type: card.task_type,
    source: card.source || null,
    priority: card.priority,
    title: card.title,
    description: card.description || null,
    action_url: card.action_url || '', // NOT NULL 제약조건을 만족하기 위해 빈 문자열 사용
    expires_at: card.expires_at,
    dedup_key: card.dedup_key || null,
    status: card.status || 'pending',
    suggested_action: card.suggested_action || null,
    metadata: card.metadata || null,
  };

  // RPC 함수 호출
  const { data, error } = await supabase.rpc('create_task_card_with_dedup_v1', {
    p_card: cardJsonb,
  });

  if (error) {
    console.error(`[createTaskCardWithDedup] Failed to create task card:`, error);
    return null;
  }

  if (!data) {
    return null;
  }

  // 반환값 타입 변환
  return data as CreateTaskCardResult;
}

/**
 * TaskCard 일괄 생성 (배치 처리)
 *
 * ⚠️ 정본 규칙: 과도한 동시성 금지, 5~10개 단위 배치 처리
 *
 * @param supabase Supabase 클라이언트
 * @param cards TaskCard 생성 입력 데이터 배열
 * @param batchSize 배치 크기 (기본값: 5)
 * @returns 생성/업데이트된 TaskCard 배열
 */
export async function createTaskCardsWithDedupBatch(
  supabase: SupabaseClient,
  cards: CreateTaskCardInput[],
  batchSize: number = 5
): Promise<CreateTaskCardResult[]> {
  const results: CreateTaskCardResult[] = [];

  // 배치 단위로 처리
  for (let i = 0; i < cards.length; i += batchSize) {
    const batch = cards.slice(i, i + batchSize);

    // 병렬 처리 (배치 내)
    const batchResults = await Promise.all(
      batch.map((card) => createTaskCardWithDedup(supabase, card))
    );

    // null 제거 후 결과 추가
    const validResults = batchResults.filter(
      (result): result is CreateTaskCardResult => result !== null
    );
    results.push(...validResults);
  }

  return results;
}

