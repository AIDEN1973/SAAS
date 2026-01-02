/**
 * Analytics 배포 전 사전 점검 스크립트
 *
 * 이 스크립트를 실행하여 데이터베이스가 Analytics 배포를 위한 준비가 되었는지 확인합니다.
 * Migration 141을 실행하기 전에 반드시 실행하세요.
 */

-- ============================================================================
-- 1. analytics 스키마 확인
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name = 'analytics'
  ) THEN
    RAISE EXCEPTION 'analytics 스키마가 존재하지 않습니다. Migration 116을 먼저 실행하세요.';
  END IF;
  RAISE NOTICE '✅ analytics 스키마 존재 확인';
END $$;

-- ============================================================================
-- 2. daily_region_metrics 테이블 확인
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'analytics' AND table_name = 'daily_region_metrics'
  ) THEN
    RAISE EXCEPTION 'analytics.daily_region_metrics 테이블이 존재하지 않습니다. Migration 116을 먼저 실행하세요.';
  END IF;
  RAISE NOTICE '✅ daily_region_metrics 테이블 존재 확인';
END $$;

-- ============================================================================
-- 3. 필수 컬럼 확인
-- ============================================================================
DO $$
DECLARE
  missing_columns text[] := ARRAY[]::text[];
  required_columns text[] := ARRAY[
    'id',
    'region_code',
    'region_level',
    'industry_type',
    'tenant_count',
    'student_count',
    'avg_arpu',
    'avg_attendance_rate',
    'attendance_rate_p25',
    'attendance_rate_p75',
    'student_growth_rate_avg',
    'revenue_growth_rate_avg',
    'student_growth_rate_p75',
    'revenue_growth_rate_p75',
    'date_kst',
    'created_at',
    'updated_at'
  ];
  col text;
BEGIN
  FOREACH col IN ARRAY required_columns LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'analytics'
      AND table_name = 'daily_region_metrics'
      AND column_name = col
    ) THEN
      missing_columns := array_append(missing_columns, col);
    END IF;
  END LOOP;

  IF array_length(missing_columns, 1) > 0 THEN
    RAISE EXCEPTION '다음 컬럼이 누락되었습니다: %. Migration 116을 다시 실행하세요.', array_to_string(missing_columns, ', ');
  END IF;

  RAISE NOTICE '✅ 모든 필수 컬럼 존재 확인 (17개)';
END $$;

-- ============================================================================
-- 4. Migration 116 적용 확인
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM schema_migrations WHERE version = '116'
  ) THEN
    RAISE WARNING '⚠️ Migration 116이 schema_migrations에 기록되지 않았습니다.';
    RAISE WARNING '⚠️ Migration 116을 수동으로 실행해야 할 수 있습니다.';
  ELSE
    RAISE NOTICE '✅ Migration 116 적용 확인';
  END IF;
END $$;

-- ============================================================================
-- 5. 컬럼 상세 정보 출력
-- ============================================================================
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'analytics'
AND table_name = 'daily_region_metrics'
ORDER BY ordinal_position;

-- ============================================================================
-- 6. 완료 메시지
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 배포 전 사전 점검 완료!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '다음 단계:';
  RAISE NOTICE '1. Migration 141 실행 (Materialized Views 생성)';
  RAISE NOTICE '2. Migration 142 실행 (MV Refresh Cron)';
  RAISE NOTICE '3. Migration 143 실행 (RLS 강화)';
  RAISE NOTICE '';
END $$;
