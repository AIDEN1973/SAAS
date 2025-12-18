-- 실제 사용자로 Hook 함수 테스트
-- 사용자 ID: 4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd

DO $$
DECLARE
  test_user_id uuid := '4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd'::uuid;
  test_event jsonb;
  test_result jsonb;
  expected_tenant_id uuid := 'f8b3974c-0c0f-4411-86cb-ac124e0b0b44'::uuid;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Hook 함수 테스트 시작';
  RAISE NOTICE '========================================';
  RAISE NOTICE '테스트 사용자 ID: %', test_user_id;
  RAISE NOTICE '예상 tenant_id: %', expected_tenant_id;
  RAISE NOTICE '';

  -- user_tenant_roles 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.user_tenant_roles WHERE user_id = test_user_id
  ) THEN
    RAISE WARNING '❌ user_tenant_roles에 레코드가 없습니다!';
    RETURN;
  END IF;

  RAISE NOTICE '✅ user_tenant_roles 데이터 확인 완료';

  -- 테스트 이벤트 생성 (실제 Supabase Auth Hook 형식)
  test_event := jsonb_build_object(
    'user_id', test_user_id::text,
    'claims', jsonb_build_object(),
    'user_metadata', jsonb_build_object()
  );

  RAISE NOTICE '테스트 이벤트 생성 완료';
  RAISE NOTICE '';

  -- Hook 함수 실행
  BEGIN
    test_result := public.custom_access_token_hook(test_event);

    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Hook 실행 성공!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '전체 결과 JSON:';
    RAISE NOTICE '%', test_result::text;
    RAISE NOTICE '';
    RAISE NOTICE 'Claims 분석:';
    RAISE NOTICE '  tenant_id claim: %', test_result->'claims'->>'tenant_id';
    RAISE NOTICE '  role claim: %', test_result->'claims'->>'role';
    RAISE NOTICE '';

    -- 검증
    IF test_result->'claims'->>'tenant_id' IS NOT NULL THEN
      IF (test_result->'claims'->>'tenant_id')::uuid = expected_tenant_id THEN
        RAISE NOTICE '✅ tenant_id claim이 정확하게 추가되었습니다!';
        RAISE NOTICE '   예상값: %', expected_tenant_id;
        RAISE NOTICE '   실제값: %', (test_result->'claims'->>'tenant_id')::uuid;
      ELSE
        RAISE WARNING '⚠️ tenant_id claim이 추가되었지만 값이 다릅니다.';
        RAISE WARNING '   예상값: %', expected_tenant_id;
        RAISE WARNING '   실제값: %', (test_result->'claims'->>'tenant_id')::uuid;
      END IF;
    ELSE
      RAISE WARNING '❌ tenant_id claim이 추가되지 않았습니다!';
      RAISE WARNING '   원인 분석:';
      RAISE WARNING '   1. user_tenant_roles 조회 실패';
      RAISE WARNING '   2. 함수 내부 오류';
      RAISE WARNING '   3. 데이터 형식 문제';
    END IF;

    IF test_result->'claims'->>'role' IS NOT NULL THEN
      RAISE NOTICE '✅ role claim이 추가되었습니다: %', test_result->'claims'->>'role';
    ELSE
      RAISE WARNING '⚠️ role claim이 추가되지 않았습니다.';
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '========================================';
    RAISE WARNING '❌ Hook 실행 실패!';
    RAISE WARNING '========================================';
    RAISE WARNING '오류 메시지: %', SQLERRM;
    RAISE WARNING 'SQLSTATE: %', SQLSTATE;
    RAISE WARNING '';
    RAISE WARNING '가능한 원인:';
    RAISE WARNING '  1. 함수 권한 문제';
    RAISE WARNING '  2. user_tenant_roles 테이블 접근 권한 문제';
    RAISE WARNING '  3. 함수 내부 로직 오류';
  END;

  RAISE NOTICE '========================================';
  RAISE NOTICE '테스트 완료';
  RAISE NOTICE '========================================';
END $$;

