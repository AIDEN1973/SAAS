-- Custom Access Token Hook 오류 수정
--
-- [문제] Hook 실행 중 오류 발생: "Error running hook URI: pg-functions://postgres/public/custom_access_token_hook"
-- [원인] 함수 내부에서 예외가 발생하거나 권한 문제
-- [해결] 에러 핸들링 추가 및 안전한 함수 재작성

-- ============================================================================
-- 1. 기존 함수 삭제
-- ============================================================================
DROP FUNCTION IF EXISTS public.custom_access_token_hook(jsonb);

-- ============================================================================
-- 2. 개선된 함수 재생성 (에러 핸들링 포함)
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
BEGIN
  -- 기본 검증: event가 null이면 그대로 반환
  IF event IS NULL THEN
    RETURN event;
  END IF;

  -- claims 가져오기 (기본값: 빈 jsonb)
  claims := COALESCE(event->'claims', '{}'::jsonb);

  -- user_id 추출
  BEGIN
    user_id := (event->>'user_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    -- user_id가 없거나 잘못된 형식이면 그대로 반환
    RETURN event;
  END;

  -- user_id가 없으면 그대로 반환
  IF user_id IS NULL THEN
    RETURN event;
  END IF;

  -- user_metadata 추출
  user_metadata := event->'user_metadata';

  -- 우선순위 1: user_metadata에서 current_tenant_id 확인
  IF user_metadata IS NOT NULL AND user_metadata ? 'current_tenant_id' THEN
    BEGIN
      user_tenant_id := (user_metadata->>'current_tenant_id')::uuid;

      -- user_tenant_roles에서 해당 테넌트의 role 조회
      SELECT utr.role
      INTO user_role
      FROM public.user_tenant_roles utr
      WHERE utr.user_id = custom_access_token_hook.user_id
        AND utr.tenant_id = user_tenant_id
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      -- 조회 실패 시 무시하고 다음 단계로
      user_tenant_id := NULL;
      user_role := NULL;
    END;
  END IF;

  -- 우선순위 2: user_metadata에 current_tenant_id가 없으면 user_tenant_roles에서 가장 최근 업데이트된 테넌트 선택
  IF user_tenant_id IS NULL THEN
    BEGIN
      SELECT
        utr.tenant_id,
        utr.role
      INTO
        user_tenant_id,
        user_role
      FROM public.user_tenant_roles utr
      WHERE utr.user_id = custom_access_token_hook.user_id
      ORDER BY utr.updated_at DESC, utr.created_at ASC
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      -- 조회 실패 시 tenant_id 없이 진행
      user_tenant_id := NULL;
      user_role := NULL;
    END;
  END IF;

  -- tenant_id claim 추가 (있는 경우에만)
  IF user_tenant_id IS NOT NULL THEN
    BEGIN
      claims := jsonb_set(claims, '{tenant_id}', to_jsonb(user_tenant_id));
      IF user_role IS NOT NULL THEN
        claims := jsonb_set(claims, '{role}', to_jsonb(user_role));
      END IF;

      -- 업데이트된 claims를 event에 반영
      event := jsonb_set(event, '{claims}', claims);
    EXCEPTION WHEN OTHERS THEN
      -- jsonb_set 실패 시 원본 event 반환
      RETURN event;
    END;
  END IF;

  -- 업데이트된 event 반환
  RETURN event;
END;
$$;

-- ============================================================================
-- 3. 권한 부여
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO anon;

-- ============================================================================
-- 4. supabase_auth_admin 권한 확인 및 부여
-- ============================================================================
-- user_tenant_roles 테이블 읽기 권한
GRANT SELECT ON TABLE public.user_tenant_roles TO supabase_auth_admin;
GRANT SELECT ON TABLE public.tenants TO supabase_auth_admin;

-- ============================================================================
-- 5. 함수 확인
-- ============================================================================
SELECT
  '✅ 함수가 재생성되었습니다.' AS status,
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'custom_access_token_hook';

COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS
'Custom JWT Claims Hook - JWT에 tenant_id와 role을 포함합니다.
에러 핸들링이 추가되어 안전하게 동작합니다.
Supabase Dashboard > Authentication > Hooks에서 활성화해야 합니다.';

