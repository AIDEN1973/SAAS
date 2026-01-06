-- 테넌트 생성 RPC 함수
-- [불변 규칙] 클라이언트에서 테넌트 생성을 위한 RPC 함수
-- [불변 규칙] 서버 클라이언트 권한으로 실행되므로 RLS를 우회합니다.

CREATE OR REPLACE FUNCTION create_tenant_with_onboarding(
  p_name text,
  p_industry_type text,
  p_plan text DEFAULT 'basic',
  p_owner_user_id uuid DEFAULT auth.uid(),
  p_referral_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- 서버 권한으로 실행
AS $$
DECLARE
  v_tenant_id uuid;
  v_tenant jsonb;
  v_user_tenant_role jsonb;
BEGIN
  -- ✅ P0-SEC-3: set_config로 search_path 고정
  PERFORM set_config('search_path', 'public, pg_temp', true);
  -- 1. 테넌트 생성
  INSERT INTO public.tenants (name, industry_type, plan, status)
  VALUES (p_name, p_industry_type, p_plan, 'active')
  RETURNING id INTO v_tenant_id;

  -- 2. 테넌트 기본 설정 초기화
  -- ⚠️ SSOT-2: industry_type은 tenants 테이블이 1차 소스이며, tenant_settings에 저장하지 않음
  -- 아래 'industry' 키는 하위 호환성을 위한 것이며, 실제 industry_type 결정은 tenants 테이블에서 수행
  INSERT INTO public.tenant_settings (tenant_id, key, value)
  VALUES
    (v_tenant_id, 'timezone', '{"timezone": "Asia/Seoul"}'),
    (v_tenant_id, 'locale', '{"locale": "ko-KR"}'),
    (v_tenant_id, 'industry', jsonb_build_object('industry_type', p_industry_type));  -- ⚠️ 하위 호환성용, SSOT는 tenants.industry_type

  -- 3. 테넌트 기능 설정 초기화
  INSERT INTO public.tenant_features (tenant_id, feature_key, enabled, quota)
  VALUES
    (v_tenant_id, 'attendance', true, NULL),
    (v_tenant_id, 'billing', true, NULL),
    (v_tenant_id, 'messaging', p_plan != 'basic', CASE WHEN p_plan = 'basic' THEN 100 ELSE NULL END),
    (v_tenant_id, 'analytics', p_plan != 'basic', NULL);

  -- 4. 소유자 역할 할당
  INSERT INTO public.user_tenant_roles (user_id, tenant_id, role)
  VALUES (p_owner_user_id, v_tenant_id, 'owner')
  RETURNING jsonb_build_object(
    'id', id,
    'user_id', user_id,
    'tenant_id', tenant_id,
    'role', role,
    'created_at', created_at,
    'updated_at', updated_at
  ) INTO v_user_tenant_role;

  -- 5. 테넌트 정보 조회
  SELECT jsonb_build_object(
    'id', id,
    'name', name,
    'industry_type', industry_type,
    'plan', plan,
    'status', status,
    'created_at', created_at,
    'updated_at', updated_at
  ) INTO v_tenant
  FROM public.tenants
  WHERE id = v_tenant_id;

  -- 결과 반환
  RETURN jsonb_build_object(
    'tenant', v_tenant,
    'user_tenant_role', v_user_tenant_role
  );
END;
$$;

-- RPC 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION create_tenant_with_onboarding TO authenticated;

