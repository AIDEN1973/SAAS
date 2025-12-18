-- 401 오류 및 role "owner" does not exist 오류 해결
--
-- [문제 1] user_tenant_roles 조회 시 401 Unauthorized
-- [문제 2] role "owner" does not exist 오류
-- [원인] 세션 인증 문제 및 RLS 정책 평가 중 오류
-- [해결] 권한 확인 및 RLS 정책 재검증
--
-- [불변 규칙] user_tenant_roles는 auth.uid() 기반 RLS 사용
-- [불변 규칙] tenants 테이블의 RLS 정책이 user_tenant_roles를 참조할 때 순환 참조 방지

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
-- tenants 테이블의 RLS 정책이 user_tenant_roles를 올바르게 참조하는지 확인
-- [중요] role "owner" 오류는 RLS 정책에서 PostgreSQL ROLE을 참조하려고 할 때 발생
--        하지만 우리는 user_tenant_roles.role 컬럼을 참조하므로 문제 없어야 함
--        혹시 모를 문제를 방지하기 위해 정책을 재생성

DROP POLICY IF EXISTS tenant_isolation_tenants ON public.tenants;

CREATE POLICY tenant_isolation_tenants ON public.tenants
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_tenant_roles
    WHERE user_tenant_roles.tenant_id = tenants.id
      AND user_tenant_roles.user_id = auth.uid()
  )
);

COMMENT ON POLICY tenant_isolation_tenants ON public.tenants IS
'테넌트 소속 사용자는 자신의 테넌트만 조회 가능합니다.
user_tenant_roles를 참조하여 테넌트 소속을 확인합니다.';

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

