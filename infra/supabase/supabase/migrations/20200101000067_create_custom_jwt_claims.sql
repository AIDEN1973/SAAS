-- Custom JWT Claims Hook
--
-- [불변 규칙] JWT claim에 tenant_id를 포함하여 RLS 정책이 올바르게 작동하도록 합니다.
-- [불변 규칙] 이 Hook은 사용자 로그인 시 또는 토큰 새로고침 시 자동으로 실행됩니다.
--
-- 참조: https://supabase.com/docs/guides/auth/auth-hooks#hook-custom-access-token
-- 참조: docu/RLS.txt - guardians, student_classes, student_consultations 테이블은 JWT claim 기반 RLS 사용

-- 1. Custom JWT Claims Function 생성
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

  -- 우선순위 1: user_metadata에서 current_tenant_id 확인 (selectTenant로 선택한 테넌트)
  -- ⚠️ 참고: selectTenant 함수에서 user_metadata를 업데이트하려면 Edge Function이 필요합니다.
  -- 현재는 user_tenant_roles의 가장 최근 업데이트된 테넌트를 선택합니다.
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
  -- ⚠️ 참고: selectTenant 호출 시 user_tenant_roles의 updated_at이 업데이트되면
  --          다음 토큰 새로고침 시 해당 테넌트가 선택됩니다.
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

-- 2. Function에 권한 부여
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

-- 3. supabase_auth_admin이 user_tenant_roles 테이블을 읽을 수 있도록 권한 부여
GRANT SELECT ON TABLE public.user_tenant_roles TO supabase_auth_admin;
GRANT SELECT ON TABLE public.tenants TO supabase_auth_admin;

-- 4. Supabase Auth Hook 활성화
-- ⚠️ 중요: Supabase 버전에 따라 auth.hooks 테이블이 존재하지 않을 수 있습니다.
--          이 경우 Supabase Dashboard에서 수동으로 활성화해야 합니다:
--          Dashboard > Authentication > Hooks > Add Custom Access Token Hook
--
-- Hook 활성화 시도 (auth 스키마에 접근 권한이 있는 경우)
DO $$
BEGIN
  -- auth.hooks 테이블이 존재하는지 확인
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'hooks'
  ) THEN
    -- Hook 활성화
    INSERT INTO auth.hooks (hook_type, hook_name, enabled)
    VALUES ('custom_access_token', 'public.custom_access_token_hook', true)
    ON CONFLICT (hook_type) DO UPDATE
    SET hook_name = EXCLUDED.hook_name, enabled = EXCLUDED.enabled;

    RAISE NOTICE '✅ Custom Access Token Hook이 활성화되었습니다.';
  ELSE
    RAISE WARNING '⚠️  auth.hooks 테이블이 존재하지 않습니다.';
    RAISE WARNING '    Supabase Dashboard에서 수동으로 활성화하세요:';
    RAISE WARNING '    Dashboard > Authentication > Hooks > Add Custom Access Token Hook';
    RAISE WARNING '    Function Name: public.custom_access_token_hook';
  END IF;
END $$;

COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS
'Custom JWT Claims Hook - JWT에 tenant_id와 role을 포함합니다.
Supabase Dashboard > Authentication > Hooks에서 활성화해야 합니다.';

