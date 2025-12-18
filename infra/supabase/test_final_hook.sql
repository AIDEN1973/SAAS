-- 최종 Hook 함수 테스트
-- 수정된 Hook 함수가 제대로 작동하는지 확인

-- 1. 수정된 Hook 함수 직접 테스트
DO $$
DECLARE
  test_user_id uuid := '4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd'::uuid;
  test_event jsonb;
  test_result jsonb;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '수정된 Hook 함수 테스트';
  RAISE NOTICE '========================================';
  RAISE NOTICE '테스트 사용자 ID: %', test_user_id;
  RAISE NOTICE '';

  -- 테스트 이벤트 생성
  test_event := jsonb_build_object(
    'user_id', test_user_id::text,
    'claims', jsonb_build_object(),
    'user_metadata', jsonb_build_object()
  );

  RAISE NOTICE '입력 이벤트: %', test_event::text;
  RAISE NOTICE '';

  -- Hook 함수 실행
  BEGIN
    test_result := public.custom_access_token_hook(test_event);

    RAISE NOTICE '✅ Hook 함수 실행 성공!';
    RAISE NOTICE '';
    RAISE NOTICE '출력 결과:';
    RAISE NOTICE '  전체 JSON: %', test_result::text;
    RAISE NOTICE '';
    RAISE NOTICE 'Claims 분석:';
    RAISE NOTICE '  tenant_id claim: %', test_result->'claims'->>'tenant_id';
    RAISE NOTICE '  role claim: %', test_result->'claims'->>'role';
    RAISE NOTICE '';

    -- 검증
    IF test_result->'claims'->>'tenant_id' IS NOT NULL THEN
      RAISE NOTICE '✅✅✅ 성공! tenant_id claim이 추가되었습니다!';
      RAISE NOTICE '   tenant_id: %', test_result->'claims'->>'tenant_id';
      RAISE NOTICE '   role: %', test_result->'claims'->>'role';
      RAISE NOTICE '';
      RAISE NOTICE '다음 단계:';
      RAISE NOTICE '  1. Supabase Dashboard > Authentication > Hooks에서 Hook 활성화 확인';
      RAISE NOTICE '  2. 로그아웃 후 다시 로그인';
      RAISE NOTICE '  3. 브라우저 콘솔에서 await window.debugJWT() 실행';
    ELSE
      RAISE WARNING '❌❌❌ 실패! tenant_id claim이 추가되지 않았습니다!';
      RAISE WARNING '   전체 결과: %', test_result::text;
      RAISE WARNING '';
      RAISE WARNING '문제 해결:';
      RAISE WARNING '  1. Hook 함수 소스 코드 확인';
      RAISE WARNING '  2. user_tenant_roles 데이터 확인';
      RAISE WARNING '  3. 함수 권한 확인';
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ Hook 함수 실행 실패!';
    RAISE WARNING '   오류: %', SQLERRM;
    RAISE WARNING '   SQLSTATE: %', SQLSTATE;
  END;

  RAISE NOTICE '========================================';
END $$;

-- 2. test_custom_access_token_hook 함수로도 테스트
SELECT
  'test_custom_access_token_hook 함수 결과' AS test_name,
  public.test_custom_access_token_hook('4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd'::uuid) AS result;

-- 3. 결과 해석
SELECT
  '최종 결과 해석' AS info,
  CASE
    WHEN (public.test_custom_access_token_hook('4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd'::uuid)->>'has_tenant_id')::boolean
    THEN '✅✅✅ Hook이 정상 작동합니다! tenant_id claim이 추가되었습니다!'
    ELSE '❌❌❌ Hook이 작동하지 않습니다. tenant_id claim이 추가되지 않았습니다.'
  END AS status,
  public.test_custom_access_token_hook('4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd'::uuid)->>'tenant_id_claim' AS tenant_id_value,
  public.test_custom_access_token_hook('4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd'::uuid)->>'role_claim' AS role_value;

