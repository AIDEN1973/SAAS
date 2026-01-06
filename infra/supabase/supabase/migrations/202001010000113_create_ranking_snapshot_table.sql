/**
 * ranking_snapshot 테이블 생성
 *
 * [불변 규칙] 통계문서 2.3 DB 스키마(High-level) 준수
 * [불변 규칙] region_code는 region_level별 코드의 대표 표기입니다.
 * region_level='dong'일 때는 location_code(행정동 코드)와 동일한 의미입니다.
 * region_level='gu_gun', 'si', 'region_zone' 등 확장 시 각 레벨별 코드 의미가 다릅니다.
 * 정본은 location_code이며, region_code는 region_level별 코드의 대표 표기로 사용됩니다 (아키텍처 문서 정본 참조)
 *
 * 통계문서 253-256줄:
 * 📌 ranking_snapshot
 * | region_code | tenant_id | metric | percentile | rank | date |
 * ⚠️ 참고: region_code는 region_level별 코드의 대표 표기입니다. region_level='dong'일 때는 location_code와 동일한 의미입니다 (아키텍처 문서 정본 참조).
 */

-- analytics 스키마 생성 (없는 경우)
CREATE SCHEMA IF NOT EXISTS analytics;

-- ranking_snapshot 테이블 생성
CREATE TABLE IF NOT EXISTS analytics.ranking_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_code text NOT NULL,  -- ⚠️ SSOT: region_code는 region_level별 코드의 대표 표기. region_level='dong'일 때는 location_code와 동일한 의미 (아키텍처 문서 정본 참조)
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  metric text NOT NULL CHECK (metric IN ('students', 'revenue', 'attendance', 'growth')),
  percentile numeric(5,2) NOT NULL CHECK (percentile >= 0 AND percentile <= 100),  -- 상위 X% (0-100)
  rank integer NOT NULL CHECK (rank >= 1),  -- 순위 (1부터 시작)
  date_kst date NOT NULL,  -- KST 기준 날짜
  created_at timestamptz NOT NULL DEFAULT now(),

  -- 동일 날짜/지역/테넌트/지표 조합은 중복 방지
  UNIQUE(region_code, tenant_id, metric, date_kst)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_ranking_snapshot_region_metric_date
  ON analytics.ranking_snapshot(region_code, metric, date_kst DESC);

CREATE INDEX IF NOT EXISTS idx_ranking_snapshot_tenant_date
  ON analytics.ranking_snapshot(tenant_id, date_kst DESC);

CREATE INDEX IF NOT EXISTS idx_ranking_snapshot_metric_date
  ON analytics.ranking_snapshot(metric, date_kst DESC);

-- RLS 정책: 테넌트는 자신의 랭킹만 조회 가능
ALTER TABLE analytics.ranking_snapshot ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (재실행 시 오류 방지)
DROP POLICY IF EXISTS ranking_snapshot_select ON analytics.ranking_snapshot;

-- JWT claim 기반 RLS 정책 (PgBouncer Transaction Pooling 호환)
-- ⚠️ 중요: current_setting 대신 auth.jwt() 사용 (Transaction Pooling 호환)
CREATE POLICY ranking_snapshot_select ON analytics.ranking_snapshot
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

-- PostgREST 노출 (analytics 스키마는 이미 노출되어 있어야 함)
-- 필요 시 별도 마이그레이션에서 처리

