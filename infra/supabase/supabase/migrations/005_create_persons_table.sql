-- Core Party 테이블 생성 (persons)
-- [불변 규칙] 모든 테이블은 tenant_id 필수 + 인덱스 구성
-- [불변 규칙] JWT claim 기반 RLS 사용 (PgBouncer Transaction Pooling 호환)
-- [불변 규칙] persons 테이블은 core-party 모듈에서 관리되며, Industry Layer는 이를 확장하여 사용합니다.

-- 1. persons 테이블 (Core Party)
CREATE TABLE IF NOT EXISTS public.persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  address text,
  person_type text NOT NULL CHECK (person_type IN ('student', 'customer', 'member', 'resident', 'donor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_persons_tenant ON public.persons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_persons_tenant_created ON public.persons(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_persons_tenant_type ON public.persons(tenant_id, person_type);
CREATE INDEX IF NOT EXISTS idx_persons_type_tenant ON public.persons(person_type, tenant_id, created_at DESC);

-- 이름 검색용 인덱스 (Phase 2+)
CREATE INDEX IF NOT EXISTS idx_persons_name_pattern ON public.persons USING btree (name text_pattern_ops);

-- updated_at 자동 업데이트 트리거
DROP TRIGGER IF EXISTS update_persons_updated_at ON public.persons;
CREATE TRIGGER update_persons_updated_at
  BEFORE UPDATE ON public.persons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS 정책 (JWT claim 기반)
-- ⚠️ 중요: PostgREST가 테이블을 인식하려면 최소한 하나의 SELECT 정책이 필요합니다
-- RLS가 켜져 있지만 정책이 없으면 PostgREST가 테이블을 숨기고 404를 반환합니다
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제
DROP POLICY IF EXISTS tenant_isolation_persons ON public.persons;
DROP POLICY IF EXISTS "Tenant can read their persons" ON public.persons;
DROP POLICY IF EXISTS "Tenant can insert their persons" ON public.persons;
DROP POLICY IF EXISTS "Tenant can update their persons" ON public.persons;
DROP POLICY IF EXISTS "Tenant can delete their persons" ON public.persons;

-- SELECT 정책 (필수 - PostgREST 인식을 위해 반드시 필요)
CREATE POLICY "Tenant can read their persons"
ON public.persons
FOR SELECT
TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- INSERT 정책
CREATE POLICY "Tenant can insert their persons"
ON public.persons
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- UPDATE 정책
CREATE POLICY "Tenant can update their persons"
ON public.persons
FOR UPDATE
TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- DELETE 정책
CREATE POLICY "Tenant can delete their persons"
ON public.persons
FOR DELETE
TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- PostgREST 인식을 위한 권한 부여
GRANT SELECT ON public.persons TO authenticated;
GRANT SELECT ON public.persons TO anon;
GRANT SELECT ON public.persons TO service_role;
GRANT INSERT ON public.persons TO authenticated;
GRANT UPDATE ON public.persons TO authenticated;
GRANT DELETE ON public.persons TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO service_role;

