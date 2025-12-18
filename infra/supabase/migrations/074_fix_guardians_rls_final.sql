-- guardians 테이블 RLS 정책 최종 수정
-- [문제] JWT claim에 tenant_id가 없어서 403 오류 발생
-- [해결] JWT claim 기반 RLS는 유지하되, Custom Access Token Hook이 제대로 작동하는지 확인

-- 1. 현재 정책 삭제
DROP POLICY IF EXISTS tenant_isolation_guardians ON public.guardians;

-- 2. JWT claim 기반 RLS 정책 재생성 (super_admin 권한 포함)
CREATE POLICY tenant_isolation_guardians ON public.guardians
FOR ALL TO authenticated
USING (
  -- JWT claim에 tenant_id가 있으면 확인
  (
    (auth.jwt() ->> 'tenant_id') IS NOT NULL
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  )
  -- super_admin이면 모든 테넌트 접근 가능
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
  -- JWT claim에 tenant_id가 없으면 user_tenant_roles 기반으로 확인 (임시 대응)
  OR (
    (auth.jwt() ->> 'tenant_id') IS NULL
    AND tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_roles
      WHERE user_id = auth.uid()
    )
  )
)
WITH CHECK (
  -- JWT claim에 tenant_id가 있으면 확인
  (
    (auth.jwt() ->> 'tenant_id') IS NOT NULL
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  )
  -- super_admin이면 모든 테넌트 접근 가능
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
  -- JWT claim에 tenant_id가 없으면 user_tenant_roles 기반으로 확인 (임시 대응)
  OR (
    (auth.jwt() ->> 'tenant_id') IS NULL
    AND tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_roles
      WHERE user_id = auth.uid()
    )
  )
);

COMMENT ON POLICY tenant_isolation_guardians ON public.guardians IS
'테넌트 격리: JWT claim 우선, 없으면 user_tenant_roles 기반 (Custom Access Token Hook 적용 전 임시 대응)';

-- 3. 기존 마이그레이션과 충돌하는 정책 정리
-- 002_create_students_rls.sql 또는 012_create_academy_related_rls.sql에서 이미 생성된 정책이 있을 수 있음
-- 따라서 DROP POLICY IF EXISTS를 사용하여 안전하게 처리

-- 4. 로그 출력
DO $$
BEGIN
  RAISE NOTICE '✅ guardians 테이블 RLS 정책이 업데이트되었습니다.';
  RAISE NOTICE '   - JWT claim 기반 RLS (우선)';
  RAISE NOTICE '   - user_tenant_roles 기반 RLS (JWT claim 없을 때 임시 대응)';
  RAISE NOTICE '   - super_admin 권한 포함';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ 중요: Custom Access Token Hook이 활성화되면 JWT claim에 tenant_id가 포함됩니다.';
  RAISE NOTICE '   Supabase Dashboard > Authentication > Hooks에서 활성화 확인하세요.';
END $$;

