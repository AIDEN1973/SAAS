-- 학생 관리 테이블 RLS 정책
-- [불변 규칙] JWT claim 기반 RLS 사용 (PgBouncer Transaction Pooling 호환)

-- 1. students 테이블 RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_students ON public.students
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() -> 'tenant_id')::uuid
)
WITH CHECK (
  tenant_id = (auth.jwt() -> 'tenant_id')::uuid
);

-- 2. guardians 테이블 RLS
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_guardians ON public.guardians
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() -> 'tenant_id')::uuid
)
WITH CHECK (
  tenant_id = (auth.jwt() -> 'tenant_id')::uuid
);

-- 3. 태그는 core-tags 공통 모듈 사용 (004_create_core_tags_rls.sql 참조)

-- 5. student_classes 테이블 RLS
ALTER TABLE public.student_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_student_classes ON public.student_classes
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() -> 'tenant_id')::uuid
)
WITH CHECK (
  tenant_id = (auth.jwt() -> 'tenant_id')::uuid
);

-- 6. student_consultations 테이블 RLS
ALTER TABLE public.student_consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_student_consultations ON public.student_consultations
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() -> 'tenant_id')::uuid
)
WITH CHECK (
  tenant_id = (auth.jwt() -> 'tenant_id')::uuid
);

