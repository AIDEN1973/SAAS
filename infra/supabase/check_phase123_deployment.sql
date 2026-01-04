-- Phase 1-3 메트릭 배포 상태 점검 스크립트
-- 실행: Supabase SQL Editor에 복사 붙여넣기

-- ============================================================================
-- 1. analytics 스키마 테이블 확인
-- ============================================================================
SELECT
  '1. Analytics Schema Tables' as check_type,
  table_name
FROM information_schema.tables
WHERE table_schema = 'analytics'
ORDER BY table_name;

-- ============================================================================
-- 2. daily_region_metrics 테이블 컬럼 확인 (Phase 1-3 메트릭 포함 여부)
-- ============================================================================
SELECT
  '2. Phase 1-3 Columns Check' as check_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'analytics'
  AND table_name = 'daily_region_metrics'
  AND column_name IN (
    -- Phase 1
    'new_enrollments_avg', 'new_enrollments_p25', 'new_enrollments_p75',
    'arpu_avg', 'arpu_p25', 'arpu_p75',
    -- Phase 2
    'capacity_rate_avg', 'capacity_rate_p25', 'capacity_rate_p75',
    'overdue_rate_avg', 'overdue_rate_p25', 'overdue_rate_p75',
    -- Phase 3
    'churn_rate_avg', 'churn_rate_p25', 'churn_rate_p75',
    'late_rate_avg', 'late_rate_p25', 'late_rate_p75',
    'absent_rate_avg', 'absent_rate_p25', 'absent_rate_p75'
  )
ORDER BY column_name;

-- ============================================================================
-- 3. daily_region_metrics 데이터 존재 여부 (최근 7일)
-- ============================================================================
SELECT
  '3. Recent Regional Metrics Data' as check_type,
  date_kst,
  region_code,
  region_level,
  industry_type,
  tenant_count,
  student_count,
  new_enrollments_avg,
  arpu_avg,
  capacity_rate_avg,
  overdue_rate_avg,
  churn_rate_avg
FROM analytics.daily_region_metrics
WHERE date_kst >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date_kst DESC, region_code
LIMIT 10;

-- ============================================================================
-- 4. daily_store_metrics 테이블 컬럼 확인
-- ============================================================================
SELECT
  '4. Store Metrics Columns Check' as check_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'analytics'
  AND table_name = 'daily_store_metrics'
ORDER BY ordinal_position;

-- ============================================================================
-- 5. daily_store_metrics 데이터 존재 여부 (최근 데이터)
-- ============================================================================
-- 참고: 실제 컬럼명은 섹션 4에서 확인
-- Phase 1-3 메트릭이 포함되어 있는지 확인 필요
SELECT
  '5. Recent Store Metrics Data' as check_type,
  COUNT(*) as total_records,
  MIN(date_kst) as oldest_date,
  MAX(date_kst) as latest_date
FROM analytics.daily_store_metrics
WHERE date_kst >= CURRENT_DATE - INTERVAL '3 days';

-- 최근 데이터 샘플 (모든 컬럼)
SELECT *
FROM analytics.daily_store_metrics
WHERE date_kst >= CURRENT_DATE - INTERVAL '3 days'
ORDER BY date_kst DESC
LIMIT 5;

-- ============================================================================
-- 6. Edge Function 실행 로그 확인 (Supabase Console에서만 가능)
-- ============================================================================
-- 참고: Edge Function 로그는 Supabase Dashboard > Edge Functions > daily-statistics-update > Logs 에서 확인

-- ============================================================================
-- 7. 컬럼 주석 확인 (문서화)
-- ============================================================================
SELECT
  '7. Column Comments Check' as check_type,
  cols.column_name,
  pg_catalog.col_description(c.oid, cols.ordinal_position::int) as column_comment
FROM information_schema.columns cols
JOIN pg_catalog.pg_class c ON c.relname = cols.table_name
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE cols.table_schema = 'analytics'
  AND cols.table_name = 'daily_region_metrics'
  AND n.nspname = 'analytics'
  AND (
    cols.column_name LIKE '%new_enrollments%'
    OR cols.column_name LIKE '%arpu%'
    OR cols.column_name LIKE '%capacity_rate%'
    OR cols.column_name LIKE '%overdue_rate%'
    OR cols.column_name LIKE '%churn_rate%'
    OR cols.column_name LIKE '%late_rate%'
    OR cols.column_name LIKE '%absent_rate%'
  )
ORDER BY cols.column_name;

-- ============================================================================
-- 8. 전체 daily_region_metrics 컬럼 수 확인 (21개 추가되었는지 확인)
-- ============================================================================
SELECT
  '8. Total Column Count' as check_type,
  COUNT(*) as total_columns,
  COUNT(CASE WHEN column_name LIKE '%_avg' OR column_name LIKE '%_p25' OR column_name LIKE '%_p75' THEN 1 END) as metrics_columns
FROM information_schema.columns
WHERE table_schema = 'analytics'
  AND table_name = 'daily_region_metrics';

-- ============================================================================
-- 9. 마이그레이션 적용 여부 확인
-- ============================================================================
-- 참고: Supabase는 supabase_migrations 스키마를 사용하지 않을 수 있음
-- 대신 migration 파일 자체가 적용되었는지 확인
SELECT
  '9. Migration 158 Applied Check' as check_type,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'analytics'
        AND table_name = 'daily_region_metrics'
        AND column_name = 'new_enrollments_avg'
    ) THEN '✅ Migration 158 Applied'
    ELSE '❌ Migration 158 NOT Applied'
  END as status;

-- ============================================================================
-- 실행 요약
-- ============================================================================
SELECT
  '=== DEPLOYMENT CHECK SUMMARY ===' as summary,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = 'analytics' AND table_name = 'daily_region_metrics'
   AND column_name LIKE '%new_enrollments%') as new_enrollments_cols,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = 'analytics' AND table_name = 'daily_region_metrics'
   AND column_name LIKE '%arpu%') as arpu_cols,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = 'analytics' AND table_name = 'daily_region_metrics'
   AND column_name LIKE '%capacity_rate%') as capacity_rate_cols,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = 'analytics' AND table_name = 'daily_region_metrics'
   AND column_name LIKE '%overdue_rate%') as overdue_rate_cols,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = 'analytics' AND table_name = 'daily_region_metrics'
   AND column_name LIKE '%churn_rate%') as churn_rate_cols,
  (SELECT COUNT(*) FROM analytics.daily_region_metrics
   WHERE date_kst = CURRENT_DATE) as todays_regional_data_count,
  (SELECT COUNT(*) FROM analytics.daily_store_metrics
   WHERE date_kst = CURRENT_DATE) as todays_store_data_count;
