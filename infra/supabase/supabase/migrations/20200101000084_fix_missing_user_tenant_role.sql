-- 사용자 테넌트 관계 수동 추가 (임시 해결책)
--
-- [문제] 회원가입 시 user_tenant_roles에 레코드가 생성되지 않음
-- [원인] signupB2B 함수에서 테넌트 생성 로직이 TODO로 주석 처리됨
-- [해결] 수동으로 테넌트 생성 및 user_tenant_roles 레코드 추가
--
-- ⚠️ 중요: 이 마이그레이션은 임시 해결책입니다.
--          회원가입 프로세스를 수정하여 자동으로 테넌트가 생성되도록 해야 합니다.

-- ============================================================================
-- 1. 사용자 확인
-- ============================================================================
-- 사용자 ID: '4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd'
SELECT
  id,
  email,
  created_at
FROM auth.users
WHERE id = '4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd'::uuid;

-- ============================================================================
-- 2. 테넌트 생성 (없는 경우)
-- ============================================================================
-- ⚠️ 실제 테넌트 이름과 업종으로 변경해야 합니다
DO $$
DECLARE
  v_user_id uuid := '4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd'::uuid;
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
-- 3. 확인
-- ============================================================================
SELECT
  utr.user_id,
  utr.tenant_id,
  utr.role,
  t.name AS tenant_name,
  t.industry_type
FROM public.user_tenant_roles utr
LEFT JOIN public.tenants t ON t.id = utr.tenant_id
WHERE utr.user_id = '4d66e51d-d4b7-4e09-93ef-6d0f4fa066cd'::uuid;

