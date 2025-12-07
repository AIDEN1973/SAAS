-- PostgREST 테이블 인식 문제 최종 해결
-- [중요] 로그인 시 404 에러 해결
-- [해결] PostgREST가 테이블을 인식하도록 강제 설정

-- 1. 테이블 존재 확인
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_tenant_roles'
  ) THEN
    RAISE EXCEPTION 'user_tenant_roles 테이블이 존재하지 않습니다. 먼저 033_ensure_user_tenant_roles_visible.sql을 실행하세요.';
  END IF;
END $$;

-- 2. 모든 권한 명시적으로 재부여
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT ON TABLE public.user_tenant_roles TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON TABLE public.user_tenant_roles TO authenticated;

-- 3. RLS 정책 확인 및 재생성
ALTER TABLE public.user_tenant_roles ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제
DROP POLICY IF EXISTS user_tenant_roles_isolation ON public.user_tenant_roles;
DROP POLICY IF EXISTS "tenant read" ON public.user_tenant_roles;

-- authenticated 사용자를 위한 정책 (자신의 레코드만 조회)
CREATE POLICY user_tenant_roles_isolation ON public.user_tenant_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- [중요] PostgREST가 테이블을 인식하려면 최소한 하나의 정책이 필요합니다
-- authenticated 정책만으로도 충분합니다 (로그인 후에는 authenticated가 됨)

-- 4. 테이블 통계 업데이트
ANALYZE public.user_tenant_roles;

-- 5. PostgREST 스키마 캐시 강제 새로고침
-- [중요] 이 명령으로 PostgREST가 DB 구조를 다시 읽습니다
NOTIFY pgrst, 'reload schema';

-- 6. 최종 확인: 테이블 및 권한 확인
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'user_tenant_roles';

SELECT 
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'user_tenant_roles'
  AND grantee IN ('authenticated', 'anon')
ORDER BY grantee, privilege_type;

-- 7. RLS 정책 확인
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'user_tenant_roles';

-- 8. PostgREST가 테이블을 인식하는지 확인하는 진단 쿼리
-- [중요] 이 쿼리들은 PostgREST가 테이블을 볼 수 있는지 확인합니다
-- 
-- PostgREST가 테이블을 인식하려면 다음 조건이 모두 충족되어야 합니다:
-- 1. 테이블이 public 스키마에 존재
-- 2. authenticated 또는 anon 역할에 SELECT 권한이 있음
-- 3. RLS가 활성화되어 있으면 최소한 하나의 정책이 필요
-- 4. 테이블이 뷰가 아닌 실제 테이블이어야 함

-- 테이블 타입 확인 (BASE TABLE이어야 함)
SELECT 
  table_name,
  table_type,
  is_insertable_into
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name = 'user_tenant_roles';

-- PostgREST가 보는 테이블 목록 확인 (pg_catalog 기반)
-- [참고] PostgREST는 pg_catalog.pg_class와 pg_namespace를 사용하여 테이블을 탐색합니다
SELECT 
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relkind AS table_type,
  CASE c.relkind
    WHEN 'r' THEN 'table'
    WHEN 'v' THEN 'view'
    WHEN 'm' THEN 'materialized view'
    ELSE 'other'
  END AS type_description,
  c.relrowsecurity AS rls_enabled,
  (SELECT COUNT(*) FROM pg_policies p 
   WHERE p.schemaname = n.nspname AND p.tablename = c.relname) AS policy_count
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'user_tenant_roles'
  AND c.relkind = 'r';  -- 'r' = regular table

-- [최종 확인] 모든 조건이 충족되었는지 확인
DO $$
DECLARE
  v_table_exists boolean;
  v_has_select_anon boolean;
  v_has_select_authenticated boolean;
  v_rls_enabled boolean;
  v_policy_count integer;
BEGIN
  -- 테이블 존재 확인
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_tenant_roles'
  ) INTO v_table_exists;
  
  -- 권한 확인
  SELECT has_table_privilege('anon', 'public.user_tenant_roles', 'SELECT') INTO v_has_select_anon;
  SELECT has_table_privilege('authenticated', 'public.user_tenant_roles', 'SELECT') INTO v_has_select_authenticated;
  
  -- RLS 상태 확인
  SELECT relrowsecurity INTO v_rls_enabled
  FROM pg_class
  WHERE relname = 'user_tenant_roles' 
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  
  -- 정책 개수 확인
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' 
  AND tablename = 'user_tenant_roles';
  
  -- 결과 출력
  RAISE NOTICE '=== PostgREST 테이블 인식 진단 ===';
  RAISE NOTICE '테이블 존재: %', v_table_exists;
  RAISE NOTICE 'anon SELECT 권한: %', v_has_select_anon;
  RAISE NOTICE 'authenticated SELECT 권한: %', v_has_select_authenticated;
  RAISE NOTICE 'RLS 활성화: %', v_rls_enabled;
  RAISE NOTICE 'RLS 정책 개수: %', v_policy_count;
  
  -- 최종 판단
  IF v_table_exists AND (v_has_select_anon OR v_has_select_authenticated) AND 
     (NOT v_rls_enabled OR v_policy_count > 0) THEN
    RAISE NOTICE '✅ PostgREST가 테이블을 인식할 수 있어야 합니다.';
    RAISE NOTICE '⚠️  만약 여전히 404가 발생한다면:';
    RAISE NOTICE '   1. Supabase Dashboard → Settings → API → "Reload schema" 클릭';
    RAISE NOTICE '   2. 브라우저 캐시 삭제 후 다시 시도';
    RAISE NOTICE '   3. Supabase 프로젝트 재시작 고려';
  ELSE
    RAISE WARNING '❌ PostgREST가 테이블을 인식하지 못할 수 있습니다.';
    IF NOT v_table_exists THEN
      RAISE WARNING '   - 테이블이 존재하지 않습니다.';
    END IF;
    IF NOT v_has_select_anon AND NOT v_has_select_authenticated THEN
      RAISE WARNING '   - SELECT 권한이 없습니다.';
    END IF;
    IF v_rls_enabled AND v_policy_count = 0 THEN
      RAISE WARNING '   - RLS가 활성화되어 있지만 정책이 없습니다.';
    END IF;
  END IF;
END $$;

