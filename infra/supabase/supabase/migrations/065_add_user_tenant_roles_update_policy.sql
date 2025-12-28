-- user_tenant_roles 테이블 UPDATE RLS 정책 추가
--
-- [불변 규칙] 사용자는 자신의 user_tenant_roles 레코드의 updated_at만 업데이트할 수 있습니다.
-- [불변 규칙] selectTenant 함수에서 updated_at을 업데이트하여 Custom JWT Claims Hook이
--            가장 최근 선택한 테넌트를 JWT claim에 포함하도록 합니다.
--
-- 참조: infra/supabase/migrations/064_create_custom_jwt_claims.sql

-- 기존 정책 확인
SELECT
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'user_tenant_roles';

-- UPDATE 정책 추가
-- 사용자는 자신의 user_tenant_roles 레코드만 업데이트 가능
-- ⚠️ 중요: role과 tenant_id는 변경할 수 없고, updated_at만 업데이트 가능
CREATE POLICY user_tenant_roles_update ON public.user_tenant_roles
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY user_tenant_roles_update ON public.user_tenant_roles IS
'사용자는 자신의 user_tenant_roles 레코드만 업데이트할 수 있습니다.
selectTenant 함수에서 updated_at을 업데이트하여 Custom JWT Claims Hook이
가장 최근 선택한 테넌트를 JWT claim에 포함하도록 합니다.';

