-- PostgREST 테이블 강제 노출 (최종 해결책)
-- [중요] 모든 조건이 충족되었는데도 404가 발생하는 경우를 위한 강제 노출
-- [해결] PostgREST가 테이블을 확실히 인식하도록 모든 설정을 재적용

-- 1. 테이블 존재 확인
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_tenant_roles'
  ) THEN
    RAISE EXCEPTION 'user_tenant_roles 테이블이 존재하지 않습니다.';
  END IF;
END $$;

-- 2. 모든 권한 명시적으로 제거 후 재부여 (캐시 문제 해결)
REVOKE ALL ON TABLE public.user_tenant_roles FROM authenticated, anon;
REVOKE ALL ON SCHEMA public FROM authenticated, anon;

-- 3. 스키마 권한 재부여
GRANT USAGE ON SCHEMA public TO authenticated, anon;

-- 4. 테이블 권한 재부여 (명시적으로)
GRANT SELECT ON TABLE public.user_tenant_roles TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON TABLE public.user_tenant_roles TO authenticated;

-- 5. 테이블 소유자 확인 및 설정
ALTER TABLE public.user_tenant_roles OWNER TO postgres;

-- 6. RLS 상태 확인 및 재설정
ALTER TABLE public.user_tenant_roles ENABLE ROW LEVEL SECURITY;

-- 7. 기존 정책 모두 삭제 후 재생성
DROP POLICY IF EXISTS user_tenant_roles_isolation ON public.user_tenant_roles;
DROP POLICY IF EXISTS "tenant read" ON public.user_tenant_roles;
DROP POLICY IF EXISTS user_tenant_roles_select ON public.user_tenant_roles;

-- 8. RLS 정책 재생성 (명확하게)
CREATE POLICY user_tenant_roles_isolation ON public.user_tenant_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 9. 테이블 통계 강제 업데이트
-- [참고] VACUUM은 트랜잭션 블록 안에서 실행할 수 없으므로 제외
-- 필요시 수동으로 실행: VACUUM ANALYZE public.user_tenant_roles;
ANALYZE public.user_tenant_roles;

-- 10. PostgREST 스키마 캐시 강제 새로고침 (여러 번)
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload schema';

-- 11. 최종 확인: 모든 권한이 올바르게 설정되었는지 확인
SELECT 
  '권한 확인' AS check_type,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'user_tenant_roles'
  AND grantee IN ('authenticated', 'anon')
ORDER BY grantee, privilege_type;

-- 12. RLS 정책 확인
SELECT 
  'RLS 정책 확인' AS check_type,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'user_tenant_roles';

-- 13. 테이블 메타데이터 확인
SELECT 
  '테이블 메타데이터' AS check_type,
  table_name,
  table_type,
  is_insertable_into
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name = 'user_tenant_roles';

-- 14. [중요] Supabase Dashboard에서 다음을 수행해야 합니다:
--     1. Settings → API → "Reload schema" 버튼 클릭
--     2. 또는 Supabase CLI 사용: supabase db reset (개발 환경에서만)
--     3. 또는 Supabase 프로젝트 재시작

-- 15. [대안] PostgREST가 테이블을 인식하지 못하는 경우:
--     - Supabase Dashboard → Database → Tables → user_tenant_roles 확인
--     - 테이블이 보이지만 API에서 안 보이면 PostgREST 재시작 필요
--     - 또는 Supabase 지원팀에 문의

