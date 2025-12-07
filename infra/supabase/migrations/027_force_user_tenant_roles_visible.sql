-- user_tenant_roles 테이블 강제 노출 (RLS 일시 비활성화 테스트)
-- [중요] PostgREST가 테이블을 인식하지 못하는 문제 해결
-- [주의] 이 마이그레이션은 테스트용입니다. RLS를 비활성화하면 보안상 위험할 수 있습니다.

-- 1. 모든 권한 재부여
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_tenant_roles TO authenticated, anon;

-- 2. RLS 일시 비활성화 (테스트용)
-- [주의] 이는 테스트 목적입니다. 테이블이 PostgREST에 노출되는지 확인하기 위함입니다.
-- 테이블이 노출되면 RLS를 다시 활성화하고 정책을 수정해야 합니다.
ALTER TABLE public.user_tenant_roles DISABLE ROW LEVEL SECURITY;

-- 3. 기존 정책 삭제
DROP POLICY IF EXISTS user_tenant_roles_isolation ON public.user_tenant_roles;

-- 4. PostgREST 스키마 캐시 강제 새로고침
NOTIFY pgrst, 'reload schema';

-- 5. 테이블 정보 확인
SELECT 
  schemaname,
  tablename,
  tableowner,
  hasindexes,
  hasrules,
  hastriggers
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'user_tenant_roles';

-- 6. 권한 정보 확인
SELECT 
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'user_tenant_roles'
  AND grantee IN ('authenticated', 'anon');

