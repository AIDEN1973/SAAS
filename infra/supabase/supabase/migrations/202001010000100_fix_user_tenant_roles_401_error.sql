-- user_tenant_roles 401 오류 해결
--
-- [문제] user_tenant_roles 조회 시 401 Unauthorized 오류 발생
-- [원인] 세션이 없거나 인증되지 않은 상태에서 조회 시도
-- [해결] RLS 정책 확인 및 세션 기반 인증 강화
--
-- [불변 규칙] user_tenant_roles는 auth.uid() 기반 RLS 사용 (JWT claim 불필요)
-- [불변 규칙] 이 테이블은 JWT에 tenant_id가 없어도 조회 가능해야 함 (순환 참조 방지)

-- ============================================================================
-- 1. 현재 RLS 정책 확인
-- ============================================================================
-- [참고] pg_policies 뷰의 컬럼명은 PostgreSQL 버전에 따라 다를 수 있습니다.
-- 기본 컬럼만 사용하여 호환성을 보장합니다.
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  permissive,
  roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'user_tenant_roles'
ORDER BY policyname;

-- ============================================================================
-- 2. user_tenant_roles RLS 정책 확인 및 수정
-- ============================================================================
-- [중요] user_tenant_roles는 JWT claim 기반이 아닌 auth.uid() 기반이어야 함
-- 이는 순환 참조를 방지하기 위함:
-- - JWT에 tenant_id를 추가하려면 user_tenant_roles 조회 필요
-- - user_tenant_roles 조회 시 JWT의 tenant_id 필요 → 순환 참조!

-- 기존 정책 확인
DO $$
DECLARE
  policy_count integer;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'user_tenant_roles';

  IF policy_count = 0 THEN
    RAISE NOTICE '⚠️ user_tenant_roles에 RLS 정책이 없습니다. 정책을 생성합니다.';
  ELSE
    RAISE NOTICE '✅ user_tenant_roles에 %개의 RLS 정책이 있습니다.', policy_count;
  END IF;
END $$;

-- SELECT 정책 확인 및 재생성 (auth.uid() 기반)
DROP POLICY IF EXISTS user_tenant_roles_isolation ON public.user_tenant_roles;

CREATE POLICY user_tenant_roles_isolation ON public.user_tenant_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

COMMENT ON POLICY user_tenant_roles_isolation ON public.user_tenant_roles IS
'사용자는 자신의 user_tenant_roles 레코드만 조회 가능합니다.
JWT claim 기반이 아닌 auth.uid() 기반으로 순환 참조를 방지합니다.';

-- ============================================================================
-- 3. 권한 확인
-- ============================================================================
-- authenticated 역할에 SELECT 권한이 있는지 확인
SELECT
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'user_tenant_roles'
  AND grantee IN ('authenticated', 'anon')
ORDER BY grantee, privilege_type;

-- 권한이 없으면 부여
GRANT SELECT ON public.user_tenant_roles TO authenticated;

-- ============================================================================
-- 4. 테이블 통계 업데이트
-- ============================================================================
ANALYZE public.user_tenant_roles;

-- ============================================================================
-- 5. PostgREST 스키마 캐시 새로고침
-- ============================================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- 6. 최종 확인
-- ============================================================================
SELECT
  'user_tenant_roles RLS 정책 확인' AS check_type,
  COUNT(*) AS policy_count,
  string_agg(policyname, ', ') AS policy_names
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'user_tenant_roles';

