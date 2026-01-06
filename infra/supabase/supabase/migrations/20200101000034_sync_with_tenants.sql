-- user_tenant_roles를 tenants와 정확히 동일하게 동기화
-- [중요] tenants는 작동하므로 정확히 동일한 권한과 RLS 정책 적용

-- 1. tenants 테이블의 RLS 정책 확인
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

-- 2. user_tenant_roles에 tenants와 동일한 모든 권한 부여
REVOKE ALL ON public.user_tenant_roles FROM authenticated, anon, public;
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.user_tenant_roles TO authenticated, anon;

-- 3. RLS 상태 확인 및 동기화
-- tenants 테이블의 RLS 상태 확인
SELECT 
  relname,
  relrowsecurity,
  relforcerowsecurity
FROM pg_class
WHERE relname IN ('tenants', 'user_tenant_roles')
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 4. user_tenant_roles의 RLS를 tenants와 동일하게 설정
-- tenants의 RLS 상태를 확인한 후 동일하게 적용
ALTER TABLE public.user_tenant_roles ENABLE ROW LEVEL SECURITY;

-- 5. 기존 정책 삭제 및 재생성
DROP POLICY IF EXISTS user_tenant_roles_isolation ON public.user_tenant_roles;
CREATE POLICY user_tenant_roles_isolation ON public.user_tenant_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 6. 테이블 통계 업데이트
ANALYZE public.user_tenant_roles;
ANALYZE public.tenants;

-- 7. PostgREST 스키마 캐시 강제 새로고침
NOTIFY pgrst, 'reload schema';

-- 8. 최종 권한 확인
SELECT 
  'tenants' as table_name,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'tenants'
  AND grantee IN ('authenticated', 'anon')
UNION ALL
SELECT 
  'user_tenant_roles' as table_name,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'user_tenant_roles'
  AND grantee IN ('authenticated', 'anon')
ORDER BY table_name, grantee, privilege_type;



