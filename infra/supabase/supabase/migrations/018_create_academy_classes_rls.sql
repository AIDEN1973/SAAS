-- Academy Classes & Teachers RLS 정책
-- [불변 규칙] JWT claim 기반 RLS 사용 (PgBouncer Transaction Pooling 호환)

-- 1. academy_classes 테이블 RLS
ALTER TABLE public.academy_classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_academy_classes ON public.academy_classes;
CREATE POLICY tenant_isolation_academy_classes ON public.academy_classes
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- PostgREST 인식을 위한 권한 부여
GRANT SELECT ON public.academy_classes TO authenticated;
GRANT SELECT ON public.academy_classes TO anon;
GRANT SELECT ON public.academy_classes TO service_role;
GRANT INSERT ON public.academy_classes TO authenticated;
GRANT UPDATE ON public.academy_classes TO authenticated;
GRANT DELETE ON public.academy_classes TO authenticated;

-- 2. academy_teachers 테이블 RLS
ALTER TABLE public.academy_teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_academy_teachers ON public.academy_teachers;
CREATE POLICY tenant_isolation_academy_teachers ON public.academy_teachers
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- PostgREST 인식을 위한 권한 부여
GRANT SELECT ON public.academy_teachers TO authenticated;
GRANT SELECT ON public.academy_teachers TO anon;
GRANT SELECT ON public.academy_teachers TO service_role;
GRANT INSERT ON public.academy_teachers TO authenticated;
GRANT UPDATE ON public.academy_teachers TO authenticated;
GRANT DELETE ON public.academy_teachers TO authenticated;

-- 3. class_teachers 테이블 RLS
ALTER TABLE public.class_teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_class_teachers ON public.class_teachers;
CREATE POLICY tenant_isolation_class_teachers ON public.class_teachers
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- PostgREST 인식을 위한 권한 부여
GRANT SELECT ON public.class_teachers TO authenticated;
GRANT SELECT ON public.class_teachers TO anon;
GRANT SELECT ON public.class_teachers TO service_role;
GRANT INSERT ON public.class_teachers TO authenticated;
GRANT UPDATE ON public.class_teachers TO authenticated;
GRANT DELETE ON public.class_teachers TO authenticated;

