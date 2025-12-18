-- Custom Access Token Hook 함수 확인 및 재생성
--
-- [목적] Supabase Dashboard에서 함수가 보이지 않는 경우를 대비하여
--        함수 존재 여부를 확인하고 필요시 재생성합니다.

-- ============================================================================
-- 1. 함수 존재 여부 확인
-- ============================================================================
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type,
  l.lanname AS language
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_language l ON p.prolang = l.oid
WHERE n.nspname = 'public'
  AND p.proname = 'custom_access_token_hook'
ORDER BY p.proname;

-- ============================================================================
-- 2. 함수가 없으면 재생성
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
  -- 기존 claims 가져오기
  claims := event->'claims';
  user_id := (event->>'user_id')::uuid;
  user_metadata := event->'user_metadata';

  -- 우선순위 1: user_metadata에서 current_tenant_id 확인
  IF user_metadata IS NOT NULL AND user_metadata ? 'current_tenant_id' THEN
    user_tenant_id := (user_metadata->>'current_tenant_id')::uuid;

    -- user_tenant_roles에서 해당 테넌트의 role 조회
    SELECT utr.role
    INTO user_role
    FROM public.user_tenant_roles utr
    WHERE utr.user_id = custom_access_token_hook.user_id
      AND utr.tenant_id = user_tenant_id
    LIMIT 1;
  END IF;

  -- 우선순위 2: user_metadata에 current_tenant_id가 없으면 user_tenant_roles에서 가장 최근 업데이트된 테넌트 선택
  IF user_tenant_id IS NULL THEN
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
  END IF;

  -- tenant_id claim 추가
  IF user_tenant_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(user_tenant_id));
    IF user_role IS NOT NULL THEN
      claims := jsonb_set(claims, '{role}', to_jsonb(user_role));
    END IF;
  END IF;

  -- 업데이트된 claims 반환
  event := jsonb_set(event, '{claims}', claims);
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
-- 4. 함수 확인 (최종)
-- ============================================================================
SELECT
  '✅ 함수가 생성되었습니다.' AS status,
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'custom_access_token_hook';

COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS
'Custom JWT Claims Hook - JWT에 tenant_id와 role을 포함합니다.
Supabase Dashboard > Authentication > Hooks에서 활성화해야 합니다.
함수 시그니처: (event jsonb) RETURNS jsonb';

