-- Hook 함수 테스트 (결과를 반환하는 함수 버전)

-- 1. 테스트 함수 생성
CREATE OR REPLACE FUNCTION public.test_custom_access_token_hook(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  test_event jsonb;
  test_result jsonb;
  result jsonb;
BEGIN
  -- 테스트 이벤트 생성
  test_event := jsonb_build_object(
    'user_id', p_user_id::text,
    'claims', jsonb_build_object(),
    'user_metadata', jsonb_build_object()
  );

  -- Hook 함수 실행
  test_result := public.custom_access_token_hook(test_event);

  -- 결과 반환
  result := jsonb_build_object(
    'success', true,
    'input_user_id', p_user_id::text,
    'hook_result', test_result,
    'tenant_id_claim', test_result->'claims'->>'tenant_id',
    'role_claim', test_result->'claims'->>'role',
    'has_tenant_id', (test_result->'claims'->>'tenant_id') IS NOT NULL,
    'has_role', (test_result->'claims'->>'role') IS NOT NULL
  );

  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'sqlstate', SQLSTATE
  );
END;
$$;

-- 2. 실제 사용자로 테스트
SELECT
  'Hook 함수 테스트 결과' AS test_name,
  public.test_custom_access_token_hook('4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd'::uuid) AS result;

-- 3. 결과 해석
SELECT
  '결과 해석' AS info,
  CASE
    WHEN (public.test_custom_access_token_hook('4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd'::uuid)->>'has_tenant_id')::boolean
    THEN '✅ Hook이 정상 작동합니다! tenant_id claim이 추가되었습니다.'
    ELSE '❌ Hook이 작동하지 않습니다. tenant_id claim이 추가되지 않았습니다.'
  END AS status,
  public.test_custom_access_token_hook('4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd'::uuid)->>'tenant_id_claim' AS tenant_id_value,
  public.test_custom_access_token_hook('4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd'::uuid)->>'role_claim' AS role_value;

