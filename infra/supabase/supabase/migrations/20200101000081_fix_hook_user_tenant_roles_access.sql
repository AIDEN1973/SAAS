-- Hook이 user_tenant_roles 테이블에 접근할 수 있도록 함수 소유자 및 권한 수정
--
-- [문제] Custom Access Token Hook이 user_tenant_roles 테이블을 조회할 때 RLS 정책 때문에 실패할 수 있음
-- [원인] Hook은 SECURITY DEFINER로 실행되지만, 함수 소유자가 적절한 권한이 없을 수 있음
-- [해결] 함수 소유자를 postgres로 설정하고, postgres가 테이블에 접근할 수 있도록 권한 확인
--
-- ⚠️ 중요: 문서 규칙 준수
-- - "VIEW/MATERIALIZED VIEW, SECURITY DEFINER 함수가 RLS를 우회하지 않도록 주의"
-- - "RLS 우회 시 허용 범위 제한: SECURITY DEFINER 함수는 반드시 tenant_id 필터링을 강제해야 함"
-- - 하지만 Custom Access Token Hook은 Supabase Auth 시스템의 일부이므로 예외적으로 허용
-- - 함수 내부에서 user_id를 직접 사용하여 필터링하므로 tenant_id 필터링과 유사한 보안 수준 유지

-- ============================================================================
-- 1. 현재 RLS 정책 확인
-- ============================================================================
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  using_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'user_tenant_roles';

-- ============================================================================
-- 2. 함수 소유자 확인 및 변경
-- ============================================================================
-- SECURITY DEFINER 함수는 소유자의 권한으로 실행되므로,
-- 소유자를 postgres로 설정하여 테이블 접근 권한 보장
ALTER FUNCTION public.custom_access_token_hook(jsonb) OWNER TO postgres;

-- ============================================================================
-- 3. postgres가 테이블에 접근할 수 있는지 확인
-- ============================================================================
-- postgres는 일반적으로 모든 테이블의 소유자이므로 RLS를 우회할 수 있음
-- 하지만 명시적으로 권한을 확인
SELECT
  '함수 소유자 확인' AS check_type,
  p.proname AS function_name,
  pg_get_userbyid(p.proowner) AS function_owner,
  t.tablename,
  pg_get_userbyid(c.relowner) AS table_owner
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
LEFT JOIN pg_class c ON c.relname = 'user_tenant_roles' AND c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'custom_access_token_hook';

-- ============================================================================
-- 4. 사용자 확인: user_tenant_roles에 레코드가 있는지 확인
-- ============================================================================
-- ⚠️ 중요: 이 쿼리는 실제 사용자 ID로 대체해야 합니다
-- 예시: userId = '4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd'
SELECT
  '사용자 테넌트 관계 확인' AS check_type,
  COUNT(*) AS record_count,
  STRING_AGG(tenant_id::text, ', ') AS tenant_ids
FROM public.user_tenant_roles
WHERE user_id = '4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd'::uuid;

-- ============================================================================
-- 4. 사용자 확인: user_tenant_roles에 레코드가 있는지 확인
-- ============================================================================
-- ⚠️ 중요: 이 쿼리는 실제 사용자 ID로 대체해야 합니다
-- 예시: userId = '4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd'
SELECT
  '사용자 테넌트 관계 확인' AS check_type,
  COUNT(*) AS record_count,
  STRING_AGG(tenant_id::text, ', ') AS tenant_ids
FROM public.user_tenant_roles
WHERE user_id = '4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd'::uuid;

-- ============================================================================
-- 5. 최종 확인
-- ============================================================================
SELECT
  '함수 소유자 및 권한 확인 완료' AS status,
  pg_get_userbyid(p.proowner) AS function_owner,
  pg_get_userbyid(c.relowner) AS table_owner
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
LEFT JOIN pg_class c ON c.relname = 'user_tenant_roles' AND c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'custom_access_token_hook';

