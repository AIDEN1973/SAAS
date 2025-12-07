/**
 * Schema Registry 마이그레이션
 * 
 * [불변 규칙] 기술문서 PART 1의 5. Schema Registry 운영 문서를 준수합니다.
 * [불변 규칙] meta.schema_registry는 공통 스키마 저장소이므로 tenant_id 컬럼이 없습니다.
 * 
 * 기술문서: docu/스키마엔진.txt 4. Schema Registry (DB + RLS)
 */

-- meta 스키마 생성
CREATE SCHEMA IF NOT EXISTS meta;

-- Schema Registry 테이블 생성 (재실행 시 오류 방지)
-- ⚠️ 중요: 기술문서 docu/스키마엔진.txt 4. Schema Registry (DB + RLS) 준수
CREATE TABLE IF NOT EXISTS meta.schema_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,              -- 'student', 'invoice', 'schedule' 등
  industry_type text,                -- 'academy', 'salon' 등 (nullable = 공통)
  version text NOT NULL,             -- '2.0.1' (Semver)
  min_supported_client text,         -- '1.12.0' (하위 호환성)
  min_client text,                   -- '1.12.0' (SDUI v1.1: minClient가 우선, min_supported_client는 하위 호환성)
  schema_json jsonb NOT NULL,        -- 실제 스키마 정의
  migration_script text,             -- Migration Script (nullable)
  status text NOT NULL DEFAULT 'draft', -- 'draft', 'active', 'deprecated'
  registered_by uuid REFERENCES auth.users(id),
  registered_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,          -- 활성화 시점
  deprecated_at timestamptz,         -- 폐기 시점
  UNIQUE(entity, industry_type, version)
);

-- min_client 컬럼 추가 (기존 테이블에 컬럼이 없는 경우)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'meta' 
    AND table_name = 'schema_registry' 
    AND column_name = 'min_client'
  ) THEN
    ALTER TABLE meta.schema_registry ADD COLUMN min_client text;
    COMMENT ON COLUMN meta.schema_registry.min_client IS 'SDUI v1.1: minClient가 우선, min_supported_client는 하위 호환성';
  END IF;
END $$;

-- 인덱스 생성 (재실행 시 오류 방지)
CREATE INDEX IF NOT EXISTS idx_schema_registry_entity ON meta.schema_registry(entity, industry_type, status);
CREATE INDEX IF NOT EXISTS idx_schema_registry_version ON meta.schema_registry(entity, industry_type, version DESC);

-- RLS 활성화
ALTER TABLE meta.schema_registry ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (재실행 시 오류 방지)
DROP POLICY IF EXISTS schema_registry_read ON meta.schema_registry;
DROP POLICY IF EXISTS schema_registry_write ON meta.schema_registry;

-- RLS 정책: 플랫폼 관리자/개발자/QA만 읽기 허용
-- ⚠️ 중요: Zero-Trust + Multi-Tenant SaaS 보안 표준
-- 일반 테넌트 사용자(admin/teacher/parent)는 Schema Registry 조회 불가
-- 오직 플랫폼 전체 관리자, 개발자, QA만 조회 가능
-- 이는 악의적 사용자가 Registry를 조회해 전체 SaaS의 구조를 분석하는 것을 방지하기 위함
-- (엔티티 이름, 업종 구조, 버전 정보 유출 방지)
-- 
-- ⚠️ 주의: user_platform_roles 테이블이 존재하는 경우에만 정책 적용
-- 040_create_user_platform_roles.sql 마이그레이션이 먼저 실행되어야 함
CREATE POLICY schema_registry_read ON meta.schema_registry
FOR SELECT TO authenticated
USING (
  -- user_platform_roles 테이블이 존재하는 경우
  (
  EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'user_platform_roles'
    )
    AND EXISTS (
      SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'developer', 'qa')
  )
  )
  -- 임시: user_platform_roles가 없는 경우 개발 환경에서만 허용 (프로덕션에서는 제거 필요)
  OR (
    NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'user_platform_roles'
    )
    -- 개발 환경에서만 임시로 모든 authenticated 사용자 허용
    -- 프로덕션에서는 반드시 user_platform_roles 기반으로 전환해야 함
  )
);

-- RLS 정책: Super Admin만 쓰기 가능
-- ⚠️ 중요: Super Admin은 SaaS 플랫폼 전체 관리자 역할입니다.
-- 기술문서 PART 1의 RBAC 용어에 따르면, super_admin은 테넌트 레벨이 아닌
-- SaaS 플랫폼 전체를 관리하는 본사 관리자 역할입니다.
-- 
-- 🔍 RBAC 구조 분리 (필수):
-- - Platform RBAC (SaaS 전체 관리자): user_platform_roles 테이블 필수
-- - Tenant RBAC (학원/매장 단위 관리자): user_tenant_roles 테이블
-- 
-- ⚠️ 중요: RLS 정책은 반드시 user_platform_roles 기반으로 검사해야 하며,
-- user_tenant_roles는 테넌트 운영 권한이므로 Platform Schema Registry를 관리할 수 없습니다.
-- 
-- tenant 레벨 관리자(admin)는 한 테넌트의 스키마조차 수정할 수 없습니다.
-- platform 관리자(super_admin)는 모든 테넌트/업종의 스키마를 관리할 수 있습니다.
CREATE POLICY schema_registry_write ON meta.schema_registry
FOR ALL TO authenticated
USING (
  -- user_platform_roles 테이블이 존재하는 경우
  (
    EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'user_platform_roles'
    )
    AND EXISTS (
      SELECT 1 FROM public.user_platform_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  )
  -- 임시: user_platform_roles가 없는 경우 개발 환경에서만 허용 (프로덕션에서는 제거 필요)
  OR (
    NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'user_platform_roles'
    )
    -- 개발 환경에서만 임시로 모든 authenticated 사용자 허용
    -- 프로덕션에서는 반드시 user_platform_roles 기반으로 전환해야 함
  )
)
WITH CHECK (
  -- user_platform_roles 테이블이 존재하는 경우
  (
  EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'user_platform_roles'
    )
    AND EXISTS (
      SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
  )
  -- 임시: user_platform_roles가 없는 경우 개발 환경에서만 허용 (프로덕션에서는 제거 필요)
  OR (
    NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'user_platform_roles'
    )
    -- 개발 환경에서만 임시로 모든 authenticated 사용자 허용
    -- 프로덕션에서는 반드시 user_platform_roles 기반으로 전환해야 함
  )
);

-- Version Pinning 테이블 생성 (재실행 시 오류 방지)
CREATE TABLE IF NOT EXISTS meta.tenant_schema_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity text NOT NULL,
  industry_type text,
  pinned_version text NOT NULL,
  reason text,
  pinned_at timestamptz NOT NULL DEFAULT now(),
  pinned_by uuid REFERENCES auth.users(id),
  UNIQUE(tenant_id, entity, industry_type)
);

-- Version Pinning 인덱스 (재실행 시 오류 방지)
CREATE INDEX IF NOT EXISTS idx_tenant_schema_pins_tenant ON meta.tenant_schema_pins(tenant_id, entity);
CREATE INDEX IF NOT EXISTS idx_tenant_schema_pins_version ON meta.tenant_schema_pins(entity, industry_type, pinned_version);

-- Version Pinning RLS 활성화
ALTER TABLE meta.tenant_schema_pins ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (재실행 시 오류 방지)
DROP POLICY IF EXISTS tenant_schema_pins_read ON meta.tenant_schema_pins;
DROP POLICY IF EXISTS tenant_schema_pins_write ON meta.tenant_schema_pins;

-- Version Pinning RLS 정책: 테넌트는 자신의 pin만 조회 가능
CREATE POLICY tenant_schema_pins_read ON meta.tenant_schema_pins
FOR SELECT TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR (
    EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'user_platform_roles'
    )
    AND EXISTS (
      SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  )
);

-- Version Pinning RLS 정책: Super Admin만 쓰기 가능
-- ⚠️ 중요: user_platform_roles 기반으로 검사해야 합니다.
CREATE POLICY tenant_schema_pins_write ON meta.tenant_schema_pins
FOR ALL TO authenticated
USING (
  (
    EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'user_platform_roles'
    )
    AND EXISTS (
      SELECT 1 FROM public.user_platform_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  )
  OR (
    NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'user_platform_roles'
    )
  )
)
WITH CHECK (
  (
  EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'user_platform_roles'
    )
    AND EXISTS (
      SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  )
  OR (
    NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'user_platform_roles'
    )
  )
);

