-- tenants 테이블 RLS 정책 수정
-- [문제] tenants 조회 시 RLS 정책이 user_tenant_roles를 참조하는 서브쿼리로 인해 조회 실패
-- [해결] RLS 정책을 확인하고 필요시 수정

-- 1. 현재 RLS 정책 확인
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
WHERE schemaname = 'public' 
  AND tablename = 'tenants';

-- 2. tenants 테이블 권한 확인
SELECT 
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'tenants'
  AND grantee IN ('authenticated', 'anon')
ORDER BY grantee, privilege_type;

-- 3. RLS 정책 재생성
-- [문제] tenants 테이블의 RLS 정책이 user_tenant_roles를 서브쿼리로 참조할 때
-- 서브쿼리 내에서 user_tenant_roles의 RLS 정책이 제대로 적용되지 않을 수 있음
-- [해결] EXISTS를 사용하여 더 명시적으로 작성
DROP POLICY IF EXISTS tenant_isolation_tenants ON public.tenants;

-- [불변 규칙] tenants 테이블의 RLS 정책은 user_tenant_roles를 참조합니다.
-- EXISTS를 사용하면 서브쿼리 내에서 RLS 정책이 더 안정적으로 적용됩니다.
CREATE POLICY tenant_isolation_tenants ON public.tenants
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_tenant_roles
    WHERE user_tenant_roles.tenant_id = tenants.id
      AND user_tenant_roles.user_id = auth.uid()
  )
);

-- 4. 테이블 통계 업데이트
ANALYZE public.tenants;
ANALYZE public.user_tenant_roles;

-- 5. PostgREST 스키마 캐시 강제 새로고침
NOTIFY pgrst, 'reload schema';

-- 6. 최종 확인: RLS 정책이 제대로 생성되었는지 확인
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'tenants';

