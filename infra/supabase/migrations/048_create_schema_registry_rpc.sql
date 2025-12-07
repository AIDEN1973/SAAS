/**
 * Schema Registry RPC 함수 생성
 * 
 * [불변 규칙] PostgREST가 meta 스키마를 노출하지 않는 경우를 대비한 RPC 함수
 * [불변 규칙] Supabase JS 클라이언트의 from()은 public 스키마만 지원하므로 RPC 사용
 * 
 * 기술문서: docu/스키마엔진.txt 4. Schema Registry (DB + RLS)
 */

-- 1. 스키마 목록 조회 RPC
CREATE OR REPLACE FUNCTION public.get_schema_registry_list(
  p_entity text DEFAULT NULL,
  p_industry_type text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  entity text,
  industry_type text,
  version text,
  min_supported_client text,
  min_client text,
  schema_json jsonb,
  migration_script text,
  status text,
  registered_by uuid,
  registered_at timestamptz,
  activated_at timestamptz,
  deprecated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = meta, public
AS $$
BEGIN
  -- RLS 정책 검증: user_platform_roles 확인
  -- ⚠️ 중요: SECURITY DEFINER 함수는 함수 소유자의 권한으로 실행되지만,
  -- RLS 정책은 여전히 적용됩니다. 따라서 직접 조회하거나 권한을 우회해야 합니다.
  -- 현재 사용자 ID 확인
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied. User not authenticated.';
  END IF;
  
  -- user_platform_roles 테이블에서 역할 확인 (RLS 정책 우회)
  -- SECURITY DEFINER 함수이므로 함수 소유자(postgres)의 권한으로 실행되지만,
  -- RLS 정책은 여전히 적용되므로 직접 조회합니다.
  IF NOT EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'developer', 'qa')
  ) THEN
    RAISE EXCEPTION 'Access denied. Only super_admin, developer, or qa can access schema registry. Current user: %', auth.uid();
  END IF;

  RETURN QUERY
  SELECT 
    sr.id,
    sr.entity,
    sr.industry_type,
    sr.version,
    sr.min_supported_client,
    sr.min_client,
    sr.schema_json,
    sr.migration_script,
    sr.status,
    sr.registered_by,
    sr.registered_at,
    sr.activated_at,
    sr.deprecated_at
  FROM meta.schema_registry sr
  WHERE (p_entity IS NULL OR sr.entity = p_entity)
    AND (
      (p_industry_type IS NULL AND sr.industry_type IS NULL)
      OR (p_industry_type IS NOT NULL AND sr.industry_type IS NOT NULL AND sr.industry_type = p_industry_type)
    )
    AND (p_status IS NULL OR sr.status = p_status)
  ORDER BY sr.registered_at DESC;
END;
$$;

-- 2. 스키마 단일 조회 RPC
CREATE OR REPLACE FUNCTION public.get_schema_registry(p_id uuid)
RETURNS TABLE (
  id uuid,
  entity text,
  industry_type text,
  version text,
  min_supported_client text,
  min_client text,
  schema_json jsonb,
  migration_script text,
  status text,
  registered_by uuid,
  registered_at timestamptz,
  activated_at timestamptz,
  deprecated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = meta, public
AS $$
BEGIN
  -- RLS 정책 검증
  IF NOT EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'developer', 'qa')
  ) THEN
    RAISE EXCEPTION 'Access denied. Only super_admin, developer, or qa can access schema registry.';
  END IF;

  RETURN QUERY
  SELECT 
    sr.id,
    sr.entity,
    sr.industry_type,
    sr.version,
    sr.min_supported_client,
    sr.min_client,
    sr.schema_json,
    sr.migration_script,
    sr.status,
    sr.registered_by,
    sr.registered_at,
    sr.activated_at,
    sr.deprecated_at
  FROM meta.schema_registry sr
  WHERE sr.id = p_id;
END;
$$;

-- 3. 스키마 생성 RPC
CREATE OR REPLACE FUNCTION public.create_schema_registry(
  p_entity text,
  p_industry_type text,
  p_version text,
  p_min_supported_client text,
  p_min_client text,
  p_schema_json jsonb,
  p_migration_script text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  entity text,
  industry_type text,
  version text,
  min_supported_client text,
  min_client text,
  schema_json jsonb,
  migration_script text,
  status text,
  registered_by uuid,
  registered_at timestamptz,
  activated_at timestamptz,
  deprecated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = meta, public
AS $$
DECLARE
  v_result meta.schema_registry;
BEGIN
  -- RLS 정책 검증: Super Admin만 생성 가능
  IF NOT EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Only super_admin can create schema registry.';
  END IF;

  INSERT INTO meta.schema_registry (
    entity,
    industry_type,
    version,
    min_supported_client,
    min_client,
    schema_json,
    migration_script,
    status,
    registered_by
  ) VALUES (
    p_entity,
    p_industry_type,
    p_version,
    p_min_supported_client,
    p_min_client,
    p_schema_json,
    p_migration_script,
    'draft',
    auth.uid()
  )
  RETURNING * INTO v_result;

  RETURN QUERY SELECT * FROM meta.schema_registry WHERE id = v_result.id;
END;
$$;

-- 4. 스키마 업데이트 RPC
CREATE OR REPLACE FUNCTION public.update_schema_registry(
  p_id uuid,
  p_schema_json jsonb,
  p_migration_script text DEFAULT NULL,
  p_min_supported_client text DEFAULT NULL,
  p_min_client text DEFAULT NULL,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  entity text,
  industry_type text,
  version text,
  min_supported_client text,
  min_client text,
  schema_json jsonb,
  migration_script text,
  status text,
  registered_by uuid,
  registered_at timestamptz,
  activated_at timestamptz,
  deprecated_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = meta, public
AS $$
DECLARE
  v_current_updated_at timestamptz;
  v_result meta.schema_registry;
BEGIN
  -- RLS 정책 검증: Super Admin만 업데이트 가능
  IF NOT EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Only super_admin can update schema registry.';
  END IF;

  -- Optimistic Locking: updated_at 확인
  SELECT updated_at INTO v_current_updated_at
  FROM meta.schema_registry
  WHERE id = p_id;

  IF v_current_updated_at IS NULL THEN
    RAISE EXCEPTION 'Schema not found: %', p_id;
  END IF;

  IF p_expected_updated_at IS NOT NULL AND v_current_updated_at != p_expected_updated_at THEN
    RAISE EXCEPTION 'Schema was modified by another user. Please refresh and try again.';
  END IF;

  -- draft 상태만 업데이트 가능
  IF (SELECT status FROM meta.schema_registry WHERE id = p_id) != 'draft' THEN
    RAISE EXCEPTION 'Only draft schemas can be updated.';
  END IF;

  UPDATE meta.schema_registry
  SET 
    schema_json = p_schema_json,
    migration_script = COALESCE(p_migration_script, migration_script),
    min_supported_client = COALESCE(p_min_supported_client, min_supported_client),
    min_client = COALESCE(p_min_client, min_client)
  WHERE id = p_id
  RETURNING * INTO v_result;

  RETURN QUERY 
  SELECT 
    sr.id,
    sr.entity,
    sr.industry_type,
    sr.version,
    sr.min_supported_client,
    sr.min_client,
    sr.schema_json,
    sr.migration_script,
    sr.status,
    sr.registered_by,
    sr.registered_at,
    sr.activated_at,
    sr.deprecated_at,
    sr.registered_at AS updated_at  -- 하위 호환성
  FROM meta.schema_registry sr
  WHERE sr.id = v_result.id;
END;
$$;

-- 5. 스키마 활성화 RPC
CREATE OR REPLACE FUNCTION public.activate_schema_registry(p_id uuid)
RETURNS TABLE (
  id uuid,
  entity text,
  industry_type text,
  version text,
  status text,
  activated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = meta, public
AS $$
DECLARE
  v_schema meta.schema_registry;
BEGIN
  -- RLS 정책 검증: Super Admin만 활성화 가능
  IF NOT EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Only super_admin can activate schema registry.';
  END IF;

  -- 스키마 조회
  SELECT * INTO v_schema
  FROM meta.schema_registry
  WHERE id = p_id;

  IF v_schema.id IS NULL THEN
    RAISE EXCEPTION 'Schema not found: %', p_id;
  END IF;

  -- draft 상태만 활성화 가능
  IF v_schema.status != 'draft' THEN
    RAISE EXCEPTION 'Only draft schemas can be activated.';
  END IF;

  -- 기존 active 스키마를 deprecated로 변경
  UPDATE meta.schema_registry
  SET 
    status = 'deprecated',
    deprecated_at = now()
  WHERE entity = v_schema.entity
    AND (
      (industry_type IS NULL AND v_schema.industry_type IS NULL)
      OR (industry_type IS NOT NULL AND v_schema.industry_type IS NOT NULL AND industry_type = v_schema.industry_type)
    )
    AND status = 'active';

  -- 현재 스키마를 active로 변경
  UPDATE meta.schema_registry
  SET 
    status = 'active',
    activated_at = now()
  WHERE id = p_id;

  RETURN QUERY
  SELECT 
    sr.id,
    sr.entity,
    sr.industry_type,
    sr.version,
    sr.status,
    sr.activated_at
  FROM meta.schema_registry sr
  WHERE sr.id = p_id;
END;
$$;

-- 6. 스키마 삭제 RPC
CREATE OR REPLACE FUNCTION public.delete_schema_registry(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = meta, public
AS $$
BEGIN
  -- RLS 정책 검증: Super Admin만 삭제 가능
  IF NOT EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Only super_admin can delete schema registry.';
  END IF;

  -- draft 상태만 삭제 가능
  IF (SELECT status FROM meta.schema_registry WHERE id = p_id) != 'draft' THEN
    RAISE EXCEPTION 'Only draft schemas can be deleted.';
  END IF;

  DELETE FROM meta.schema_registry
  WHERE id = p_id;
END;
$$;

-- RPC 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION public.get_schema_registry_list(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_schema_registry(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_schema_registry(text, text, text, text, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_schema_registry(uuid, jsonb, text, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_schema_registry(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_schema_registry(uuid) TO authenticated;

-- 주석 추가
COMMENT ON FUNCTION public.get_schema_registry_list IS 'Schema Registry 목록 조회 (super_admin, developer, qa만 접근 가능)';
COMMENT ON FUNCTION public.get_schema_registry IS 'Schema Registry 단일 조회 (super_admin, developer, qa만 접근 가능)';
COMMENT ON FUNCTION public.create_schema_registry IS 'Schema Registry 생성 (super_admin만 접근 가능)';
COMMENT ON FUNCTION public.update_schema_registry IS 'Schema Registry 업데이트 (super_admin만 접근 가능, Optimistic Locking 지원)';
COMMENT ON FUNCTION public.activate_schema_registry IS 'Schema Registry 활성화 (super_admin만 접근 가능)';
COMMENT ON FUNCTION public.delete_schema_registry IS 'Schema Registry 삭제 (super_admin만 접근 가능, draft만 삭제 가능)';

