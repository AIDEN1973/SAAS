-- ============================================
-- 누락된 테이블 생성 SQL (최신 추가분)
-- academy-admin 앱에서 필요한 누락된 테이블들만 포함
-- ============================================

-- ============================================
-- 11. payment_methods (테넌트별 결제 수단 설정)
-- ============================================
-- 아키텍처 문서 3.4.1 섹션 참조: 결제수단 미등록 체크
CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('alimbank', 'toss', 'kg', 'nice', 'other')),
  method_type text NOT NULL CHECK (method_type IN ('card', 'bank_transfer', 'virtual_account', 'easy_pay', 'other')),
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,

  -- Provider별 설정 (JSONB로 저장)
  config jsonb DEFAULT '{}'::jsonb,
  -- 예: alimbank의 경우 { "merchant_id": "...", "api_key": "..." } 등

  -- 메타데이터
  name text,  -- 결제 수단 이름 (예: "기본 카드", "계좌이체")
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant ON payment_methods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant_active ON payment_methods(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_payment_methods_default ON payment_methods(tenant_id, is_default) WHERE is_default = true;

-- RLS 정책
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_methods_read ON payment_methods
FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY payment_methods_write ON payment_methods
FOR ALL TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin', 'sub_admin')
  )
);

CREATE TRIGGER trigger_update_payment_methods_updated_at
BEFORE UPDATE ON payment_methods
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 12. settlements (정산 기록)
-- ============================================
-- 아키텍처 문서 3.4.6 섹션 참조: 정산/회계 기능
CREATE TABLE IF NOT EXISTS settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  settlement_number text NOT NULL,  -- 정산 번호 (고유)
  settlement_period_start date NOT NULL,  -- 정산 기간 시작일
  settlement_period_end date NOT NULL,  -- 정산 기간 종료일
  total_revenue numeric(12, 2) NOT NULL DEFAULT 0,  -- 총 매출
  total_refund numeric(12, 2) NOT NULL DEFAULT 0,  -- 총 환불
  net_revenue numeric(12, 2) NOT NULL DEFAULT 0,  -- 순매출 (총 매출 - 총 환불)
  commission_rate numeric(5, 2),  -- 수수료율 (%)
  commission_amount numeric(12, 2),  -- 수수료 금액
  settlement_amount numeric(12, 2) NOT NULL DEFAULT 0,  -- 정산 금액 (순매출 - 수수료)
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  settled_at timestamptz,  -- 정산 완료일시
  settlement_date date,  -- 정산일

  -- Provider별 정산 정보
  provider text,  -- 정산 제공자 (alimbank, toss 등)
  provider_settlement_id text,  -- Provider의 정산 ID
  provider_settlement_data jsonb DEFAULT '{}'::jsonb,  -- Provider별 정산 상세 데이터

  -- 메타데이터
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),

  UNIQUE(tenant_id, settlement_number)
);

CREATE INDEX IF NOT EXISTS idx_settlements_tenant ON settlements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_settlements_period ON settlements(settlement_period_start, settlement_period_end);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);
CREATE INDEX IF NOT EXISTS idx_settlements_settled_at ON settlements(settled_at DESC);
CREATE INDEX IF NOT EXISTS idx_settlements_tenant_period ON settlements(tenant_id, settlement_period_start DESC);

-- RLS 정책
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY settlements_read ON settlements
FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin', 'sub_admin', 'manager')
  )
);

CREATE POLICY settlements_write ON settlements
FOR ALL TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

CREATE TRIGGER trigger_update_settlements_updated_at
BEFORE UPDATE ON settlements
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 13. analytics.daily_region_metrics (지역 단위 집계 KPI)
-- ============================================
-- 아키텍처 문서 3.6.5 섹션 및 통계문서 참조
-- 전체 기술문서 PART 3 15-3-3 섹션 참조
-- 주의: 이 테이블은 analytics 스키마에 생성되므로, 스키마가 없으면 먼저 생성 필요
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.daily_region_metrics (
  industry_type text NOT NULL CHECK (industry_type IN ('academy', 'salon', 'real_estate', 'gym', 'ngo')),
  region_level text NOT NULL CHECK (region_level IN ('dong', 'gu_gun', 'si', 'nation')),
  region_code text NOT NULL,  -- core_regions.code
  date_kst date NOT NULL,

  store_count integer NOT NULL DEFAULT 0,  -- 해당 지역/업종의 매장 수

  -- 공통 KPI의 통계 값들
  revenue_avg numeric(18, 2) NOT NULL DEFAULT 0,
  revenue_median numeric(18, 2) NOT NULL DEFAULT 0,
  revenue_p25 numeric(18, 2) NOT NULL DEFAULT 0,
  revenue_p75 numeric(18, 2) NOT NULL DEFAULT 0,

  active_members_avg numeric(18, 2) NOT NULL DEFAULT 0,
  active_members_median numeric(18, 2) NOT NULL DEFAULT 0,
  active_members_p25 numeric(18, 2) NOT NULL DEFAULT 0,
  active_members_p75 numeric(18, 2) NOT NULL DEFAULT 0,

  -- 필요 시 업종별 KPI 요약
  lesson_count_avg numeric(18, 2) NULL,  -- 학원: 수업 수 평균
  contract_count_avg numeric(18, 2) NULL,  -- 부동산: 계약 수 평균

  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (industry_type, region_level, region_code, date_kst)
);

CREATE INDEX IF NOT EXISTS idx_daily_region_metrics_industry_region ON analytics.daily_region_metrics(industry_type, region_level, region_code, date_kst);
CREATE INDEX IF NOT EXISTS idx_daily_region_metrics_date ON analytics.daily_region_metrics(date_kst DESC);

-- RLS 정책 (지역 통계는 집계·익명화된 데이터이므로 읽기 전용)
ALTER TABLE analytics.daily_region_metrics ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자가 자기 업종의 지역 통계만 조회 가능
CREATE POLICY daily_region_metrics_read ON analytics.daily_region_metrics
FOR SELECT TO authenticated
USING (
  -- 사용자의 업종과 일치하는 통계만 조회 가능
  industry_type = (
    SELECT t.industry_type
    FROM tenants t
    JOIN user_tenant_roles utr ON t.id = utr.tenant_id
    WHERE utr.user_id = auth.uid()
    LIMIT 1
  )
);

-- ============================================
-- 14. regional_metrics_daily (Materialized View)
-- ============================================
-- 아키텍처 문서 3.6.5 섹션 및 통계문서 참조
-- regional_metrics_daily는 analytics.daily_region_metrics를 기반으로 생성되는 Materialized View
-- 주의: Materialized View는 실제 데이터를 저장하므로, REFRESH MATERIALIZED VIEW 명령으로 주기적으로 갱신 필요
-- 아키텍처 문서 3574줄 참조: 1일 1회 (00:30) 집계

-- Materialized View 생성 (analytics.daily_region_metrics를 기반으로)
-- 참고: Materialized View는 실제 구현 시 더 복잡한 집계 로직이 필요할 수 있음
CREATE MATERIALIZED VIEW IF NOT EXISTS regional_metrics_daily AS
SELECT
  industry_type,
  region_level,
  region_code,
  date_kst,
  store_count,
  revenue_avg,
  revenue_median,
  revenue_p25,
  revenue_p75,
  active_members_avg,
  active_members_median,
  active_members_p25,
  active_members_p75,
  lesson_count_avg,
  contract_count_avg,
  created_at
FROM analytics.daily_region_metrics
WHERE date_kst >= CURRENT_DATE - INTERVAL '90 days'  -- 최근 90일 데이터만 유지
ORDER BY date_kst DESC, industry_type, region_level, region_code;

CREATE UNIQUE INDEX IF NOT EXISTS idx_regional_metrics_daily_pk
ON regional_metrics_daily(industry_type, region_level, region_code, date_kst);

CREATE INDEX IF NOT EXISTS idx_regional_metrics_daily_date
ON regional_metrics_daily(date_kst DESC);

-- RLS 정책 (Materialized View는 읽기 전용)
-- 참고: Materialized View는 RLS를 직접 지원하지 않으므로, 뷰를 통해 접근 제어 필요
-- 실제 구현 시에는 뷰를 통해 RLS를 적용하거나, 애플리케이션 레벨에서 필터링 필요

-- Materialized View 갱신 함수 (Cron Job에서 호출)
CREATE OR REPLACE FUNCTION refresh_regional_metrics_daily()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY regional_metrics_daily;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

