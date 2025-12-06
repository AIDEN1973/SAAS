-- Core Platform RLS 정책
-- [불변 규칙] JWT claim 기반 RLS 사용 (PgBouncer Transaction Pooling 호환)

-- 1. tenants 테이블 RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 테넌트 소속 사용자는 자신의 테넌트만 조회 가능
CREATE POLICY tenant_isolation_tenants ON public.tenants
FOR SELECT TO authenticated
USING (
  id IN (
    SELECT tenant_id FROM public.user_tenant_roles
    WHERE user_id = auth.uid()
  )
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
CREATE POLICY user_tenant_roles_isolation ON public.user_tenant_roles
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR tenant_id IN (
    SELECT tenant_id FROM public.user_tenant_roles
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

-- 3. tenant_settings 테이블 RLS
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_tenant_settings ON public.tenant_settings
FOR ALL TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.user_tenant_roles
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.user_tenant_roles
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin', 'sub_admin')
  )
);

-- 4. tenant_features 테이블 RLS
ALTER TABLE public.tenant_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_tenant_features ON public.tenant_features
FOR ALL TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.user_tenant_roles
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.user_tenant_roles
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

