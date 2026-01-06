/**
 * meta 스키마 PostgREST 노출 설정
 * 
 * [불변 규칙] meta.schema_registry를 PostgREST API를 통해 접근 가능하도록 설정
 * [불변 규칙] RLS 정책에 따라 Super Admin만 접근 가능
 * 
 * 기술문서: docu/스키마엔진.txt 4. Schema Registry (DB + RLS)
 */

-- meta 스키마에 대한 권한 부여
GRANT USAGE ON SCHEMA meta TO authenticated, anon;

-- meta.schema_registry 테이블에 대한 권한 부여
GRANT SELECT, INSERT, UPDATE, DELETE ON meta.schema_registry TO authenticated;
GRANT SELECT ON meta.schema_registry TO anon;  -- RLS 정책에 따라 실제 접근은 제한됨

-- meta.tenant_schema_pins 테이블에 대한 권한 부여
GRANT SELECT, INSERT, UPDATE, DELETE ON meta.tenant_schema_pins TO authenticated;
GRANT SELECT ON meta.tenant_schema_pins TO anon;  -- RLS 정책에 따라 실제 접근은 제한됨

-- 향후 생성되는 테이블에 대한 기본 권한 설정
ALTER DEFAULT PRIVILEGES IN SCHEMA meta
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA meta
GRANT SELECT ON TABLES TO anon;

-- 주석 추가
COMMENT ON SCHEMA meta IS 'Schema Registry 및 플랫폼 메타데이터 스키마 (PostgREST 노출)';

