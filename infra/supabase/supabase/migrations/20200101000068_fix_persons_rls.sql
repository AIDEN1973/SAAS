-- persons 테이블 RLS 정책 수정
-- [불변 규칙] JWT claim 기반 RLS 사용 (PgBouncer Transaction Pooling 호환)

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Tenant can read their persons" ON public.persons;
DROP POLICY IF EXISTS "Tenant can insert their persons" ON public.persons;
DROP POLICY IF EXISTS "Tenant can update their persons" ON public.persons;
DROP POLICY IF EXISTS "Tenant can delete their persons" ON public.persons;
DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.persons;
DROP POLICY IF EXISTS tenant_isolation_persons ON public.persons;
DROP POLICY IF EXISTS tenant_isolation_persons_select ON public.persons;
DROP POLICY IF EXISTS tenant_isolation_persons_insert ON public.persons;
DROP POLICY IF EXISTS tenant_isolation_persons_update ON public.persons;
DROP POLICY IF EXISTS tenant_isolation_persons_delete ON public.persons;

-- 새로운 RLS 정책 생성
-- SELECT: 테넌트 소속 사용자는 자신의 테넌트 데이터 조회 가능, 수퍼어드민은 모든 테넌트 조회 가능
-- [불변 규칙] JWT claim 기반 RLS 사용 (PgBouncer Transaction Pooling 호환)
CREATE POLICY tenant_isolation_persons_select ON public.persons
FOR SELECT TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- INSERT: 테넌트 소속 사용자는 자신의 테넌트에 데이터 생성 가능, 수퍼어드민은 모든 테넌트에 생성 가능
CREATE POLICY tenant_isolation_persons_insert ON public.persons
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- UPDATE: 테넌트 소속 사용자는 자신의 테넌트 데이터 수정 가능, 수퍼어드민은 모든 테넌트 데이터 수정 가능
CREATE POLICY tenant_isolation_persons_update ON public.persons
FOR UPDATE TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- DELETE: 테넌트 소속 사용자는 자신의 테넌트 데이터 삭제 가능, 수퍼어드민은 모든 테넌트 데이터 삭제 가능
CREATE POLICY tenant_isolation_persons_delete ON public.persons
FOR DELETE TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- 정책 확인
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'persons'
ORDER BY policyname;

