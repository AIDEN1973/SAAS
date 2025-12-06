-- Academy 업종 관련 테이블 RLS 정책
-- [불변 규칙] JWT claim 기반 RLS 사용 (PgBouncer Transaction Pooling 호환)

-- 1. guardians 테이블 RLS
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_guardians ON public.guardians
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- 2. student_classes 테이블 RLS
ALTER TABLE public.student_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_student_classes ON public.student_classes
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- 3. student_consultations 테이블 RLS
ALTER TABLE public.student_consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_student_consultations ON public.student_consultations
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

