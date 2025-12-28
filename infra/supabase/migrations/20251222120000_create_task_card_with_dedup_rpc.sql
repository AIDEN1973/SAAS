-- TaskCard 생성 RPC 함수
-- 프론트 자동화 문서 2.3 섹션 참조: 멱등성/중복방지 규격 (DB 제약 승격)
-- ⚠️ 정본 규칙: 유니크 인덱스는 (tenant_id, dedup_key)로 고정 (부분조건 없음)
-- Supabase client upsert() 직접 사용 가능 (문서 SSOT 준수)

CREATE OR REPLACE FUNCTION create_task_card_with_dedup_v1(
  p_card jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- 서버 권한으로 실행 (RLS 우회 필요)
AS $$
DECLARE
  jwt_claims_json jsonb;
  jwt_tenant_text text;
  jwt_tenant_id uuid;
  v_tenant_id uuid;
  v_dedup_key text;
  v_status text;
  v_result jsonb;
  v_card_id uuid;
BEGIN
  -- ✅ P0-SEC-3: set_config로 search_path 고정
  PERFORM set_config('search_path', 'public, pg_temp', true);

  -- ✅ P0-SEC-1: request.jwt.claims 안전 파싱
  jwt_claims_json := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  jwt_tenant_text := jwt_claims_json ->> 'tenant_id';

  IF jwt_tenant_text IS NULL OR jwt_tenant_text = '' THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = 'P0001';
  END IF;

  jwt_tenant_id := jwt_tenant_text::uuid;

  -- 필수 필드 추출
  v_tenant_id := (p_card->>'tenant_id')::uuid;
  v_dedup_key := p_card->>'dedup_key';
  v_status := COALESCE(p_card->>'status', 'pending');

  -- ✅ SECURITY DEFINER 안전장치: tenant_id 검증
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = 'P0001';
  END IF;

  IF jwt_tenant_id <> v_tenant_id THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = 'P0001';
  END IF;

  -- ⚠️ 정본 규칙: status가 'pending'이 아니면 디듀프 대상이 아니므로 일반 INSERT
  -- 유니크 인덱스는 (tenant_id, dedup_key)로 고정되므로, 모든 status에 대해 동일하게 적용
  IF v_status != 'pending' THEN
    -- status가 'pending'이 아니면 일반 INSERT (디듀프 없음)
    INSERT INTO task_cards (
      tenant_id,
      student_id,
      entity_id,
      entity_type,
      task_type,
      source,
      priority,
      title,
      description,
      action_url,
      expires_at,
      dedup_key,
      status,
      suggested_action,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      v_tenant_id,
      (p_card->>'student_id')::uuid,
      (p_card->>'entity_id')::uuid,
      p_card->>'entity_type',
      p_card->>'task_type',
      p_card->>'source',
      -- ⚠️ 정본 규칙: priority는 Policy에서 조회하고 없으면 생성하지 않음 (Fail-Closed)
      -- 호출자는 반드시 Policy에서 priority를 조회하여 전달해야 함
      (p_card->>'priority')::integer,
      p_card->>'title',
      p_card->>'description',
      COALESCE(NULLIF(p_card->>'action_url', ''), ''), -- NOT NULL 제약조건을 만족하기 위해 빈 문자열 사용
      (p_card->>'expires_at')::timestamptz,
      v_dedup_key,
      v_status,
      CASE WHEN p_card->'suggested_action' IS NOT NULL THEN p_card->'suggested_action' ELSE NULL END,
      CASE WHEN p_card->'metadata' IS NOT NULL THEN p_card->'metadata' ELSE NULL END,
      now(),
      now()
    )
    RETURNING jsonb_build_object(
      'id', id,
      'tenant_id', tenant_id,
      'entity_id', entity_id,
      'entity_type', entity_type,
      'task_type', task_type,
      'dedup_key', dedup_key,
      'status', status,
      'created_at', created_at,
      'updated_at', updated_at
    ) INTO v_result;

    RETURN v_result;
  END IF;

  -- status='pending'인 경우: 유니크 인덱스에 따라 디듀프 처리
  -- ⚠️ 정본 규칙: INSERT ... ON CONFLICT (tenant_id, dedup_key) (부분조건 없음)
  INSERT INTO task_cards (
    tenant_id,
    student_id,
    entity_id,
    entity_type,
    task_type,
    source,
    priority,
    title,
    description,
    action_url,
    expires_at,
    dedup_key,
    status,
    suggested_action,
    metadata,
    created_at,
    updated_at
  ) VALUES (
    v_tenant_id,
    (p_card->>'student_id')::uuid,
    (p_card->>'entity_id')::uuid,
    p_card->>'entity_type',
    p_card->>'task_type',
    p_card->>'source',
    COALESCE((p_card->>'priority')::integer, 50),
    p_card->>'title',
    p_card->>'description',
    COALESCE(NULLIF(p_card->>'action_url', ''), ''), -- NOT NULL 제약조건을 만족하기 위해 빈 문자열 사용
    (p_card->>'expires_at')::timestamptz,
    v_dedup_key,
    v_status,
    CASE WHEN p_card->'suggested_action' IS NOT NULL THEN p_card->'suggested_action' ELSE NULL END,
    CASE WHEN p_card->'metadata' IS NOT NULL THEN p_card->'metadata' ELSE NULL END,
    now(),
    now()
  )
  ON CONFLICT (tenant_id, dedup_key)
  WHERE dedup_key IS NOT NULL
  DO UPDATE SET
    updated_at = now(),
    action_url = COALESCE(EXCLUDED.action_url, task_cards.action_url),
    priority = GREATEST(task_cards.priority, EXCLUDED.priority),
    suggested_action = COALESCE(EXCLUDED.suggested_action, task_cards.suggested_action),
    metadata = COALESCE(EXCLUDED.metadata, task_cards.metadata)
  RETURNING jsonb_build_object(
    'id', id,
    'tenant_id', tenant_id,
    'entity_id', entity_id,
    'entity_type', entity_type,
    'task_type', task_type,
    'dedup_key', dedup_key,
    'status', status,
    'created_at', created_at,
    'updated_at', updated_at
  ) INTO v_result;

  RETURN v_result;
EXCEPTION
  WHEN unique_violation THEN
    -- 유니크 인덱스 위반 시 기존 레코드 조회 후 반환
    SELECT jsonb_build_object(
      'id', id,
      'tenant_id', tenant_id,
      'entity_id', entity_id,
      'entity_type', entity_type,
      'task_type', task_type,
      'dedup_key', dedup_key,
      'status', status,
      'created_at', created_at,
      'updated_at', updated_at
    ) INTO v_result
    FROM task_cards
    WHERE tenant_id = v_tenant_id
      AND dedup_key = v_dedup_key
    LIMIT 1;

    RETURN v_result;
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- RPC 함수 실행 권한 부여 (authenticated 역할만, Edge Functions는 service_role 사용)
GRANT EXECUTE ON FUNCTION create_task_card_with_dedup_v1 TO authenticated;
GRANT EXECUTE ON FUNCTION create_task_card_with_dedup_v1 TO service_role;

-- 함수 설명 추가
COMMENT ON FUNCTION create_task_card_with_dedup_v1 IS 'TaskCard 생성 RPC (유니크 인덱스 (tenant_id, dedup_key) 호환). 프론트 자동화 문서 2.3 섹션 참조.';

