-- JWT Hook 정밀 검증
-- [목적] Custom Access Token Hook이 제대로 작동하는지 근본 원인 파악

-- ============================================================================
-- 1. Hook 활성화 상태 확인
-- ============================================================================
-- ⚠️ 참고: auth.hooks 테이블은 Supabase 버전에 따라 존재하지 않을 수 있습니다.
--          Supabase Dashboard > Authentication > Hooks에서 수동으로 확인하세요.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'hooks'
  ) THEN
    RAISE NOTICE '✅ auth.hooks 테이블 존재';
  ELSE
    RAISE NOTICE '⚠️ auth.hooks 테이블이 존재하지 않습니다.';
    RAISE NOTICE '   Supabase Dashboard > Authentication > Hooks에서 수동으로 확인하세요.';
  END IF;
END $$;

-- Hook 활성화 상태 확인 (테이블이 있는 경우에만)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'hooks'
  ) THEN
    PERFORM 1;  -- 테이블이 있으면 쿼리 실행
  ELSE
    RAISE NOTICE '⚠️ auth.hooks 테이블이 없으므로 Hook 상태를 확인할 수 없습니다.';
    RAISE NOTICE '   Supabase Dashboard에서 수동으로 확인하세요:';
    RAISE NOTICE '   Dashboard > Authentication > Hooks > Custom Access Token Hook';
  END IF;
END $$;

-- ============================================================================
-- 2. Hook 함수 존재 및 권한 확인
-- ============================================================================
SELECT
  '2. Hook 함수 확인' AS check_step,
  p.proname AS function_name,
  pg_get_userbyid(p.proowner) AS function_owner,
  p.prosecdef AS is_security_definer,
  n.nspname AS schema_name,
  CASE
    WHEN p.prosecdef THEN '✅ SECURITY DEFINER'
    ELSE '❌ 일반 함수'
  END AS security_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'custom_access_token_hook';

-- ============================================================================
-- 3. Hook 함수 권한 확인
-- ============================================================================
SELECT
  '3. Hook 함수 권한' AS check_step,
  grantee::text AS role_name,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'custom_access_token_hook'
  AND grantee = 'supabase_auth_admin';

-- ============================================================================
-- 4. user_tenant_roles 테이블 권한 확인
-- ============================================================================
SELECT
  '4. user_tenant_roles 권한' AS check_step,
  grantee::text AS role_name,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'user_tenant_roles'
  AND grantee IN ('supabase_auth_admin', 'postgres', 'authenticated');

-- ============================================================================
-- 5. Hook 함수 직접 테스트 (시뮬레이션)
-- ============================================================================
DO $$
DECLARE
  test_user_id uuid;
  test_event jsonb;
  test_result jsonb;
  test_error text;
BEGIN
  -- 테스트용 사용자 ID (실제 사용자 ID로 변경 필요)
  -- auth.uid()를 사용할 수 없으므로 직접 지정
  SELECT user_id INTO test_user_id
  FROM public.user_tenant_roles
  LIMIT 1;

  IF test_user_id IS NULL THEN
    RAISE NOTICE '⚠️ 테스트할 사용자가 없습니다. user_tenant_roles 테이블을 확인하세요.';
    RETURN;
  END IF;

  RAISE NOTICE '테스트 사용자 ID: %', test_user_id;

  -- 테스트 이벤트 생성 (실제 Supabase Auth Hook 이벤트 형식)
  test_event := jsonb_build_object(
    'user_id', test_user_id::text,
    'claims', jsonb_build_object(),
    'user_metadata', jsonb_build_object()
  );

  RAISE NOTICE '테스트 이벤트: %', test_event;

  -- Hook 함수 실행
  BEGIN
    test_result := public.custom_access_token_hook(test_event);
    RAISE NOTICE '✅ Hook 실행 성공!';
    RAISE NOTICE '   결과: %', test_result;
    RAISE NOTICE '   tenant_id claim: %', test_result->'claims'->>'tenant_id';
    RAISE NOTICE '   role claim: %', test_result->'claims'->>'role';
  EXCEPTION WHEN OTHERS THEN
    test_error := SQLERRM;
    RAISE WARNING '❌ Hook 실행 실패!';
    RAISE WARNING '   오류: %', test_error;
    RAISE WARNING '   SQLSTATE: %', SQLSTATE;
  END;
END $$;

-- ============================================================================
-- 6. user_tenant_roles 데이터 확인
-- ============================================================================
SELECT
  '6. user_tenant_roles 데이터' AS check_step,
  COUNT(*) AS total_records,
  COUNT(DISTINCT user_id) AS unique_users,
  COUNT(DISTINCT tenant_id) AS unique_tenants
FROM public.user_tenant_roles;

-- 최근 업데이트된 레코드 확인
SELECT
  '6-1. 최근 업데이트된 레코드' AS check_step,
  user_id,
  tenant_id,
  role,
  updated_at,
  created_at
FROM public.user_tenant_roles
ORDER BY updated_at DESC NULLS LAST, created_at DESC
LIMIT 5;

-- ============================================================================
-- 7. Hook 함수 소스 코드 확인
-- ============================================================================
SELECT
  '7. Hook 함수 소스 코드' AS check_step,
  pg_get_functiondef(p.oid) AS function_source
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'custom_access_token_hook';

-- ============================================================================
-- 8. 실제 사용자의 user_tenant_roles 확인 (수동으로 user_id 지정 필요)
-- ============================================================================
-- 아래 쿼리는 실제 사용자 ID로 변경하여 실행하세요
-- SELECT
--   '8. 특정 사용자 확인' AS check_step,
--   utr.user_id,
--   utr.tenant_id,
--   utr.role,
--   utr.updated_at,
--   t.name AS tenant_name
-- FROM public.user_tenant_roles utr
-- LEFT JOIN public.tenants t ON t.id = utr.tenant_id
-- WHERE utr.user_id = 'YOUR_USER_ID_HERE'::uuid
-- ORDER BY utr.updated_at DESC NULLS LAST, utr.created_at ASC;

