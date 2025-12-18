-- JWT Hook 간단 검증 쿼리
-- auth.hooks 테이블이 없는 경우에도 작동

-- ============================================================================
-- 1. Hook 함수 존재 확인
-- ============================================================================
SELECT
  '1. Hook 함수 존재 확인' AS check_step,
  p.proname AS function_name,
  pg_get_userbyid(p.proowner) AS function_owner,
  p.prosecdef AS is_security_definer,
  CASE
    WHEN p.prosecdef THEN '✅ SECURITY DEFINER'
    ELSE '❌ 일반 함수'
  END AS security_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'custom_access_token_hook';

-- ============================================================================
-- 2. Hook 함수 직접 테스트 (실제 사용자 ID 필요)
-- ============================================================================
-- ⚠️ 중요: 아래 쿼리에서 'YOUR_USER_ID_HERE'를 실제 사용자 ID로 변경하세요
-- 사용자 ID 확인 방법:
--   SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;

DO $$
DECLARE
  test_user_id uuid;
  test_event jsonb;
  test_result jsonb;
  test_error text;
BEGIN
  -- 실제 사용자 ID로 변경 필요
  -- 예: test_user_id := '4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd'::uuid;

  -- 또는 가장 최근 사용자 자동 선택
  SELECT id INTO test_user_id
  FROM auth.users
  ORDER BY created_at DESC
  LIMIT 1;

  IF test_user_id IS NULL THEN
    RAISE NOTICE '⚠️ 테스트할 사용자가 없습니다.';
    RETURN;
  END IF;

  RAISE NOTICE '테스트 사용자 ID: %', test_user_id;

  -- user_tenant_roles 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.user_tenant_roles WHERE user_id = test_user_id
  ) THEN
    RAISE NOTICE '⚠️ user_tenant_roles에 레코드가 없습니다.';
    RAISE NOTICE '   사용자 ID: %', test_user_id;
    RETURN;
  END IF;

  -- 테스트 이벤트 생성
  test_event := jsonb_build_object(
    'user_id', test_user_id::text,
    'claims', jsonb_build_object(),
    'user_metadata', jsonb_build_object()
  );

  RAISE NOTICE '테스트 이벤트 생성 완료';

  -- Hook 함수 실행
  BEGIN
    test_result := public.custom_access_token_hook(test_event);

    RAISE NOTICE '✅ Hook 실행 성공!';
    RAISE NOTICE '   결과 JSON: %', test_result::text;
    RAISE NOTICE '   tenant_id claim: %', test_result->'claims'->>'tenant_id';
    RAISE NOTICE '   role claim: %', test_result->'claims'->>'role';

    IF test_result->'claims'->>'tenant_id' IS NOT NULL THEN
      RAISE NOTICE '✅ tenant_id claim이 정상적으로 추가되었습니다!';
    ELSE
      RAISE WARNING '❌ tenant_id claim이 추가되지 않았습니다.';
      RAISE WARNING '   원인: user_tenant_roles 조회 실패 또는 데이터 없음';
    END IF;

  EXCEPTION WHEN OTHERS THEN
    test_error := SQLERRM;
    RAISE WARNING '❌ Hook 실행 실패!';
    RAISE WARNING '   오류: %', test_error;
    RAISE WARNING '   SQLSTATE: %', SQLSTATE;
  END;
END $$;

-- ============================================================================
-- 3. user_tenant_roles 데이터 확인
-- ============================================================================
SELECT
  '3. user_tenant_roles 데이터' AS check_step,
  COUNT(*) AS total_records,
  COUNT(DISTINCT user_id) AS unique_users,
  COUNT(DISTINCT tenant_id) AS unique_tenants
FROM public.user_tenant_roles;

-- 최근 레코드 확인
SELECT
  '3-1. 최근 레코드' AS check_step,
  utr.user_id,
  u.email AS user_email,
  utr.tenant_id,
  t.name AS tenant_name,
  utr.role,
  utr.updated_at
FROM public.user_tenant_roles utr
LEFT JOIN auth.users u ON u.id = utr.user_id
LEFT JOIN public.tenants t ON t.id = utr.tenant_id
ORDER BY utr.updated_at DESC NULLS LAST, utr.created_at DESC
LIMIT 5;

-- ============================================================================
-- 4. Hook 활성화 확인 (Dashboard에서 수동 확인 필요)
-- ============================================================================
SELECT
  '4. Hook 활성화 확인' AS check_step,
  '⚠️ Supabase Dashboard에서 수동 확인 필요' AS status,
  'Dashboard > Authentication > Hooks > Custom Access Token Hook' AS check_location;

