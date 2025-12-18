-- 간단한 JWT 확인 쿼리

-- 1. 현재 사용자 및 JWT tenant_id 확인 (가장 중요!)
SELECT
  '현재 사용자 및 JWT' AS check_type,
  auth.uid() AS user_id,
  (auth.jwt() ->> 'tenant_id')::uuid AS tenant_id_from_jwt,
  (auth.jwt() ->> 'role')::text AS role_from_jwt,
  CASE
    WHEN (auth.jwt() ->> 'tenant_id') IS NOT NULL THEN '✅ JWT claim에 tenant_id 포함'
    ELSE '❌ JWT claim에 tenant_id 없음 (fallback 사용 중)'
  END AS status;

-- 2. user_tenant_roles 확인
SELECT
  'user_tenant_roles' AS check_type,
  tenant_id,
  role,
  updated_at
FROM public.user_tenant_roles
WHERE user_id = auth.uid()
ORDER BY updated_at DESC, created_at ASC;

-- 3. Custom Access Token Hook 활성화 확인
SELECT
  'Hook 활성화 상태' AS check_type,
  hook_type,
  hook_name,
  enabled,
  CASE
    WHEN enabled THEN '✅ Hook 활성화됨'
    ELSE '❌ Hook 비활성화됨'
  END AS status
FROM auth.hooks
WHERE hook_type = 'custom_access_token';

-- 4. guardians RLS 정책 확인
SELECT
  'guardians RLS 정책' AS check_type,
  policyname,
  cmd,
  CASE
    WHEN using_expression LIKE '%auth.jwt()%' THEN 'JWT claim 기반'
    WHEN using_expression LIKE '%user_tenant_roles%' THEN 'user_tenant_roles 기반'
    ELSE '기타'
  END AS policy_type
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'guardians'
ORDER BY policyname;

