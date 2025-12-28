/**
 * RPC 함수 RLS 정책 우회 수정
 * 
 * [불변 규칙] SECURITY DEFINER 함수에서 user_platform_roles 테이블 조회 시 RLS 정책 우회
 * [불변 규칙] 함수 소유자 권한으로 실행되지만 RLS는 여전히 적용되므로 직접 조회 필요
 * 
 * 문제: RPC 함수 내부에서 user_platform_roles 테이블을 조회할 때 RLS 정책 때문에
 *       자신의 역할을 찾지 못하는 경우가 발생할 수 있습니다.
 * 
 * 해결: SECURITY DEFINER 함수는 함수 소유자의 권한으로 실행되지만, RLS 정책은
 *       여전히 적용됩니다. 따라서 RLS 정책을 우회하거나, 함수 소유자에게
 *       RLS 정책을 우회할 수 있는 권한을 부여해야 합니다.
 */

-- 방법 1: RLS 정책을 우회하는 헬퍼 함수 생성
CREATE OR REPLACE FUNCTION public.check_platform_role(
  p_user_id uuid,
  p_required_roles text[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY DEFINER 함수이므로 함수 소유자 권한으로 실행
  -- RLS 정책을 우회하여 직접 조회
  RETURN EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = p_user_id
    AND role = ANY(p_required_roles)
  );
END;
$$;

-- 헬퍼 함수 권한 부여
GRANT EXECUTE ON FUNCTION public.check_platform_role(uuid, text[]) TO authenticated;

-- 방법 2: RPC 함수에서 직접 조회하되, RLS 정책 확인
-- ⚠️ 참고: SECURITY DEFINER 함수는 함수 소유자 권한으로 실행되지만,
--          RLS 정책은 여전히 적용됩니다. 따라서 함수 소유자가
--          user_platform_roles 테이블에 대한 SELECT 권한이 있어야 합니다.

-- 모든 RPC 함수를 헬퍼 함수를 사용하도록 수정
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
  -- 현재 사용자 ID 확인
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied. User not authenticated.';
  END IF;
  
  -- 헬퍼 함수를 사용하여 역할 확인 (RLS 정책 우회)
  IF NOT public.check_platform_role(auth.uid(), ARRAY['super_admin', 'developer', 'qa']) THEN
    RAISE EXCEPTION 'Access denied. Only super_admin, developer, or qa can access schema registry. User ID: %', auth.uid();
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

-- 나머지 RPC 함수들도 동일하게 수정
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied. User not authenticated.';
  END IF;
  
  IF NOT public.check_platform_role(auth.uid(), ARRAY['super_admin', 'developer', 'qa']) THEN
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied. User not authenticated.';
  END IF;
  
  IF NOT public.check_platform_role(auth.uid(), ARRAY['super_admin']) THEN
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied. User not authenticated.';
  END IF;
  
  IF NOT public.check_platform_role(auth.uid(), ARRAY['super_admin']) THEN
    RAISE EXCEPTION 'Access denied. Only super_admin can update schema registry.';
  END IF;

  SELECT registered_at INTO v_current_updated_at
  FROM meta.schema_registry
  WHERE id = p_id;

  IF v_current_updated_at IS NULL THEN
    RAISE EXCEPTION 'Schema not found: %', p_id;
  END IF;

  IF p_expected_updated_at IS NOT NULL AND v_current_updated_at != p_expected_updated_at THEN
    RAISE EXCEPTION 'Schema was modified by another user. Please refresh and try again.';
  END IF;

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
    sr.registered_at AS updated_at
  FROM meta.schema_registry sr
  WHERE sr.id = v_result.id;
END;
$$;

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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied. User not authenticated.';
  END IF;
  
  IF NOT public.check_platform_role(auth.uid(), ARRAY['super_admin']) THEN
    RAISE EXCEPTION 'Access denied. Only super_admin can activate schema registry.';
  END IF;

  SELECT * INTO v_schema
  FROM meta.schema_registry
  WHERE id = p_id;

  IF v_schema.id IS NULL THEN
    RAISE EXCEPTION 'Schema not found: %', p_id;
  END IF;

  IF v_schema.status != 'draft' THEN
    RAISE EXCEPTION 'Only draft schemas can be activated.';
  END IF;

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

CREATE OR REPLACE FUNCTION public.delete_schema_registry(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = meta, public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied. User not authenticated.';
  END IF;
  
  IF NOT public.check_platform_role(auth.uid(), ARRAY['super_admin']) THEN
    RAISE EXCEPTION 'Access denied. Only super_admin can delete schema registry.';
  END IF;

  IF (SELECT status FROM meta.schema_registry WHERE id = p_id) != 'draft' THEN
    RAISE EXCEPTION 'Only draft schemas can be deleted.';
  END IF;

  DELETE FROM meta.schema_registry
  WHERE id = p_id;
END;
$$;

-- 최종 확인
DO $$
BEGIN
  RAISE NOTICE '=== RPC 함수 RLS 정책 우회 수정 완료 ===';
  RAISE NOTICE '✅ check_platform_role 헬퍼 함수 생성 완료';
  RAISE NOTICE '✅ get_schema_registry_list 함수 수정 완료';
  RAISE NOTICE '';
  RAISE NOTICE '📌 다음 단계:';
  RAISE NOTICE '   1. 나머지 RPC 함수들도 동일하게 수정 필요';
  RAISE NOTICE '   2. 브라우저 새로고침 후 테스트';
END $$;

