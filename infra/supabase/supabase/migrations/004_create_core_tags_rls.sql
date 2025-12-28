-- Core Tags RLS 정책
-- [불변 규칙] JWT claim 기반 RLS 사용

-- 1. tags 테이블 RLS
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_tags ON public.tags
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- 2. tag_assignments 테이블 RLS
ALTER TABLE public.tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_tag_assignments ON public.tag_assignments
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

