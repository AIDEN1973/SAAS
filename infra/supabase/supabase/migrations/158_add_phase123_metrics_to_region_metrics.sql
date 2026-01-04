/**
 * daily_region_metrics에 Phase 1-3 메트릭 컬럼 추가
 *
 * [불변 규칙] 통계문서 FR-02, FR-03, FR-04: 학원 운영·매출·성장 지표
 * [불변 규칙] 기술문서 15-3-3 지역 단위 집계 KPI 준수
 *
 * Phase 1 (MVP):
 * - new_enrollments_avg: 신규 등록 평균 (FR-02)
 * - new_enrollments_p25, new_enrollments_p75: 신규 등록 분위수
 * - arpu_avg: ARPU 평균 (FR-03)
 * - arpu_p25, arpu_p75: ARPU 분위수
 *
 * Phase 2:
 * - capacity_rate_avg: 평균 정원률 (FR-02)
 * - capacity_rate_p25, capacity_rate_p75: 정원률 분위수
 * - overdue_rate_avg: 미납률 평균 (FR-03)
 * - overdue_rate_p25, overdue_rate_p75: 미납률 분위수
 *
 * Phase 3:
 * - churn_rate_avg: 퇴원율 평균 (FR-02)
 * - churn_rate_p25, churn_rate_p75: 퇴원율 분위수
 * - late_rate_avg: 지각률 평균 (FR-02)
 * - late_rate_p25, late_rate_p75: 지각률 분위수
 * - absent_rate_avg: 결석률 평균 (FR-02)
 * - absent_rate_p25, absent_rate_p75: 결석률 분위수
 */

-- analytics 스키마 확인
CREATE SCHEMA IF NOT EXISTS analytics;

-- ============================================================================
-- Phase 1: 신규 등록 (new_enrollments)
-- ============================================================================
DO $$
BEGIN
  -- 신규 등록 평균
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'new_enrollments_avg'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN new_enrollments_avg numeric(8,2) NULL;  -- 신규 등록 평균
  END IF;

  -- 신규 등록 25분위수
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'new_enrollments_p25'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN new_enrollments_p25 numeric(8,2) NULL;
  END IF;

  -- 신규 등록 75분위수
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'new_enrollments_p75'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN new_enrollments_p75 numeric(8,2) NULL;
  END IF;
END $$;

-- ============================================================================
-- Phase 1: ARPU (Average Revenue Per User)
-- ============================================================================
DO $$
BEGIN
  -- ARPU 평균 (이미 avg_arpu가 존재할 수 있으므로 체크)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'arpu_avg'
  ) THEN
    -- avg_arpu가 이미 존재하는지 확인하고 없으면 arpu_avg 추가
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'analytics'
      AND table_name = 'daily_region_metrics'
      AND column_name = 'avg_arpu'
    ) THEN
      -- avg_arpu를 arpu_avg로 rename (일관성 유지)
      ALTER TABLE analytics.daily_region_metrics
        RENAME COLUMN avg_arpu TO arpu_avg;
    ELSE
      ALTER TABLE analytics.daily_region_metrics
        ADD COLUMN arpu_avg numeric(12,2) NULL;
    END IF;
  END IF;

  -- ARPU 25분위수
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'arpu_p25'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN arpu_p25 numeric(12,2) NULL;
  END IF;

  -- ARPU 75분위수
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'arpu_p75'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN arpu_p75 numeric(12,2) NULL;
  END IF;
END $$;

-- ============================================================================
-- Phase 2: 평균 정원률 (capacity_rate)
-- ============================================================================
DO $$
BEGIN
  -- 평균 정원률
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'capacity_rate_avg'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN capacity_rate_avg numeric(5,2) NULL;  -- 정원률 평균 (0-100)
  END IF;

  -- 정원률 25분위수
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'capacity_rate_p25'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN capacity_rate_p25 numeric(5,2) NULL;
  END IF;

  -- 정원률 75분위수
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'capacity_rate_p75'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN capacity_rate_p75 numeric(5,2) NULL;
  END IF;
END $$;

-- ============================================================================
-- Phase 2: 미납률 (overdue_rate)
-- ============================================================================
DO $$
BEGIN
  -- 미납률 평균
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'overdue_rate_avg'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN overdue_rate_avg numeric(5,2) NULL;  -- 미납률 평균 (0-100)
  END IF;

  -- 미납률 25분위수
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'overdue_rate_p25'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN overdue_rate_p25 numeric(5,2) NULL;
  END IF;

  -- 미납률 75분위수
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'overdue_rate_p75'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN overdue_rate_p75 numeric(5,2) NULL;
  END IF;
END $$;

-- ============================================================================
-- Phase 3: 퇴원율 (churn_rate)
-- ============================================================================
DO $$
BEGIN
  -- 퇴원율 평균
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'churn_rate_avg'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN churn_rate_avg numeric(5,2) NULL;  -- 퇴원율 평균 (0-100)
  END IF;

  -- 퇴원율 25분위수
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'churn_rate_p25'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN churn_rate_p25 numeric(5,2) NULL;
  END IF;

  -- 퇴원율 75분위수
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'churn_rate_p75'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN churn_rate_p75 numeric(5,2) NULL;
  END IF;
END $$;

-- ============================================================================
-- Phase 3: 지각률 (late_rate)
-- ============================================================================
DO $$
BEGIN
  -- 지각률 평균
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'late_rate_avg'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN late_rate_avg numeric(5,2) NULL;  -- 지각률 평균 (0-100)
  END IF;

  -- 지각률 25분위수
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'late_rate_p25'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN late_rate_p25 numeric(5,2) NULL;
  END IF;

  -- 지각률 75분위수
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'late_rate_p75'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN late_rate_p75 numeric(5,2) NULL;
  END IF;
END $$;

-- ============================================================================
-- Phase 3: 결석률 (absent_rate)
-- ============================================================================
DO $$
BEGIN
  -- 결석률 평균
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'absent_rate_avg'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN absent_rate_avg numeric(5,2) NULL;  -- 결석률 평균 (0-100)
  END IF;

  -- 결석률 25분위수
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'absent_rate_p25'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN absent_rate_p25 numeric(5,2) NULL;
  END IF;

  -- 결석률 75분위수
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'absent_rate_p75'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN absent_rate_p75 numeric(5,2) NULL;
  END IF;
END $$;

-- ============================================================================
-- 컬럼 설명 추가 (문서화)
-- ============================================================================
COMMENT ON COLUMN analytics.daily_region_metrics.new_enrollments_avg IS '신규 등록 평균 (FR-02, Phase 1)';
COMMENT ON COLUMN analytics.daily_region_metrics.new_enrollments_p25 IS '신규 등록 25분위수';
COMMENT ON COLUMN analytics.daily_region_metrics.new_enrollments_p75 IS '신규 등록 75분위수 (상위 10% 근사값)';

COMMENT ON COLUMN analytics.daily_region_metrics.arpu_avg IS 'ARPU 평균 (학생 1인당 평균 매출, FR-03, Phase 1)';
COMMENT ON COLUMN analytics.daily_region_metrics.arpu_p25 IS 'ARPU 25분위수';
COMMENT ON COLUMN analytics.daily_region_metrics.arpu_p75 IS 'ARPU 75분위수 (상위 10% 근사값)';

COMMENT ON COLUMN analytics.daily_region_metrics.capacity_rate_avg IS '평균 정원률 (현재 인원 / 정원 × 100, FR-02, Phase 2)';
COMMENT ON COLUMN analytics.daily_region_metrics.capacity_rate_p25 IS '정원률 25분위수';
COMMENT ON COLUMN analytics.daily_region_metrics.capacity_rate_p75 IS '정원률 75분위수 (상위 10% 근사값)';

COMMENT ON COLUMN analytics.daily_region_metrics.overdue_rate_avg IS '미납률 평균 (미납액 / 전체 청구액, FR-03, Phase 2)';
COMMENT ON COLUMN analytics.daily_region_metrics.overdue_rate_p25 IS '미납률 25분위수';
COMMENT ON COLUMN analytics.daily_region_metrics.overdue_rate_p75 IS '미납률 75분위수 (상위 10% 근사값)';

COMMENT ON COLUMN analytics.daily_region_metrics.churn_rate_avg IS '퇴원율 평균 (이탈 학생 비율, FR-02, Phase 3)';
COMMENT ON COLUMN analytics.daily_region_metrics.churn_rate_p25 IS '퇴원율 25분위수';
COMMENT ON COLUMN analytics.daily_region_metrics.churn_rate_p75 IS '퇴원율 75분위수 (상위 10% 근사값)';

COMMENT ON COLUMN analytics.daily_region_metrics.late_rate_avg IS '지각률 평균 (지각 / 전체 출석, FR-02, Phase 3)';
COMMENT ON COLUMN analytics.daily_region_metrics.late_rate_p25 IS '지각률 25분위수';
COMMENT ON COLUMN analytics.daily_region_metrics.late_rate_p75 IS '지각률 75분위수 (상위 10% 근사값)';

COMMENT ON COLUMN analytics.daily_region_metrics.absent_rate_avg IS '결석률 평균 (결석 / 전체 출석, FR-02, Phase 3)';
COMMENT ON COLUMN analytics.daily_region_metrics.absent_rate_p25 IS '결석률 25분위수';
COMMENT ON COLUMN analytics.daily_region_metrics.absent_rate_p75 IS '결석률 75분위수 (상위 10% 근사값)';

-- ============================================================================
-- 완료 메시지
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Phase 1-3 메트릭 컬럼 추가 완료!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Phase 1 (MVP):';
  RAISE NOTICE '  - new_enrollments_avg, p25, p75 (신규 등록)';
  RAISE NOTICE '  - arpu_avg, p25, p75 (ARPU)';
  RAISE NOTICE '';
  RAISE NOTICE 'Phase 2:';
  RAISE NOTICE '  - capacity_rate_avg, p25, p75 (정원률)';
  RAISE NOTICE '  - overdue_rate_avg, p25, p75 (미납률)';
  RAISE NOTICE '';
  RAISE NOTICE 'Phase 3:';
  RAISE NOTICE '  - churn_rate_avg, p25, p75 (퇴원율)';
  RAISE NOTICE '  - late_rate_avg, p25, p75 (지각률)';
  RAISE NOTICE '  - absent_rate_avg, p25, p75 (결석률)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ 백엔드 집계 로직 업데이트 필요:';
  RAISE NOTICE '  - daily-statistics-update 함수 수정';
  RAISE NOTICE '  - 지역 통계 집계 시 새 메트릭 계산 로직 추가';
  RAISE NOTICE '';
END $$;
