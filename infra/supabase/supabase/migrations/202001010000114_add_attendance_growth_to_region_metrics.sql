/**
 * daily_region_metrics에 출석률/성장률 컬럼 추가
 *
 * [불변 규칙] 기술문서 15-3-3 지역 단위 집계 KPI 준수
 * [불변 규칙] 통계문서 238-247줄: analytics.daily_region_metrics 컬럼 정의
 *
 * 통계문서 245줄: avg_attendance_rate (출석률 평균)
 * 통계문서 FR-04: 성장 지표 산출 (월간 학생 성장률, 월간 매출 성장률)
 */

-- analytics 스키마 확인
CREATE SCHEMA IF NOT EXISTS analytics;

-- daily_region_metrics 테이블이 존재하는지 확인 후 컬럼 추가
DO $$
BEGIN
  -- 출석률 평균 컬럼 추가 (통계문서 245줄: avg_attendance_rate)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'avg_attendance_rate'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN avg_attendance_rate numeric(5,2) NULL;  -- 출석률 평균 (0-100)
  END IF;

  -- 출석률 분위수 컬럼 추가 (p25, p75)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'attendance_rate_p25'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN attendance_rate_p25 numeric(5,2) NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'attendance_rate_p75'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN attendance_rate_p75 numeric(5,2) NULL;
  END IF;

  -- 성장률 컬럼 추가 (통계문서 FR-04: 월간 학생 성장률, 월간 매출 성장률)
  -- 학생 성장률 (월간)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'student_growth_rate_avg'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN student_growth_rate_avg numeric(5,2) NULL;  -- 학생 성장률 평균 (%)
  END IF;

  -- 매출 성장률 (월간)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'revenue_growth_rate_avg'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN revenue_growth_rate_avg numeric(5,2) NULL;  -- 매출 성장률 평균 (%)
  END IF;

  -- 성장률 분위수 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'student_growth_rate_p75'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN student_growth_rate_p75 numeric(5,2) NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'analytics'
    AND table_name = 'daily_region_metrics'
    AND column_name = 'revenue_growth_rate_p75'
  ) THEN
    ALTER TABLE analytics.daily_region_metrics
      ADD COLUMN revenue_growth_rate_p75 numeric(5,2) NULL;
  END IF;
END $$;

-- 컬럼 설명 추가 (문서화)
COMMENT ON COLUMN analytics.daily_region_metrics.avg_attendance_rate IS '출석률 평균 (0-100, 통계문서 245줄)';
COMMENT ON COLUMN analytics.daily_region_metrics.attendance_rate_p25 IS '출석률 25분위수';
COMMENT ON COLUMN analytics.daily_region_metrics.attendance_rate_p75 IS '출석률 75분위수 (상위 10% 근사값)';
COMMENT ON COLUMN analytics.daily_region_metrics.student_growth_rate_avg IS '학생 성장률 평균 (%, 통계문서 FR-04)';
COMMENT ON COLUMN analytics.daily_region_metrics.revenue_growth_rate_avg IS '매출 성장률 평균 (%, 통계문서 FR-04)';
COMMENT ON COLUMN analytics.daily_region_metrics.student_growth_rate_p75 IS '학생 성장률 75분위수 (상위 10% 근사값)';
COMMENT ON COLUMN analytics.daily_region_metrics.revenue_growth_rate_p75 IS '매출 성장률 75분위수 (상위 10% 근사값)';

