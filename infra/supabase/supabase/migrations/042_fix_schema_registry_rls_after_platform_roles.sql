/**
 * Schema Registry RLS 정책 업데이트
 * 
 * [불변 규칙] user_platform_roles 테이블 생성 후 RLS 정책을 엄격하게 업데이트
 * [불변 규칙] 개발 환경 임시 정책 제거 및 프로덕션 준비
 * 
 * 기술문서: docu/스키마엔진.txt 4. Schema Registry (DB + RLS)
 */

-- 기존 정책 삭제 (임시 정책 포함)
DROP POLICY IF EXISTS schema_registry_read ON meta.schema_registry;
DROP POLICY IF EXISTS schema_registry_write ON meta.schema_registry;
DROP POLICY IF EXISTS tenant_schema_pins_read ON meta.tenant_schema_pins;
DROP POLICY IF EXISTS tenant_schema_pins_write ON meta.tenant_schema_pins;

-- Schema Registry 읽기 정책 (엄격한 버전)
-- user_platform_roles 테이블이 반드시 존재해야 함
CREATE POLICY schema_registry_read ON meta.schema_registry
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'developer', 'qa')
  )
);

-- Schema Registry 쓰기 정책 (엄격한 버전)
-- Super Admin만 쓰기 가능
CREATE POLICY schema_registry_write ON meta.schema_registry
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- Tenant Schema Pins 읽기 정책 (엄격한 버전)
CREATE POLICY tenant_schema_pins_read ON meta.tenant_schema_pins
FOR SELECT TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- Tenant Schema Pins 쓰기 정책 (엄격한 버전)
CREATE POLICY tenant_schema_pins_write ON meta.tenant_schema_pins
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- 주석 추가
COMMENT ON POLICY schema_registry_read ON meta.schema_registry IS 
  'Schema Registry 읽기: super_admin, developer, qa만 허용 (user_platform_roles 기반)';
COMMENT ON POLICY schema_registry_write ON meta.schema_registry IS 
  'Schema Registry 쓰기: super_admin만 허용 (user_platform_roles 기반)';

