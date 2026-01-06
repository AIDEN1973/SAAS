-- tenant_settings 테이블 RLS 정책 수정
-- [문제] INSERT 시 role 체크가 너무 엄격하여 일반 사용자가 설정을 저장할 수 없음
-- [해결] WITH CHECK 절을 완화하여 테넌트 소속 사용자는 모두 설정을 저장할 수 있도록 수정
-- [추가] 수퍼어드민도 모든 테넌트 설정에 접근 가능하도록 수정

-- 기존 정책 삭제
DROP POLICY IF EXISTS tenant_isolation_tenant_settings ON public.tenant_settings;

-- 새로운 RLS 정책 생성
-- SELECT: 테넌트 소속 사용자는 모두 조회 가능, 수퍼어드민은 모든 테넌트 조회 가능
-- INSERT/UPDATE: 테넌트 소속 사용자는 모두 저장 가능, 수퍼어드민은 모든 테넌트 저장 가능
-- [불변 규칙] JWT claim 기반 RLS 사용 (PgBouncer Transaction Pooling 호환)
CREATE POLICY tenant_isolation_tenant_settings ON public.tenant_settings
FOR ALL TO authenticated
USING (
  -- 테넌트 소속 사용자이거나 수퍼어드민인 경우
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
)
WITH CHECK (
  -- 테넌트 소속 사용자이거나 수퍼어드민인 경우
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
WHERE schemaname = 'public' AND tablename = 'tenant_settings';

