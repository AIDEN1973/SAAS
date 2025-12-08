-- tenants 테이블과 user_tenant_roles 비교 및 동기화
-- [중요] tenants는 작동하므로 정확히 동일한 방식으로 설정

-- 1. tenants 테이블의 권한 확인
SELECT 
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'tenants'
  AND grantee IN ('authenticated', 'anon')
ORDER BY grantee, privilege_type;

-- 2. tenants 테이블의 RLS 상태 확인
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'tenants';

-- 3. user_tenant_roles 테이블의 권한 확인
SELECT 
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'user_tenant_roles'
  AND grantee IN ('authenticated', 'anon')
ORDER BY grantee, privilege_type;

-- 4. user_tenant_roles 테이블의 RLS 상태 확인
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'user_tenant_roles';

-- 5. tenants와 동일한 권한으로 설정
-- tenants 테이블의 권한을 user_tenant_roles에 동일하게 적용
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT ON public.user_tenant_roles TO authenticated, anon;

-- 6. 테이블 통계 업데이트
ANALYZE public.user_tenant_roles;
ANALYZE public.tenants;

-- 7. PostgREST 스키마 캐시 강제 새로고침
NOTIFY pgrst, 'reload schema';



