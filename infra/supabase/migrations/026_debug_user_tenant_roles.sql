-- user_tenant_roles 테이블 디버깅 및 강제 노출
-- [중요] PostgREST가 테이블을 인식하지 못하는 문제 해결

-- 1. 테이블 존재 확인
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_tenant_roles'
  ) THEN
    RAISE EXCEPTION 'user_tenant_roles 테이블이 존재하지 않습니다';
  ELSE
    RAISE NOTICE 'user_tenant_roles 테이블 존재 확인됨';
  END IF;
END $$;

-- 2. 스키마 권한 확인 및 재부여
GRANT USAGE ON SCHEMA public TO authenticated, anon;

-- 3. 테이블 권한 확인 및 재부여
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_tenant_roles TO authenticated, anon;

-- 4. 모든 권한 확인 (디버깅용)
DO $$
DECLARE
  v_has_usage boolean;
  v_has_select boolean;
BEGIN
  -- USAGE 권한 확인
  SELECT has_schema_privilege('authenticated', 'public', 'USAGE') INTO v_has_usage;
  RAISE NOTICE 'authenticated USAGE on public: %', v_has_usage;
  
  -- SELECT 권한 확인
  SELECT has_table_privilege('authenticated', 'public.user_tenant_roles', 'SELECT') INTO v_has_select;
  RAISE NOTICE 'authenticated SELECT on user_tenant_roles: %', v_has_select;
END $$;

-- 5. RLS 상태 확인
DO $$
DECLARE
  v_rls_enabled boolean;
BEGIN
  SELECT relrowsecurity INTO v_rls_enabled
  FROM pg_class
  WHERE relname = 'user_tenant_roles' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  
  RAISE NOTICE 'RLS enabled on user_tenant_roles: %', v_rls_enabled;
END $$;

-- 6. RLS 정책 확인
DO $$
DECLARE
  v_policy_count integer;
BEGIN
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'user_tenant_roles';
  
  RAISE NOTICE 'RLS policies on user_tenant_roles: %', v_policy_count;
END $$;

-- 7. RLS 정책 재생성 (단순화)
DROP POLICY IF EXISTS user_tenant_roles_isolation ON public.user_tenant_roles;
CREATE POLICY user_tenant_roles_isolation ON public.user_tenant_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 8. 기본 권한도 확인 (소유자 권한)
ALTER TABLE public.user_tenant_roles OWNER TO postgres;

-- 9. PostgREST 스키마 캐시 강제 새로고침
NOTIFY pgrst, 'reload schema';

-- 10. 테이블 메타데이터 출력 (디버깅용)
SELECT 
  table_name,
  table_type,
  is_insertable_into
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name = 'user_tenant_roles';

