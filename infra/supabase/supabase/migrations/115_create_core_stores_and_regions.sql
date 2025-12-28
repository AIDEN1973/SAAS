/**
 * Core Stores 및 Regions 테이블 생성
 *
 * [불변 규칙] 전체 기술문서 653-717줄: core_stores, core_regions 테이블 스키마 정의
 * [불변 규칙] JWT claim 기반 RLS 사용 (PgBouncer Transaction Pooling 호환)
 * [불변 규칙] 상용화 단계 필수 기능
 *
 * Region은 Core Layer의 공통 차원(Dimension)이고,
 * Industry Layer(학원, 부동산 등)는 이 Region을 그대로 공용으로 사용합니다.
 */

-- 지역 계층 테이블 (Core Layer 공통)
CREATE TABLE IF NOT EXISTS core_regions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level           text NOT NULL CHECK (level IN ('dong', 'gu_gun', 'si', 'nation')), -- 동/읍/면, 구/군, 시/도, 전국
  code            text NOT NULL,    -- 행정안전부 행정구역 코드 등
  name_ko         text NOT NULL,
  parent_id       uuid NULL REFERENCES core_regions(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_core_regions_level_code
  ON core_regions(level, code);

CREATE INDEX IF NOT EXISTS idx_core_regions_parent ON core_regions(parent_id);

-- 매장(Store) 테이블
CREATE TABLE IF NOT EXISTS core_stores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            text NOT NULL,
  industry_type   text NOT NULL,    -- tenants.industry_type과 동일
  region_id       uuid NOT NULL REFERENCES core_regions(id),  -- 매장이 속한 기준 지역(보통 동/읍/면)
  latitude        double precision,  -- 지도 렌더링용 위도 (WGS84)
  longitude       double precision, -- 지도 렌더링용 경도 (WGS84)
  address         text,
  phone           text,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_core_stores_tenant ON core_stores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_core_stores_region ON core_stores(region_id);
CREATE INDEX IF NOT EXISTS idx_core_stores_industry_region ON core_stores(industry_type, region_id);

-- RLS 활성화
ALTER TABLE core_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_regions ENABLE ROW LEVEL SECURITY;

-- core_stores RLS 정책 (JWT claim 기반)
CREATE POLICY tenant_isolation_core_stores ON core_stores
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- core_regions RLS 정책 (공용 읽기 전용, 모든 인증된 사용자 접근 가능)
CREATE POLICY public_read_core_regions ON core_regions
FOR SELECT TO authenticated
USING (true);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_core_stores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_core_stores_updated_at
  BEFORE UPDATE ON core_stores
  FOR EACH ROW
  EXECUTE FUNCTION update_core_stores_updated_at();

