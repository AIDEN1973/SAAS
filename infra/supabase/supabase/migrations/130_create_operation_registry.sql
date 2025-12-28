-- Operation Registry 테이블 생성
-- 액티비티.md 8.A.1, 8.A.2 섹션 참조
-- 목적: 허용 operation_type과 details allowlist를 강제하는 정본 데이터

-- ============================================================================
-- 8.A.1 정본 위치: DB 정본 (meta.operation_registry)
-- ============================================================================

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

-- ============================================================================
-- 8.A.2 최소 스키마: meta.operation_registry
-- ============================================================================
CREATE TABLE IF NOT EXISTS meta.operation_registry (
  operation_type text PRIMARY KEY, -- (선택) prefix 포함, 최종 토큰 kebab-case 고정
  intent_key text, -- Intent Registry의 intent_key와 매핑 (nullable, indexed)
  description text NOT NULL,
  pii_risk text NOT NULL CHECK (pii_risk IN ('low', 'medium', 'high')),
  default_summary_template text, -- UI/로그 요약 템플릿
  allowed_details_keys jsonb NOT NULL DEFAULT '{}'::jsonb, -- details allowlist "셋(set)"
  allowed_reference_keys jsonb, -- reference 확장 키 제한(필요 시)
  is_enabled bool NOT NULL DEFAULT true, -- 운영 중 비활성화 가능(정책과 별개로 "운영 차단"도 가능)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- intent_key 인덱스 (액티비티.md 8.A.2 참조)
-- UNIQUE 제약: intent_key와 operation_type의 1:1 매핑 보장
CREATE UNIQUE INDEX IF NOT EXISTS ux_operation_registry_intent_key
ON meta.operation_registry(intent_key)
WHERE intent_key IS NOT NULL;

-- 인덱스: is_enabled 필터링 최적화
CREATE INDEX IF NOT EXISTS idx_operation_registry_is_enabled
ON meta.operation_registry(is_enabled)
WHERE is_enabled = true;

-- ============================================================================
-- RLS 정책
-- ============================================================================
ALTER TABLE meta.operation_registry ENABLE ROW LEVEL SECURITY;

-- operation_registry RLS 정책
-- tenant_scope: global (기본)
-- 읽기: 모든 인증된 사용자 (tenant 범위 무관)
-- 쓰기: super-admin(플랫폼 운영)만 가능
DROP POLICY IF EXISTS operation_registry_read_policy ON meta.operation_registry;
CREATE POLICY operation_registry_read_policy ON meta.operation_registry
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS operation_registry_write_policy ON meta.operation_registry;
CREATE POLICY operation_registry_write_policy ON meta.operation_registry
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_platform_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_platform_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- ============================================================================
-- 권한 설정
-- ============================================================================
-- meta 스키마 권한은 이미 041_expose_meta_schema.sql에서 설정됨
-- 하지만 명시적으로 권한 부여 (RLS 정책에 따라 실제 접근은 제한됨)
GRANT SELECT, INSERT, UPDATE, DELETE ON meta.operation_registry TO authenticated;
GRANT SELECT ON meta.operation_registry TO anon;  -- RLS 정책에 따라 실제 접근은 제한됨

-- ============================================================================
-- COMMENT
-- ============================================================================
COMMENT ON TABLE meta.operation_registry IS 'Operation Registry 테이블 (액티비티.md 8.A.1, 8.A.2 참조)';
COMMENT ON COLUMN meta.operation_registry.operation_type IS '작업 타입 (kebab-case, 예: send-sms, messaging.send-sms)';
COMMENT ON COLUMN meta.operation_registry.intent_key IS 'Intent Registry의 intent_key와 매핑 (nullable, 1:1 매핑 보장)';
COMMENT ON COLUMN meta.operation_registry.allowed_details_keys IS 'details allowlist "셋(set)" (예: {"message_id": true, "vendor_message_id": true})';
COMMENT ON COLUMN meta.operation_registry.pii_risk IS 'PII 위험도 (low/medium/high)';

