-- 401 오류 및 role "owner" does not exist 오류 해결
--
-- [문제 1] user_tenant_roles 조회 시 401 Unauthorized
-- [문제 2] role "owner" does not exist 오류
-- [원인] 세션 인증 문제 및 RLS 정책 평가 중 오류
-- [해결] 권한 확인 및 RLS 정책 재검증
--
-- [불변 규칙] user_tenant_roles는 auth.uid() 기반 RLS 사용
-- [불변 규칙] tenants 테이블의 RLS 정책은 JWT claim 기반 사용 (PgBouncer Transaction Pooling 호환)

-- ============================================================================
-- 1. user_tenant_roles 테이블 권한 재확인
-- ============================================================================
-- authenticated 역할에 SELECT 권한이 명시적으로 부여되어 있는지 확인
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.user_tenant_roles TO authenticated;

-- ============================================================================
-- 2. RLS 정책 재확인 및 재생성
-- ============================================================================
-- user_tenant_roles SELECT 정책
DROP POLICY IF EXISTS user_tenant_roles_isolation ON public.user_tenant_roles;

CREATE POLICY user_tenant_roles_isolation ON public.user_tenant_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

COMMENT ON POLICY user_tenant_roles_isolation ON public.user_tenant_roles IS
'사용자는 자신의 user_tenant_roles 레코드만 조회 가능합니다.
JWT claim 기반이 아닌 auth.uid() 기반으로 순환 참조를 방지합니다.';

-- ============================================================================
-- 3. tenants 테이블 RLS 정책 확인
-- ============================================================================
-- [불변 규칙] JWT claim 기반 RLS 사용 (PgBouncer Transaction Pooling 호환)
-- tenants 테이블의 RLS 정책을 JWT claim 기반으로 수정

DROP POLICY IF EXISTS tenant_isolation_tenants ON public.tenants;

CREATE POLICY tenant_isolation_tenants ON public.tenants
FOR SELECT TO authenticated
USING (
  id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

COMMENT ON POLICY tenant_isolation_tenants ON public.tenants IS
'테넌트 격리: JWT claim 기반 RLS (PgBouncer Transaction Pooling 호환)';

-- ============================================================================
-- 4. 테이블 통계 업데이트
-- ============================================================================
ANALYZE public.user_tenant_roles;
ANALYZE public.tenants;

-- ============================================================================
-- 5. PostgREST 스키마 캐시 새로고침
-- ============================================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- 6. 최종 확인
-- ============================================================================
SELECT
  'user_tenant_roles 권한 확인' AS check_type,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'user_tenant_roles'
  AND grantee = 'authenticated'
ORDER BY privilege_type;

SELECT
  'user_tenant_roles RLS 정책 확인' AS check_type,
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'user_tenant_roles'
ORDER BY policyname;

SELECT
  'tenants RLS 정책 확인' AS check_type,
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'tenants'
ORDER BY policyname;

