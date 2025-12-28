-- 모든 테이블 PostgREST 인식 문제 근본 해결
-- [중요] PostgREST가 테이블을 인식하지 못하는 근본 원인 해결
-- [해결] 모든 테이블에 일관된 권한과 RLS 정책 적용

-- ============================================
-- 1. 스키마 권한 부여 (모든 테이블에 공통)
-- ============================================
GRANT USAGE ON SCHEMA public TO authenticated, anon;

-- ============================================
-- 2. 모든 테이블에 SELECT 권한 부여 (PostgREST 인식 필수)
-- ============================================
-- [중요] PostgREST는 authenticated, anon 역할에 SELECT 권한이 있어야 테이블을 인식합니다
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated, anon;

-- ============================================
-- 3. 향후 생성되는 테이블에 대한 기본 권한 설정
-- ============================================
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT ON TABLES TO authenticated, anon;

-- ============================================
-- 4. 주요 테이블별 권한 및 RLS 정책 확인 및 수정
-- ============================================

-- 4-1. persons 테이블
DO $$
BEGIN
  -- 테이블 존재 확인
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'persons'
  ) THEN
    -- 권한 재부여
    GRANT SELECT ON TABLE public.persons TO authenticated, anon;
    GRANT INSERT, UPDATE, DELETE ON TABLE public.persons TO authenticated;
    
    -- RLS 활성화 확인
    ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;
    
    -- RLS 정책 개수 확인 및 개발용 정책 보장
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'persons'
      AND policyname = 'Dev: Allow all authenticated users'
    ) THEN
      RAISE NOTICE 'persons 테이블에 개발용 정책이 없습니다. 생성합니다.';
      -- 개발용 정책 생성 (015_dev_rls_bypass.sql과 동일)
      CREATE POLICY "Dev: Allow all authenticated users" ON public.persons
      FOR ALL TO authenticated
      USING (true)
      WITH CHECK (true);
    END IF;
    
    RAISE NOTICE 'persons 테이블 권한 및 RLS 정책 확인 완료';
  END IF;
END $$;

-- 4-2. user_tenant_roles 테이블
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_tenant_roles'
  ) THEN
    GRANT SELECT ON TABLE public.user_tenant_roles TO authenticated, anon;
    GRANT INSERT, UPDATE, DELETE ON TABLE public.user_tenant_roles TO authenticated;
    
    ALTER TABLE public.user_tenant_roles ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'user_tenant_roles'
      AND cmd = 'SELECT'
    ) THEN
      CREATE POLICY user_tenant_roles_isolation ON public.user_tenant_roles
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
    END IF;
    
    RAISE NOTICE 'user_tenant_roles 테이블 권한 및 RLS 정책 확인 완료';
  END IF;
END $$;

-- 4-3. tenants 테이블
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'tenants'
  ) THEN
    GRANT SELECT ON TABLE public.tenants TO authenticated, anon;
    GRANT INSERT, UPDATE, DELETE ON TABLE public.tenants TO authenticated;
    
    ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'tenants'
      AND cmd = 'SELECT'
    ) THEN
      CREATE POLICY tenant_isolation_tenants ON public.tenants
      FOR SELECT TO authenticated
      USING (
        id IN (
          SELECT tenant_id FROM public.user_tenant_roles
          WHERE user_id = auth.uid()
        )
      );
    END IF;
    
    RAISE NOTICE 'tenants 테이블 권한 및 RLS 정책 확인 완료';
  END IF;
END $$;

-- 4-4. academy_students 테이블
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'academy_students'
  ) THEN
    GRANT SELECT ON TABLE public.academy_students TO authenticated, anon;
    GRANT INSERT, UPDATE, DELETE ON TABLE public.academy_students TO authenticated;
    
    ALTER TABLE public.academy_students ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'academy_students'
      AND cmd = 'SELECT'
    ) THEN
      CREATE POLICY "academy_students_select_policy" ON public.academy_students
      FOR SELECT TO authenticated
      USING (true);  -- 개발용
    END IF;
    
    RAISE NOTICE 'academy_students 테이블 권한 및 RLS 정책 확인 완료';
  END IF;
END $$;

-- ============================================
-- 5. 모든 테이블 통계 업데이트
-- ============================================
ANALYZE public.persons;
ANALYZE public.user_tenant_roles;
ANALYZE public.tenants;

-- ============================================
-- 6. PostgREST 스키마 캐시 강제 새로고침
-- ============================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload schema';

-- ============================================
-- 7. 진단: 모든 테이블의 권한 및 RLS 정책 확인
-- ============================================
SELECT 
  '권한 확인' AS check_type,
  table_name,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name IN ('persons', 'user_tenant_roles', 'tenants', 'academy_students')
  AND grantee IN ('authenticated', 'anon')
ORDER BY table_name, grantee, privilege_type;

SELECT 
  'RLS 정책 확인' AS check_type,
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('persons', 'user_tenant_roles', 'tenants', 'academy_students')
ORDER BY tablename, cmd;

-- ============================================
-- 8. 최종 진단: PostgREST가 인식할 수 있는 테이블 목록
-- ============================================
DO $$
DECLARE
  v_table_count integer;
  v_policy_count integer;
BEGIN
  -- 테이블 개수 확인
  SELECT COUNT(*) INTO v_table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name IN ('persons', 'user_tenant_roles', 'tenants', 'academy_students');
  
  -- SELECT 정책이 있는 테이블 개수 확인
  SELECT COUNT(DISTINCT tablename) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND cmd = 'SELECT'
    AND tablename IN ('persons', 'user_tenant_roles', 'tenants', 'academy_students');
  
  RAISE NOTICE '=== PostgREST 테이블 인식 진단 ===';
  RAISE NOTICE '확인한 테이블 개수: %', v_table_count;
  RAISE NOTICE 'SELECT 정책이 있는 테이블 개수: %', v_policy_count;
  
  IF v_policy_count = v_table_count THEN
    RAISE NOTICE '✅ 모든 테이블에 SELECT 정책이 있습니다.';
  ELSE
    RAISE WARNING '❌ 일부 테이블에 SELECT 정책이 없습니다.';
  END IF;
  
  RAISE NOTICE '⚠️  Supabase Dashboard → Settings → API → "Reload schema" 클릭 필요';
END $$;

