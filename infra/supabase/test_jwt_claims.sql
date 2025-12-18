-- JWT Claims 테스트 쿼리
-- Supabase SQL Editor에서 실행하세요

-- 1. 현재 JWT claims 확인
SELECT public.debug_current_jwt();

-- 2. guardians 테이블 RLS 정책 확인
SELECT * FROM public.debug_rls_policy('guardians');

-- 3. 현재 사용자 정보 확인
SELECT
  auth.uid() AS current_user_id,
  (auth.jwt() ->> 'tenant_id')::uuid AS tenant_id_from_jwt,
  (auth.jwt() ->> 'role')::text AS role_from_jwt;

-- 4. user_tenant_roles 확인
SELECT
  user_id,
  tenant_id,
  role,
  updated_at,
  created_at
FROM public.user_tenant_roles
WHERE user_id = auth.uid()
ORDER BY updated_at DESC, created_at ASC;

-- 5. 테넌트 정보 확인
SELECT
  t.id,
  t.name,
  t.industry_type,
  utr.role AS user_role
FROM public.tenants t
INNER JOIN public.user_tenant_roles utr ON utr.tenant_id = t.id
WHERE utr.user_id = auth.uid();

-- 6. guardians 테이블에 접근 가능한지 테스트
SELECT COUNT(*) AS guardians_count
FROM public.guardians;

-- 7. Custom Access Token Hook 상태 확인
SELECT
  hook_type,
  hook_name,
  enabled
FROM auth.hooks
WHERE hook_type = 'custom_access_token';

