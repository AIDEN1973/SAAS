-- Hook 함수 수정 (상세 로깅 포함)
-- [문제] Hook 함수가 tenant_id claim을 추가하지 않음
-- [해결] 단계별 로깅 추가하여 정확한 실패 지점 파악

-- ============================================================================
-- 1. 기존 함수 삭제
-- ============================================================================
DROP FUNCTION IF EXISTS public.custom_access_token_hook(jsonb);

-- ============================================================================
-- 2. 상세 로깅이 포함된 Hook 함수 재생성
-- ============================================================================
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  claims jsonb;
  v_user_id uuid;  -- 변수명 변경 (명확성)
  user_metadata jsonb;
  user_tenant_id uuid;
  user_role text;
BEGIN
  -- 기본 검증
  IF event IS NULL THEN
    RETURN event;
  END IF;

  -- claims 가져오기
  claims := COALESCE(event->'claims', '{}'::jsonb);

  -- user_id 추출
  BEGIN
    v_user_id := (event->>'user_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN event;
  END;

  IF v_user_id IS NULL THEN
    RETURN event;
  END IF;

  -- user_metadata 추출
  user_metadata := event->'user_metadata';

  -- 우선순위 1: user_metadata에서 current_tenant_id 확인
  IF user_metadata IS NOT NULL AND user_metadata ? 'current_tenant_id' THEN
    BEGIN
      user_tenant_id := (user_metadata->>'current_tenant_id')::uuid;

      SELECT utr.role
      INTO user_role
      FROM public.user_tenant_roles utr
      WHERE utr.user_id = v_user_id
        AND utr.tenant_id = user_tenant_id
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      user_tenant_id := NULL;
      user_role := NULL;
    END;
  END IF;

  -- 우선순위 2: user_tenant_roles에서 가장 최근 업데이트된 테넌트 선택
  IF user_tenant_id IS NULL THEN
    BEGIN
      SELECT
        utr.tenant_id,
        utr.role
      INTO STRICT  -- STRICT 추가: 결과가 없으면 예외 발생
        user_tenant_id,
        user_role
      FROM public.user_tenant_roles utr
      WHERE utr.user_id = v_user_id
      ORDER BY utr.updated_at DESC NULLS LAST, utr.created_at ASC
      LIMIT 1;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        -- 레코드가 없으면 NULL 유지
        user_tenant_id := NULL;
        user_role := NULL;
      WHEN OTHERS THEN
        -- 기타 오류도 NULL로 처리
        user_tenant_id := NULL;
        user_role := NULL;
    END;
  END IF;

  -- tenant_id claim 추가
  IF user_tenant_id IS NOT NULL THEN
    BEGIN
      claims := jsonb_set(claims, '{tenant_id}', to_jsonb(user_tenant_id));
      IF user_role IS NOT NULL THEN
        claims := jsonb_set(claims, '{role}', to_jsonb(user_role));
      END IF;

      event := jsonb_set(event, '{claims}', claims);
    EXCEPTION WHEN OTHERS THEN
      -- jsonb_set 실패 시 원본 반환
      RETURN event;
    END;
  END IF;

  RETURN event;
END;
$$;

-- ============================================================================
-- 3. 권한 부여
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
GRANT SELECT ON TABLE public.user_tenant_roles TO supabase_auth_admin;
GRANT SELECT ON TABLE public.tenants TO supabase_auth_admin;

-- ============================================================================
-- 4. 함수 소유자 설정
-- ============================================================================
ALTER FUNCTION public.custom_access_token_hook(jsonb) OWNER TO postgres;

-- ============================================================================
-- 5. 테스트 함수 (상세 로깅 포함)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.test_hook_with_logging(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  test_event jsonb;
  test_result jsonb;
  step_log jsonb[];
  current_step text;
BEGIN
  step_log := ARRAY[]::jsonb[];

  -- Step 1: 이벤트 생성
  current_step := '이벤트 생성';
  test_event := jsonb_build_object(
    'user_id', p_user_id::text,
    'claims', jsonb_build_object(),
    'user_metadata', jsonb_build_object()
  );
  step_log := step_log || jsonb_build_array(jsonb_build_object('step', current_step, 'status', 'success', 'data', test_event));

  -- Step 2: Hook 함수 실행
  current_step := 'Hook 함수 실행';
  BEGIN
    test_result := public.custom_access_token_hook(test_event);
    step_log := step_log || jsonb_build_array(jsonb_build_object('step', current_step, 'status', 'success', 'result', test_result));
  EXCEPTION WHEN OTHERS THEN
    step_log := step_log || jsonb_build_array(jsonb_build_object('step', current_step, 'status', 'error', 'error', SQLERRM));
    RETURN jsonb_build_object('success', false, 'steps', step_log, 'error', SQLERRM);
  END;

  -- Step 3: 결과 분석
  current_step := '결과 분석';
  step_log := step_log || jsonb_build_array(jsonb_build_object(
    'step', current_step,
    'status', 'success',
    'tenant_id_claim', test_result->'claims'->>'tenant_id',
    'role_claim', test_result->'claims'->>'role',
    'has_tenant_id', (test_result->'claims'->>'tenant_id') IS NOT NULL
  ));

  RETURN jsonb_build_object(
    'success', true,
    'steps', step_log,
    'final_result', jsonb_build_object(
      'tenant_id_claim', test_result->'claims'->>'tenant_id',
      'role_claim', test_result->'claims'->>'role',
      'has_tenant_id', (test_result->'claims'->>'tenant_id') IS NOT NULL
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.test_hook_with_logging(uuid) TO authenticated;

-- ============================================================================
-- 6. 테스트 실행
-- ============================================================================
SELECT
  '상세 로깅 테스트' AS test_name,
  public.test_hook_with_logging('4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd'::uuid) AS result;

COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS
'Custom JWT Claims Hook - JWT에 tenant_id와 role을 포함합니다.
변수명을 v_user_id로 변경하여 명확성 향상.
STRICT 모드 추가하여 NO_DATA_FOUND 예외 처리.';

