-- 개발 환경용 테넌트 생성
-- [목적] 개발 환경에서 사용하는 임시 tenantId가 실제로 존재하도록 보장
-- [주의] 프로덕션에서는 이 마이그레이션을 실행하지 않아도 됩니다.
-- [방법] SECURITY DEFINER 함수를 사용하여 RLS를 우회하고 개발용 테넌트 생성

-- 개발용 테넌트 생성 함수 (RLS 우회)
CREATE OR REPLACE FUNCTION public.create_dev_tenant()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 개발용 테넌트 생성 (이미 존재하면 무시)
  INSERT INTO public.tenants (id, name, industry_type, plan, status)
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    '개발용 테넌트',
    'academy',
    'basic',
    'active'
  )
  ON CONFLICT (id) DO NOTHING;

  -- 개발용 테넌트 설정 초기화 (이미 존재하면 무시)
  INSERT INTO public.tenant_settings (tenant_id, key, value)
  VALUES
    ('00000000-0000-0000-0000-000000000000', 'timezone', '{"timezone": "Asia/Seoul"}'),
    ('00000000-0000-0000-0000-000000000000', 'locale', '{"locale": "ko-KR"}'),
    ('00000000-0000-0000-0000-000000000000', 'industry', '{"industry_type": "academy"}'),
    ('00000000-0000-0000-0000-000000000000', 'config', '{}')
  ON CONFLICT (tenant_id, key) DO NOTHING;

  -- 개발용 테넌트 기능 설정 초기화 (이미 존재하면 무시)
  INSERT INTO public.tenant_features (tenant_id, feature_key, enabled, quota)
  VALUES
    ('00000000-0000-0000-0000-000000000000', 'attendance', true, NULL),
    ('00000000-0000-0000-0000-000000000000', 'billing', true, NULL),
    ('00000000-0000-0000-0000-000000000000', 'messaging', true, NULL),
    ('00000000-0000-0000-0000-000000000000', 'analytics', true, NULL)
  ON CONFLICT (tenant_id, feature_key) DO NOTHING;
END;
$$;

-- 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION public.create_dev_tenant() TO authenticated, anon;

-- 함수 실행하여 개발용 테넌트 생성
SELECT public.create_dev_tenant();

-- 확인
SELECT
  '개발용 테넌트 생성 완료' AS status,
  id,
  name,
  industry_type,
  status
FROM public.tenants
WHERE id = '00000000-0000-0000-0000-000000000000';

