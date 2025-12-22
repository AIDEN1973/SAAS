/**
 * meta 스키마 테이블 생성 확인 및 수정
 *
 * [불변 규칙] meta.schema_registry와 meta.tenant_schema_pins 테이블이 제대로 생성되었는지 확인
 * [불변 규칙] 기술문서 docu/스키마엔진.txt 4. Schema Registry (DB + RLS) 준수
 *
 * 기술문서: docu/스키마엔진.txt 4. Schema Registry (DB + RLS)
 */

-- meta 스키마가 존재하는지 확인
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'meta') THEN
    CREATE SCHEMA meta;
    RAISE NOTICE 'meta 스키마 생성 완료';
  ELSE
    RAISE NOTICE 'meta 스키마 이미 존재';
  END IF;
END $$;

-- schema_registry 테이블이 존재하는지 확인 및 생성
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'meta'
    AND table_name = 'schema_registry'
  ) THEN
    -- 테이블 생성
    CREATE TABLE meta.schema_registry (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      entity text NOT NULL,
      industry_type text,
      version text NOT NULL,
      min_supported_client text,
      min_client text,
      schema_json jsonb NOT NULL,
      migration_script text,
      status text NOT NULL DEFAULT 'draft',
      registered_by uuid REFERENCES auth.users(id),
      registered_at timestamptz NOT NULL DEFAULT now(),
      activated_at timestamptz,
      deprecated_at timestamptz,
      UNIQUE(entity, industry_type, version)
    );

    -- 인덱스 생성
    CREATE INDEX idx_schema_registry_entity ON meta.schema_registry(entity, industry_type, status);
    CREATE INDEX idx_schema_registry_version ON meta.schema_registry(entity, industry_type, version DESC);

    -- RLS 활성화
    ALTER TABLE meta.schema_registry ENABLE ROW LEVEL SECURITY;

    RAISE NOTICE 'meta.schema_registry 테이블 생성 완료';
  ELSE
    RAISE NOTICE 'meta.schema_registry 테이블 이미 존재';

    -- min_client 컬럼이 없으면 추가
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'meta'
      AND table_name = 'schema_registry'
      AND column_name = 'min_client'
    ) THEN
      ALTER TABLE meta.schema_registry ADD COLUMN min_client text;
      COMMENT ON COLUMN meta.schema_registry.min_client IS '레거시 입력 허용: min_supported_client가 정본, 저장 시 min_supported_client로 정규화';
      RAISE NOTICE 'min_client 컬럼 추가 완료';
    END IF;
  END IF;
END $$;

-- tenant_schema_pins 테이블이 존재하는지 확인 및 생성
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'meta'
    AND table_name = 'tenant_schema_pins'
  ) THEN
    -- tenants 테이블이 존재하는지 확인
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'tenants'
    ) THEN
      RAISE WARNING 'tenants 테이블이 없어 tenant_schema_pins 테이블을 생성할 수 없습니다.';
      RETURN;
    END IF;

    -- 테이블 생성
    CREATE TABLE meta.tenant_schema_pins (
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

    -- 인덱스 생성
    CREATE INDEX idx_tenant_schema_pins_tenant ON meta.tenant_schema_pins(tenant_id, entity);
    CREATE INDEX idx_tenant_schema_pins_version ON meta.tenant_schema_pins(entity, industry_type, pinned_version);

    -- RLS 활성화
    ALTER TABLE meta.tenant_schema_pins ENABLE ROW LEVEL SECURITY;

    RAISE NOTICE 'meta.tenant_schema_pins 테이블 생성 완료';
  ELSE
    RAISE NOTICE 'meta.tenant_schema_pins 테이블 이미 존재';
  END IF;
END $$;

-- 권한 부여 (041_expose_meta_schema.sql과 동일)
GRANT USAGE ON SCHEMA meta TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON meta.schema_registry TO authenticated;
GRANT SELECT ON meta.schema_registry TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON meta.tenant_schema_pins TO authenticated;
GRANT SELECT ON meta.tenant_schema_pins TO anon;

-- 최종 확인
DO $$
DECLARE
  v_schema_registry_exists boolean;
  v_tenant_schema_pins_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'meta'
    AND table_name = 'schema_registry'
  ) INTO v_schema_registry_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'meta'
    AND table_name = 'tenant_schema_pins'
  ) INTO v_tenant_schema_pins_exists;

  RAISE NOTICE '=== 테이블 생성 확인 ===';
  RAISE NOTICE 'meta.schema_registry: %', CASE WHEN v_schema_registry_exists THEN '✅ 존재' ELSE '❌ 없음' END;
  RAISE NOTICE 'meta.tenant_schema_pins: %', CASE WHEN v_tenant_schema_pins_exists THEN '✅ 존재' ELSE '❌ 없음' END;

  IF NOT v_schema_registry_exists OR NOT v_tenant_schema_pins_exists THEN
    RAISE WARNING '일부 테이블이 생성되지 않았습니다. 마이그레이션을 다시 확인하세요.';
  END IF;
END $$;

