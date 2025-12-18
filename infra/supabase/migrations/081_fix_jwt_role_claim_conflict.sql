-- JWT role claim 충돌 해결
--
-- [근본 원인] Custom Access Token Hook이 JWT의 'role' claim에 'owner' 값을 설정
--            PostgREST는 JWT의 'role' claim을 PostgreSQL ROLE로 해석하여 SET ROLE 실행
--            그러나 'owner'라는 PostgreSQL ROLE이 없으므로 오류 발생:
--            "role 'owner' does not exist"
--
-- [해결책] 'role' claim 이름을 'tenant_role'로 변경하여 PostgREST와 충돌 방지
--
-- [불변 규칙] JWT의 'role' claim은 PostgreSQL ROLE 전용 (authenticated, anon, service_role)
-- [불변 규칙] 애플리케이션 역할은 'tenant_role' claim에 저장

-- ============================================================================
-- 1. 기존 Hook 함수 삭제
-- ============================================================================
DROP FUNCTION IF EXISTS public.custom_access_token_hook(jsonb);

-- ============================================================================
-- 2. 수정된 Hook 함수 생성 (tenant_role 사용)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  claims jsonb;
  v_user_id uuid;
  user_metadata jsonb;
  user_tenant_id uuid;
  user_tenant_role text;  -- 변수명도 명확하게 변경
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
      INTO user_tenant_role
      FROM public.user_tenant_roles utr
      WHERE utr.user_id = v_user_id
        AND utr.tenant_id = user_tenant_id
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      user_tenant_id := NULL;
      user_tenant_role := NULL;
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
        user_tenant_role
      FROM public.user_tenant_roles utr
      WHERE utr.user_id = v_user_id
      ORDER BY utr.updated_at DESC NULLS LAST, utr.created_at ASC
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      user_tenant_id := NULL;
      user_tenant_role := NULL;
    END;
  END IF;

  -- tenant_id 및 tenant_role claim 추가
  -- [중요] 'role'이 아닌 'tenant_role'을 사용하여 PostgREST 충돌 방지
  IF user_tenant_id IS NOT NULL THEN
    BEGIN
      claims := jsonb_set(claims, '{tenant_id}', to_jsonb(user_tenant_id));
      IF user_tenant_role IS NOT NULL THEN
        -- 'role' 대신 'tenant_role' 사용!
        claims := jsonb_set(claims, '{tenant_role}', to_jsonb(user_tenant_role));
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

-- ============================================================================
-- 4. 함수 소유자 설정 (SECURITY DEFINER용)
-- ============================================================================
ALTER FUNCTION public.custom_access_token_hook(jsonb) OWNER TO postgres;

-- ============================================================================
-- 5. 테스트 함수 업데이트
-- ============================================================================
DROP FUNCTION IF EXISTS public.test_custom_access_token_hook(uuid);

CREATE OR REPLACE FUNCTION public.test_custom_access_token_hook(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  test_event jsonb;
  hook_result jsonb;
  tenant_id_claim uuid;
  tenant_role_claim text;  -- 변경: role_claim -> tenant_role_claim
  final_status text;
BEGIN
  test_event := jsonb_build_object(
    'user_id', p_user_id::text,
    'claims', jsonb_build_object(),
    'user_metadata', jsonb_build_object()
  );

  BEGIN
    hook_result := public.custom_access_token_hook(test_event);
    tenant_id_claim := (hook_result->'claims'->>'tenant_id')::uuid;
    tenant_role_claim := hook_result->'claims'->>'tenant_role';  -- 변경: role -> tenant_role

    IF tenant_id_claim IS NOT NULL THEN
      final_status := '✅ Hook이 정상 작동합니다. tenant_id claim이 추가되었습니다.';
    ELSE
      final_status := '❌ Hook이 작동하지 않습니다. tenant_id claim이 추가되지 않았습니다.';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    final_status := '❌ Hook 실행 중 오류 발생: ' || SQLERRM;
    tenant_id_claim := NULL;
    tenant_role_claim := NULL;
  END;

  RETURN jsonb_build_object(
    'info', '결과 해석',
    'status', final_status,
    'tenant_id_value', tenant_id_claim,
    'tenant_role_value', tenant_role_claim  -- 변경: role_value -> tenant_role_value
  );
END;
$$;

-- ============================================================================
-- 6. PostgREST 스키마 캐시 새로고침
-- ============================================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- 7. 최종 확인
-- ============================================================================
SELECT
  '수정 사항 요약' AS info,
  '기존: claims에 role 추가 → PostgREST가 SET ROLE owner 시도 → 오류' AS problem,
  '수정: claims에 tenant_role 추가 → PostgREST 충돌 없음' AS solution;

