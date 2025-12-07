/**
 * Schema Registry RPC 함수 수정
 * 
 * [불변 규칙] ORDER BY 절에서 created_at 대신 registered_at 사용
 * [불변 규칙] industry_type NULL 비교 로직 개선
 */

-- get_schema_registry_list 함수 수정
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
  WHERE (p_entity IS NULL OR sr.entity = p_entity)
    AND (
      (p_industry_type IS NULL AND sr.industry_type IS NULL)
      OR (p_industry_type IS NOT NULL AND sr.industry_type IS NOT NULL AND sr.industry_type = p_industry_type)
    )
    AND (p_status IS NULL OR sr.status = p_status)
  ORDER BY sr.registered_at DESC;
END;
$$;

