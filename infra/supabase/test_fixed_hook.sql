-- 수정된 Hook 함수 테스트

-- 1. 수정된 Hook 함수 테스트
SELECT
  '수정된 Hook 함수 테스트' AS test_name,
  public.test_custom_access_token_hook('4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd'::uuid) AS result;

-- 2. 결과 해석
SELECT
  '결과 해석' AS info,
  CASE
    WHEN (public.test_custom_access_token_hook('4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd'::uuid)->>'has_tenant_id')::boolean
    THEN '✅ Hook이 정상 작동합니다! tenant_id claim이 추가되었습니다.'
    ELSE '❌ Hook이 작동하지 않습니다. tenant_id claim이 추가되지 않았습니다.'
  END AS status,
  public.test_custom_access_token_hook('4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd'::uuid)->>'tenant_id_claim' AS tenant_id_value,
  public.test_custom_access_token_hook('4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd'::uuid)->>'role_claim' AS role_value;

-- 3. Hook 함수 직접 실행 (단순 버전)
DO $$
DECLARE
  test_user_id uuid := '4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd'::uuid;
  test_event jsonb;
  test_result jsonb;
BEGIN
  test_event := jsonb_build_object(
    'user_id', test_user_id::text,
    'claims', jsonb_build_object(),
    'user_metadata', jsonb_build_object()
  );

  test_result := public.custom_access_token_hook(test_event);

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Hook 함수 직접 실행 결과';
  RAISE NOTICE '========================================';
  RAISE NOTICE '입력 user_id: %', test_user_id;
  RAISE NOTICE '출력 tenant_id claim: %', test_result->'claims'->>'tenant_id';
  RAISE NOTICE '출력 role claim: %', test_result->'claims'->>'role';
  RAISE NOTICE '';

  IF test_result->'claims'->>'tenant_id' IS NOT NULL THEN
    RAISE NOTICE '✅ Hook 함수가 정상 작동합니다!';
    RAISE NOTICE '   tenant_id: %', test_result->'claims'->>'tenant_id';
    RAISE NOTICE '   role: %', test_result->'claims'->>'role';
  ELSE
    RAISE WARNING '❌ Hook 함수가 tenant_id를 추가하지 않았습니다.';
    RAISE WARNING '   전체 결과: %', test_result::text;
  END IF;
  RAISE NOTICE '========================================';
END $$;

