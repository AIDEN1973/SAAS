-- Academy Students 테이블 생성 (학원 업종 확장 테이블)
-- [불변 규칙] 모든 테이블은 tenant_id 필수 + 인덱스 구성
-- [불변 규칙] academy_students는 persons 테이블을 참조하는 업종별 확장 테이블입니다.
-- [불변 규칙] Industry Layer에서 관리되는 테이블입니다.

-- 1. academy_students 테이블 (학원 업종 확장)
CREATE TABLE IF NOT EXISTS public.academy_students (
  person_id uuid PRIMARY KEY REFERENCES public.persons(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  birth_date date,
  gender text CHECK (gender IN ('male', 'female', 'other')),
  school_name text,
  grade text,  -- 학년 (예: '1학년', '중1', '고1')
  class_name text,  -- 반 이름
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'graduated', 'withdrawn')),
  notes text,
  profile_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_academy_students_tenant ON public.academy_students(tenant_id);
CREATE INDEX IF NOT EXISTS idx_academy_students_tenant_created ON public.academy_students(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_academy_students_tenant_status ON public.academy_students(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_academy_students_tenant_grade ON public.academy_students(tenant_id, grade);
CREATE INDEX IF NOT EXISTS idx_academy_students_tenant_class ON public.academy_students(tenant_id, class_name);

-- updated_at 자동 업데이트 트리거
DROP TRIGGER IF EXISTS update_academy_students_updated_at ON public.academy_students;
CREATE TRIGGER update_academy_students_updated_at
  BEFORE UPDATE ON public.academy_students
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS 정책 (JWT claim 기반)
-- ⚠️ 중요: PostgREST가 테이블을 인식하려면 최소한 하나의 SELECT 정책이 필요합니다
ALTER TABLE public.academy_students ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제
DROP POLICY IF EXISTS tenant_isolation_academy_students ON public.academy_students;
DROP POLICY IF EXISTS "Tenant can read their academy_students" ON public.academy_students;
DROP POLICY IF EXISTS "Tenant can insert their academy_students" ON public.academy_students;
DROP POLICY IF EXISTS "Tenant can update their academy_students" ON public.academy_students;
DROP POLICY IF EXISTS "Tenant can delete their academy_students" ON public.academy_students;

-- SELECT 정책 (필수 - PostgREST 인식을 위해 반드시 필요)
CREATE POLICY "Tenant can read their academy_students"
ON public.academy_students
FOR SELECT
TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- INSERT 정책
CREATE POLICY "Tenant can insert their academy_students"
ON public.academy_students
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- UPDATE 정책
CREATE POLICY "Tenant can update their academy_students"
ON public.academy_students
FOR UPDATE
TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- DELETE 정책
CREATE POLICY "Tenant can delete their academy_students"
ON public.academy_students
FOR DELETE
TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- PostgREST 인식을 위한 권한 부여
GRANT SELECT ON public.academy_students TO authenticated;
GRANT SELECT ON public.academy_students TO anon;
GRANT SELECT ON public.academy_students TO service_role;
GRANT INSERT ON public.academy_students TO authenticated;
GRANT UPDATE ON public.academy_students TO authenticated;
GRANT DELETE ON public.academy_students TO authenticated;

