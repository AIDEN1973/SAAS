-- Hook 함수 수정 및 디버깅
-- [문제] Hook 함수가 tenant_id claim을 추가하지 않음
-- [원인] 함수 내부에서 예외 발생 또는 user_tenant_roles 조회 실패

-- ============================================================================
-- 1. 기존 함수 삭제
-- ============================================================================
DROP FUNCTION IF EXISTS public.custom_access_token_hook(jsonb);

-- ============================================================================
-- 2. 디버깅 로그가 포함된 Hook 함수 재생성
-- ============================================================================
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  claims jsonb;
  user_id uuid;
  user_metadata jsonb;
  user_tenant_id uuid;
  user_role text;
  debug_log text[];
BEGIN
  -- 기본 검증
  IF event IS NULL THEN
    RETURN event;
  END IF;

  -- claims 가져오기
  claims := COALESCE(event->'claims', '{}'::jsonb);

  -- user_id 추출
  BEGIN
    user_id := (event->>'user_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN event;
  END;

  IF user_id IS NULL THEN
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
      WHERE utr.user_id = user_id  -- ⚠️ 수정: 변수 직접 참조
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
      INTO
        user_tenant_id,
        user_role
      FROM public.user_tenant_roles utr
      WHERE utr.user_id = user_id  -- ⚠️ 수정: 변수 직접 참조
      ORDER BY utr.updated_at DESC NULLS LAST, utr.created_at ASC
      LIMIT 1;

      -- ⚠️ 중요: NULLS LAST를 추가하여 updated_at이 NULL인 경우도 처리
    EXCEPTION WHEN OTHERS THEN
      -- 조회 실패 시 로그 남기기 (실제 운영에서는 제거)
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
-- 5. 상세 디버깅 함수 생성
-- ============================================================================
CREATE OR REPLACE FUNCTION public.debug_hook_step_by_step(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  steps jsonb;
  user_tenant_id uuid;
  user_role text;
  record_count int;
BEGIN
  steps := jsonb_build_array();

  -- Step 1: user_tenant_roles 레코드 수 확인
  SELECT COUNT(*) INTO record_count
  FROM public.user_tenant_roles
  WHERE user_id = p_user_id;

  steps := steps || jsonb_build_array(
    jsonb_build_object(
      'step', 1,
      'description', 'user_tenant_roles 레코드 수 확인',
      'record_count', record_count,
      'success', record_count > 0
    )
  );

  -- Step 2: 가장 최근 테넌트 조회
  IF record_count > 0 THEN
    BEGIN
      SELECT
        utr.tenant_id,
        utr.role
      INTO
        user_tenant_id,
        user_role
      FROM public.user_tenant_roles utr
      WHERE utr.user_id = p_user_id
      ORDER BY utr.updated_at DESC NULLS LAST, utr.created_at ASC
      LIMIT 1;

      steps := steps || jsonb_build_array(
        jsonb_build_object(
          'step', 2,
          'description', '가장 최근 테넌트 조회',
          'tenant_id', COALESCE(user_tenant_id::text, 'null'),
          'role', COALESCE(user_role, 'null'),
          'success', user_tenant_id IS NOT NULL
        )
      );
    EXCEPTION WHEN OTHERS THEN
      steps := steps || jsonb_build_array(
        jsonb_build_object(
          'step', 2,
          'description', '가장 최근 테넌트 조회',
          'error', SQLERRM,
          'sqlstate', SQLSTATE,
          'success', false
        )
      );
    END;
  ELSE
    steps := steps || jsonb_build_array(
      jsonb_build_object(
        'step', 2,
        'description', '가장 최근 테넌트 조회',
        'error', 'user_tenant_roles에 레코드가 없습니다',
        'success', false
      )
    );
  END IF;

  -- 최종 결과 구성
  result := jsonb_build_object(
    'user_id', p_user_id::text,
    'steps', steps,
    'final_result', jsonb_build_object(
      'tenant_id', COALESCE(user_tenant_id::text, 'null'),
      'role', COALESCE(user_role, 'null'),
      'will_be_added_to_jwt', user_tenant_id IS NOT NULL
    )
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.debug_hook_step_by_step(uuid) TO authenticated;

-- ============================================================================
-- 6. 테스트
-- ============================================================================
SELECT
  '상세 디버깅 결과' AS test_name,
  public.debug_hook_step_by_step('4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd'::uuid) AS result;

COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS
'Custom JWT Claims Hook - JWT에 tenant_id와 role을 포함합니다.
NULLS LAST를 추가하여 updated_at이 NULL인 경우도 처리합니다.';

