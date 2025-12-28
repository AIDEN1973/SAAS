-- tenants 테이블 RLS 정책 JWT claim 기반으로 수정
-- [불변 규칙] JWT claim 기반 RLS 사용 (PgBouncer Transaction Pooling 호환)

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

-- PostgREST 스키마 캐시 새로고침
NOTIFY pgrst, 'reload schema';

