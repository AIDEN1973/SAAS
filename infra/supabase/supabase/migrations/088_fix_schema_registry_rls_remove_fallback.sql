-- RLS 보안 취약점 수정: meta.schema_registry fallback 로직 제거
-- ⚠️ Critical: 이 마이그레이션은 즉시 실행되어야 합니다.
--
-- 문제:
-- - 기존 정책에 user_platform_roles 테이블이 없을 경우 모든 authenticated 사용자에게 접근을 허용하는
--   치명적인 보안 취약점이 포함되어 있습니다.
-- - OR (NOT (EXISTS (...))) fallback 로직이 Platform 스키마 전체 유출을 허용할 수 있습니다.
--
-- 조치:
-- - fallback 로직 완전 제거
-- - user_platform_roles 존재 전제로 변경
-- - 정본 문서(전체 기술문서, 아키텍처 문서)의 "Platform RBAC only" 규칙 준수
--
-- 참고:
-- - 전체 기술문서 PART 18: Platform RBAC vs Tenant RBAC 분리 규칙
-- - 디어쌤 아키텍처.md 0.1: Platform RBAC 적용 범위 문서화

-- schema_registry_read 정책 재생성 (fallback 제거)
DROP POLICY IF EXISTS schema_registry_read ON meta.schema_registry;

CREATE POLICY schema_registry_read ON meta.schema_registry
FOR SELECT TO authenticated
USING (
  -- ✅ 정본: user_platform_roles 존재 전제 (fallback 로직 완전 제거)
  EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'developer', 'qa')
  )
);

COMMENT ON POLICY schema_registry_read ON meta.schema_registry IS
'Platform RBAC only: super_admin, developer, qa만 접근 가능 (fallback 로직 제거)';

-- schema_registry_write 정책 재생성 (fallback 제거)
DROP POLICY IF EXISTS schema_registry_write ON meta.schema_registry;

CREATE POLICY schema_registry_write ON meta.schema_registry
FOR ALL TO authenticated
USING (
  -- ✅ 정본: user_platform_roles 존재 전제 (fallback 로직 완전 제거)
  EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
)
WITH CHECK (
  -- ✅ 정본: user_platform_roles 존재 전제 (fallback 로직 완전 제거)
  EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

COMMENT ON POLICY schema_registry_write ON meta.schema_registry IS
'Platform RBAC only: super_admin만 쓰기 가능 (fallback 로직 제거)';

-- tenant_schema_pins_write 정책도 fallback 제거 (일관성 유지)
DROP POLICY IF EXISTS tenant_schema_pins_write ON meta.tenant_schema_pins;

CREATE POLICY tenant_schema_pins_write ON meta.tenant_schema_pins
FOR ALL TO authenticated
USING (
  -- ✅ 정본: user_platform_roles 존재 전제 (fallback 로직 완전 제거)
  EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
)
WITH CHECK (
  -- ✅ 정본: user_platform_roles 존재 전제 (fallback 로직 완전 제거)
  EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

COMMENT ON POLICY tenant_schema_pins_write ON meta.tenant_schema_pins IS
'Platform RBAC only: super_admin만 쓰기 가능 (fallback 로직 제거)';

-- 검증: 정책이 올바르게 생성되었는지 확인
DO $$
DECLARE
  v_read_policy_exists boolean;
  v_write_policy_exists boolean;
  v_pins_write_policy_exists boolean;
BEGIN
  -- schema_registry_read 정책 확인
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'meta'
      AND tablename = 'schema_registry'
      AND policyname = 'schema_registry_read'
  ) INTO v_read_policy_exists;

  -- schema_registry_write 정책 확인
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'meta'
      AND tablename = 'schema_registry'
      AND policyname = 'schema_registry_write'
  ) INTO v_write_policy_exists;

  -- tenant_schema_pins_write 정책 확인
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'meta'
      AND tablename = 'tenant_schema_pins'
      AND policyname = 'tenant_schema_pins_write'
  ) INTO v_pins_write_policy_exists;

  IF v_read_policy_exists AND v_write_policy_exists AND v_pins_write_policy_exists THEN
    RAISE NOTICE '✅ RLS 정책 재생성 완료: fallback 로직 제거됨';
  ELSE
    RAISE WARNING '⚠️ 일부 RLS 정책이 생성되지 않았습니다.';
  END IF;
END $$;

