/**
 * user_platform_roles RLS 정책 순환 참조 수정
 * 
 * [문제] user_platform_roles_read, user_platform_roles_write 정책에서 순환 참조 발생
 * [원인] 정책 내부에서 다시 user_platform_roles 테이블을 조회하려고 함
 * [해결] 순환 참조를 제거하고 단순한 조건만 사용
 * 
 * [불변 규칙] 자신의 역할만 조회 가능 (user_id = auth.uid())
 * [불변 규칙] 쓰기는 RPC 함수를 통해서만 가능 (SECURITY DEFINER로 RLS 우회)
 */

-- 기존 정책 삭제
DROP POLICY IF EXISTS user_platform_roles_read ON public.user_platform_roles;
DROP POLICY IF EXISTS user_platform_roles_write ON public.user_platform_roles;

-- 수정된 RLS 정책: 순환 참조 제거
-- 자신의 역할만 조회 가능
CREATE POLICY user_platform_roles_read ON public.user_platform_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 쓰기 정책: 직접 쓰기 불가 (RPC 함수를 통해서만 가능)
-- ⚠️ 중요: user_platform_roles 테이블에 직접 INSERT/UPDATE/DELETE는 불가능합니다.
-- 대신 SECURITY DEFINER RPC 함수를 사용하여 RLS를 우회하고 권한을 확인합니다.
-- 이렇게 하면 순환 참조를 방지할 수 있습니다.

-- 주석: Super Admin이 다른 사용자의 역할을 조회/수정해야 하는 경우,
-- 별도의 RPC 함수를 사용하거나 SECURITY DEFINER 함수를 사용해야 합니다.
-- 하지만 일반적으로 자신의 역할만 확인하면 되므로, 이 정책으로 충분합니다.

COMMENT ON POLICY user_platform_roles_read ON public.user_platform_roles IS 
  'Platform RBAC 읽기: 자신의 역할만 조회 가능 (순환 참조 방지)';

