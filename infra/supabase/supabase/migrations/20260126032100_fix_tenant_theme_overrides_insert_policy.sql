-- tenant_theme_overrides 테이블 RLS 정책 수정
-- 문제: INSERT 시 403 Forbidden 발생
-- 원인: FOR ALL 정책의 USING 절이 INSERT에 적용되지 않아 WITH CHECK만으로는 부족
-- 해결: INSERT 전용 정책 추가

-- 기존 write 정책 삭제
DROP POLICY IF EXISTS tenant_theme_overrides_write ON public.tenant_theme_overrides;
DROP POLICY IF EXISTS tenant_theme_overrides_insert ON public.tenant_theme_overrides;
DROP POLICY IF EXISTS tenant_theme_overrides_update ON public.tenant_theme_overrides;
DROP POLICY IF EXISTS tenant_theme_overrides_delete ON public.tenant_theme_overrides;

-- INSERT 정책: owner/admin/sub_admin만 허용
-- [주의] JWT claim은 'tenant_role'을 사용 (debug_current_jwt 함수 참조)
CREATE POLICY tenant_theme_overrides_insert ON public.tenant_theme_overrides
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  AND ((auth.jwt() ->> 'tenant_role'::text)) IN ('owner', 'admin', 'sub_admin')
);

-- UPDATE 정책: owner/admin/sub_admin만 허용
CREATE POLICY tenant_theme_overrides_update ON public.tenant_theme_overrides
FOR UPDATE TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  AND ((auth.jwt() ->> 'tenant_role'::text)) IN ('owner', 'admin', 'sub_admin')
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  AND ((auth.jwt() ->> 'tenant_role'::text)) IN ('owner', 'admin', 'sub_admin')
);

-- DELETE 정책: owner/admin만 허용 (더 제한적)
CREATE POLICY tenant_theme_overrides_delete ON public.tenant_theme_overrides
FOR DELETE TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  AND ((auth.jwt() ->> 'tenant_role'::text)) IN ('owner', 'admin')
);

COMMENT ON POLICY tenant_theme_overrides_insert ON public.tenant_theme_overrides IS
'테넌트 테마 생성: JWT claim 기반, owner/admin/sub_admin 허용';

COMMENT ON POLICY tenant_theme_overrides_update ON public.tenant_theme_overrides IS
'테넌트 테마 수정: JWT claim 기반, owner/admin/sub_admin 허용';

COMMENT ON POLICY tenant_theme_overrides_delete ON public.tenant_theme_overrides IS
'테넌트 테마 삭제: JWT claim 기반, owner/admin만 허용';
