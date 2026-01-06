-- Core Platform RLS 정책
-- [불변 규칙] JWT claim 기반 RLS 사용 (PgBouncer Transaction Pooling 호환)

-- 1. tenants 테이블 RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 테넌트 소속 사용자는 자신의 테넌트만 조회 가능
-- [불변 규칙] JWT claim 기반 RLS 사용 (PgBouncer Transaction Pooling 호환)
-- Note: Super admin check는 040_create_user_platform_roles.sql 이후에 적용됨
DROP POLICY IF EXISTS tenant_isolation_tenants ON public.tenants;
CREATE POLICY tenant_isolation_tenants ON public.tenants
FOR SELECT TO authenticated
USING (
  id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- Super Admin만 테넌트 생성/수정 가능 (추후 구현)
-- CREATE POLICY tenants_superadmin ON public.tenants
-- FOR ALL TO authenticated
-- USING (
--   EXISTS (
--     SELECT 1 FROM public.user_tenant_roles
--     WHERE user_id = auth.uid()
--     AND role = 'super_admin'
--   )
-- );

-- 2. user_tenant_roles 테이블 RLS
ALTER TABLE public.user_tenant_roles ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 역할만 조회 가능
-- [중요] 순환 참조 방지: 자기 자신을 참조하지 않도록 단순화
-- [중요] PostgREST가 테이블을 인식하려면 RLS 정책이 단순해야 함
DROP POLICY IF EXISTS user_tenant_roles_isolation ON public.user_tenant_roles;
CREATE POLICY user_tenant_roles_isolation ON public.user_tenant_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 3. tenant_settings 테이블 RLS
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

-- Note: Super admin check는 040_create_user_platform_roles.sql 이후에 적용됨
DROP POLICY IF EXISTS tenant_isolation_tenant_settings ON public.tenant_settings;
CREATE POLICY tenant_isolation_tenant_settings ON public.tenant_settings
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  AND ((auth.jwt() ->> 'role'::text) IN ('owner', 'admin', 'sub_admin'))
);

-- 4. tenant_features 테이블 RLS
ALTER TABLE public.tenant_features ENABLE ROW LEVEL SECURITY;

-- Note: Super admin check는 040_create_user_platform_roles.sql 이후에 적용됨
DROP POLICY IF EXISTS tenant_isolation_tenant_features ON public.tenant_features;
CREATE POLICY tenant_isolation_tenant_features ON public.tenant_features
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  AND ((auth.jwt() ->> 'role'::text) IN ('owner', 'admin'))
);

