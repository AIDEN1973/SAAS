-- 사용자 테넌트 관계 복구 스크립트
--
-- [문제] 회원가입 시 user_tenant_roles에 레코드가 생성되지 않아 로그인 불가
-- [해결] RPC 함수를 사용하여 테넌트 생성 및 user_tenant_roles 레코드 추가
--
-- ⚠️ 중요: 이 스크립트는 특정 사용자(user_id)에 대해 실행해야 합니다.
--          사용자 ID를 변경하여 실행하세요.

-- ============================================================================
-- 사용 방법
-- ============================================================================
-- 1. Supabase Dashboard > SQL Editor에서 실행
-- 2. 아래 사용자 ID를 실제 사용자 ID로 변경
-- 3. 업종(industry_type)을 실제 업종으로 변경 ('academy', 'salon', 'real_estate', 'gym', 'ngo')
-- 4. 테넌트 이름(tenant_name)을 실제 이름으로 변경

-- ============================================================================
-- 현재 문제가 있는 사용자
-- ============================================================================
-- User ID: '1eaccca1-c6e4-486a-8d9e-eda746c63b95'
-- Email: 'vanessa@naver.com'

-- ============================================================================
-- 방법 1: RPC 함수 사용 (권장)
-- ============================================================================
-- 이 방법은 테넌트 설정, 기능 설정, 역할 할당을 모두 자동으로 처리합니다.
SELECT create_tenant_with_onboarding(
  p_name := 'vanessa',  -- 테넌트 이름 (이메일에서 추출)
  p_industry_type := 'academy',  -- 업종 ('academy', 'salon', 'real_estate', 'gym', 'ngo')
  p_plan := 'basic',
  p_owner_user_id := '1eaccca1-c6e4-486a-8d9e-eda746c63b95'::uuid,
  p_referral_code := NULL
);

-- ============================================================================
-- 방법 2: 수동 생성 (RPC 함수가 없는 경우)
-- ============================================================================
DO $$
DECLARE
  v_user_id uuid := '1eaccca1-c6e4-486a-8d9e-eda746c63b95'::uuid;
  v_tenant_id uuid;
  v_user_email text;
  v_existing_tenant_id uuid;
BEGIN
  -- 사용자 이메일 확인
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION '사용자를 찾을 수 없습니다: %', v_user_id;
  END IF;

  -- 이미 테넌트가 있는지 확인
  SELECT tenant_id INTO v_existing_tenant_id
  FROM public.user_tenant_roles
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_existing_tenant_id IS NOT NULL THEN
    RAISE NOTICE '이미 테넌트가 연결되어 있습니다: %', v_existing_tenant_id;
    RETURN;
  END IF;

  -- 테넌트 생성 (기본값: 이메일 도메인 기반 이름)
  INSERT INTO public.tenants (name, industry_type, plan, status)
  VALUES (
    COALESCE(SPLIT_PART(v_user_email, '@', 1), 'New Tenant'),
    'academy',  -- ⚠️ 실제 업종으로 변경
    'basic',
    'active'
  )
  RETURNING id INTO v_tenant_id;

  RAISE NOTICE '테넌트 생성됨: %', v_tenant_id;

  -- user_tenant_roles 레코드 추가
  INSERT INTO public.user_tenant_roles (user_id, tenant_id, role)
  VALUES (v_user_id, v_tenant_id, 'owner')
  ON CONFLICT (user_id, tenant_id) DO NOTHING;

  RAISE NOTICE '✅ 사용자 테넌트 관계가 생성되었습니다!';
  RAISE NOTICE '   User ID: %', v_user_id;
  RAISE NOTICE '   Tenant ID: %', v_tenant_id;
  RAISE NOTICE '   Role: owner';
END $$;

-- ============================================================================
-- 확인
-- ============================================================================
SELECT
  utr.user_id,
  utr.tenant_id,
  utr.role,
  t.name AS tenant_name,
  t.industry_type,
  u.email AS user_email
FROM public.user_tenant_roles utr
LEFT JOIN public.tenants t ON t.id = utr.tenant_id
LEFT JOIN auth.users u ON u.id = utr.user_id
WHERE utr.user_id = '1eaccca1-c6e4-486a-8d9e-eda746c63b95'::uuid;

