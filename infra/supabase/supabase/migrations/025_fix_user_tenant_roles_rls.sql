-- user_tenant_roles 테이블 RLS 정책 수정 (순환 참조 제거)
-- [중요] PostgREST가 테이블을 인식하지 못하는 문제 해결
-- [중요] 순환 참조를 제거하여 RLS 정책을 단순화

-- 1. 기존 정책 삭제
DROP POLICY IF EXISTS user_tenant_roles_isolation ON public.user_tenant_roles;

-- 2. 단순화된 정책 생성 (순환 참조 없음)
-- [중요] 사용자는 자신의 user_id와 일치하는 행만 조회 가능
CREATE POLICY user_tenant_roles_isolation ON public.user_tenant_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 3. PostgREST 스키마 캐시 강제 새로고침
-- [중요] Supabase Dashboard → Settings → API → "Reload schema" 버튼 클릭 필요
NOTIFY pgrst, 'reload schema';

