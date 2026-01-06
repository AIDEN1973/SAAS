-- JWT Claims 검증
-- [목적] JWT에 tenant_id claim이 포함되어 있는지 확인

-- 1. 현재 사용자의 JWT claims 확인
SELECT
  '현재 JWT claims' AS check_type,
  auth.jwt() AS jwt_claims,
  (auth.jwt() ->> 'tenant_id')::uuid AS tenant_id_from_jwt,
  auth.uid() AS current_user_id;

-- 2. Custom Access Token Hook 함수 존재 확인
SELECT
  '함수 존재 확인' AS check_type,
  p.proname AS function_name,
  pg_get_userbyid(p.proowner) AS function_owner,
  p.prosecdef AS is_security_definer
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'custom_access_token_hook';

-- 3. Hook 활성화 확인 (auth.hooks 테이블)
SELECT
  'Hook 활성화 확인' AS check_type,
  hook_type,
  hook_name,
  enabled
FROM auth.hooks
WHERE hook_type = 'custom_access_token'
LIMIT 1;

-- 4. user_tenant_roles 확인 (현재 사용자)
SELECT
  'user_tenant_roles 확인' AS check_type,
  utr.user_id,
  utr.tenant_id,
  utr.role,
  utr.updated_at,
  t.name AS tenant_name
FROM public.user_tenant_roles utr
LEFT JOIN public.tenants t ON t.id = utr.tenant_id
WHERE utr.user_id = auth.uid()
ORDER BY utr.updated_at DESC, utr.created_at ASC;

-- 5. guardians 테이블 RLS 정책 확인
SELECT
  'guardians RLS 정책 확인' AS check_type,
  schemaname,
  tablename,
  policyname,
  cmd,
  CASE
    WHEN using_expression LIKE '%auth.jwt()%' THEN 'JWT claim 기반'
    WHEN using_expression LIKE '%user_tenant_roles%' THEN 'user_tenant_roles 기반'
    ELSE '기타'
  END AS policy_type,
  using_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'guardians'
ORDER BY policyname;

-- 6. Custom Access Token Hook 수동 실행 테스트
DO $$
DECLARE
  test_event jsonb;
  test_result jsonb;
BEGIN
  -- 테스트 이벤트 생성
  test_event := jsonb_build_object(
    'user_id', auth.uid()::text,
    'claims', jsonb_build_object(),
    'user_metadata', jsonb_build_object()
  );

  -- Hook 함수 실행
  BEGIN
    test_result := public.custom_access_token_hook(test_event);
    RAISE NOTICE '✅ Hook 실행 성공: %', test_result;
    RAISE NOTICE '   tenant_id claim: %', test_result->'claims'->>'tenant_id';
    RAISE NOTICE '   role claim: %', test_result->'claims'->>'role';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ Hook 실행 실패: % %', SQLERRM, SQLSTATE;
  END;
END $$;

-- 7. 권한 확인
SELECT
  '권한 확인' AS check_type,
  'supabase_auth_admin'::regrole AS role_name,
  has_table_privilege('supabase_auth_admin', 'public.user_tenant_roles', 'SELECT') AS can_select_user_tenant_roles,
  has_table_privilege('supabase_auth_admin', 'public.tenants', 'SELECT') AS can_select_tenants,
  has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook(jsonb)', 'EXECUTE') AS can_execute_hook;

