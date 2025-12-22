/**
 * Analytics Metrics 테이블 생성
 *
 * [불변 규칙] 전체 기술문서 5297-5333줄: analytics.daily_store_metrics, analytics.daily_region_metrics 테이블 스키마 정의
 * [불변 규칙] 통계문서 237-255줄: analytics.daily_region_metrics, analytics.daily_store_metrics 컬럼 정의
 * [불변 규칙] 상용화 단계 필수 기능
 *
 * analytics.daily_store_metrics: 매장 단위 일별 KPI (정본, SSOT)
 * analytics.daily_region_metrics: 지역 단위 집계 KPI (정본, SSOT)
 */

-- analytics 스키마 생성
CREATE SCHEMA IF NOT EXISTS analytics;

-- analytics.daily_store_metrics 테이블 생성 (매장 단위 일별 KPI)
CREATE TABLE IF NOT EXISTS analytics.daily_store_metrics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  store_id         uuid REFERENCES core_stores(id) ON DELETE SET NULL, -- 상용화 단계
  student_count    integer NOT NULL DEFAULT 0,
  revenue          numeric(12, 2) NOT NULL DEFAULT 0, -- 일별 매출
  attendance_rate  numeric(5, 2) NOT NULL DEFAULT 0, -- 출석률 (0-100)
  new_enrollments  integer NOT NULL DEFAULT 0, -- 신규 등록 수
  date_kst         date NOT NULL, -- KST 기준 날짜
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()

  -- 중복 방지: 동일 테넌트, 동일 매장(또는 NULL), 동일 날짜는 하나만 존재
  -- store_id가 NULL인 경우도 고려하여 부분 유니크 인덱스 사용
);

CREATE INDEX IF NOT EXISTS idx_daily_store_metrics_tenant_date ON analytics.daily_store_metrics(tenant_id, date_kst DESC);
CREATE INDEX IF NOT EXISTS idx_daily_store_metrics_store_date ON analytics.daily_store_metrics(store_id, date_kst DESC);
CREATE INDEX IF NOT EXISTS idx_daily_store_metrics_date ON analytics.daily_store_metrics(date_kst DESC);

-- 부분 유니크 인덱스: store_id가 NULL이 아닌 경우에만 유니크 제약 적용
CREATE UNIQUE INDEX IF NOT EXISTS ux_daily_store_metrics_tenant_store_date
  ON analytics.daily_store_metrics(tenant_id, store_id, date_kst)
  WHERE store_id IS NOT NULL;

-- store_id가 NULL인 경우: tenant_id + date_kst만 유니크
CREATE UNIQUE INDEX IF NOT EXISTS ux_daily_store_metrics_tenant_date_null_store
  ON analytics.daily_store_metrics(tenant_id, date_kst)
  WHERE store_id IS NULL;

-- analytics.daily_region_metrics 테이블 생성 (지역 단위 집계 KPI)
CREATE TABLE IF NOT EXISTS analytics.daily_region_metrics (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_code           text NOT NULL, -- 지역 코드 (region_level에 따라 의미가 달라짐)
  region_level          text NOT NULL CHECK (region_level IN ('dong', 'gu_gun', 'si', 'nation')), -- 동/읍/면, 구/군, 시/도, 전국
  industry_type         text NOT NULL, -- 업종 타입 (academy, salon, real_estate 등)
  tenant_count          integer NOT NULL DEFAULT 0, -- 학원 수 (store_count >= 3 조건 필요)
  student_count         integer NOT NULL DEFAULT 0, -- 전체 학생 수
  avg_arpu              numeric(12, 2) NOT NULL DEFAULT 0, -- 지역 ARPU
  avg_attendance_rate    numeric(5, 2) NOT NULL DEFAULT 0, -- 출석률 평균 (0-100)
  date_kst              date NOT NULL, -- KST 기준 날짜
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- 중복 방지: 동일 지역, 동일 업종, 동일 날짜는 하나만 존재
  CONSTRAINT ux_daily_region_metrics_region_industry_date UNIQUE (region_code, region_level, industry_type, date_kst)
);

CREATE INDEX IF NOT EXISTS idx_daily_region_metrics_region_date ON analytics.daily_region_metrics(region_code, region_level, industry_type, date_kst DESC);
CREATE INDEX IF NOT EXISTS idx_daily_region_metrics_industry_date ON analytics.daily_region_metrics(industry_type, date_kst DESC);
CREATE INDEX IF NOT EXISTS idx_daily_region_metrics_date ON analytics.daily_region_metrics(date_kst DESC);

-- RLS 활성화
ALTER TABLE analytics.daily_store_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.daily_region_metrics ENABLE ROW LEVEL SECURITY;

-- analytics.daily_store_metrics RLS 정책 (JWT claim 기반, 자기 매장 전용 KPI)
CREATE POLICY tenant_isolation_daily_store_metrics ON analytics.daily_store_metrics
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- analytics.daily_region_metrics RLS 정책 (집계·익명화된 region-level 통계, 자기 업종 + 자기 지역의 통계만)
-- ⚠️ 중요: 이 테이블은 tenant_id 컬럼을 사용하지 않으며, region_code + industry_type으로 필터링
CREATE POLICY industry_region_filter_daily_region_metrics ON analytics.daily_region_metrics
FOR SELECT TO authenticated
USING (
  -- 사용자의 업종과 지역 정보를 JWT claim에서 가져와서 필터링
  -- 실제 구현 시에는 사용자의 store_id를 통해 region_code를 조회하여 필터링
  true -- 일단 모든 인증된 사용자가 접근 가능하도록 설정 (실제 필터링은 애플리케이션 레벨에서 수행)
);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_analytics_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- daily_store_metrics updated_at 트리거
CREATE TRIGGER trigger_update_daily_store_metrics_updated_at
  BEFORE UPDATE ON analytics.daily_store_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_analytics_metrics_updated_at();

-- daily_region_metrics updated_at 트리거
CREATE TRIGGER trigger_update_daily_region_metrics_updated_at
  BEFORE UPDATE ON analytics.daily_region_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_analytics_metrics_updated_at();

-- 기존 마이그레이션 090에서 추가된 컬럼들이 있다면 추가
DO $$
BEGIN
  -- attendance_rate_p25, attendance_rate_p75 (출석률 분위수)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
      AND table_name = 'daily_region_metrics'
      AND column_name = 'attendance_rate_p25'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
    ADD COLUMN attendance_rate_p25 numeric(5, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
      AND table_name = 'daily_region_metrics'
      AND column_name = 'attendance_rate_p75'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
    ADD COLUMN attendance_rate_p75 numeric(5, 2);
  END IF;

  -- student_growth_rate_avg, revenue_growth_rate_avg (성장률 평균)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
      AND table_name = 'daily_region_metrics'
      AND column_name = 'student_growth_rate_avg'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
    ADD COLUMN student_growth_rate_avg numeric(5, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
      AND table_name = 'daily_region_metrics'
      AND column_name = 'revenue_growth_rate_avg'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
    ADD COLUMN revenue_growth_rate_avg numeric(5, 2);
  END IF;

  -- student_growth_rate_p75, revenue_growth_rate_p75 (성장률 75분위수)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
      AND table_name = 'daily_region_metrics'
      AND column_name = 'student_growth_rate_p75'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
    ADD COLUMN student_growth_rate_p75 numeric(5, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
      AND table_name = 'daily_region_metrics'
      AND column_name = 'revenue_growth_rate_p75'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
    ADD COLUMN revenue_growth_rate_p75 numeric(5, 2);
  END IF;
END $$;

-- 컬럼 코멘트 추가
COMMENT ON COLUMN analytics.daily_region_metrics.avg_attendance_rate IS '출석률 평균 (0-100, 통계문서 245줄)';
COMMENT ON COLUMN analytics.daily_region_metrics.attendance_rate_p25 IS '출석률 25분위수';
COMMENT ON COLUMN analytics.daily_region_metrics.attendance_rate_p75 IS '출석률 75분위수 (상위 10% 근사값)';
COMMENT ON COLUMN analytics.daily_region_metrics.student_growth_rate_avg IS '학생 성장률 평균 (%, 통계문서 FR-04)';
COMMENT ON COLUMN analytics.daily_region_metrics.revenue_growth_rate_avg IS '매출 성장률 평균 (%, 통계문서 FR-04)';
COMMENT ON COLUMN analytics.daily_region_metrics.student_growth_rate_p75 IS '학생 성장률 75분위수 (상위 10% 근사값)';
COMMENT ON COLUMN analytics.daily_region_metrics.revenue_growth_rate_p75 IS '매출 성장률 75분위수 (상위 10% 근사값)';

