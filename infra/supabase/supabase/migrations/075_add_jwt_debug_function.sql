-- JWT 디버깅 함수
-- [목적] 현재 사용자의 JWT claims를 확인하는 함수

-- 1. JWT claims 확인 함수
CREATE OR REPLACE FUNCTION public.debug_current_jwt()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  result := jsonb_build_object(
    'user_id', auth.uid()::text,
    'jwt_claims', auth.jwt(),
    'tenant_id_from_jwt', (auth.jwt() ->> 'tenant_id')::text,
    'tenant_role_from_jwt', (auth.jwt() ->> 'tenant_role')::text,
    'user_tenant_roles', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          tenant_id::text,
          role,
          updated_at
        FROM public.user_tenant_roles
        WHERE user_id = auth.uid()
        ORDER BY updated_at DESC, created_at ASC
      ) t
    )
  );

  RETURN result;
END;
$$;

-- 2. 권한 부여
GRANT EXECUTE ON FUNCTION public.debug_current_jwt() TO authenticated;

-- 3. 사용 예시
-- SELECT public.debug_current_jwt();

-- 4. RLS 정책 확인 함수
CREATE OR REPLACE FUNCTION public.debug_rls_policy(p_table_name text)
RETURNS TABLE (
  policyname text,
  cmd text,
  policy_type text,
  using_expression text,
  with_check_expression text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pp.policyname,
    pp.cmd,
    CASE
      WHEN pp.using_expression LIKE '%auth.jwt()%' THEN 'JWT claim 기반'
      WHEN pp.using_expression LIKE '%user_tenant_roles%' THEN 'user_tenant_roles 기반'
      ELSE '기타'
    END AS policy_type,
    pp.using_expression,
    pp.with_check_expression
  FROM pg_policies pp
  WHERE pp.schemaname = 'public'
    AND pp.tablename = p_table_name
  ORDER BY pp.policyname;
END;
$$;

-- 5. 권한 부여
GRANT EXECUTE ON FUNCTION public.debug_rls_policy(text) TO authenticated;

-- 6. 사용 예시
-- SELECT * FROM public.debug_rls_policy('guardians');

COMMENT ON FUNCTION public.debug_current_jwt() IS
'현재 사용자의 JWT claims와 user_tenant_roles를 확인하는 디버깅 함수';

COMMENT ON FUNCTION public.debug_rls_policy(text) IS
'특정 테이블의 RLS 정책을 확인하는 디버깅 함수';

