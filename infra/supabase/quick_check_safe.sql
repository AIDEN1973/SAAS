-- ============================================================================
-- Phase 1-3 빠른 점검 (안전 버전)
-- ============================================================================

-- 1. Phase 1-3 컬럼 개수 확인 (21개여야 함)
SELECT
  'Phase 1-3 Columns Count' as check_name,
  COUNT(*) as column_count,
  CASE
    WHEN COUNT(*) = 21 THEN '✅ PASS'
    ELSE '❌ FAIL - Expected 21 columns'
  END as status
FROM information_schema.columns
WHERE table_schema = 'analytics'
  AND table_name = 'daily_region_metrics'
  AND (
    column_name LIKE '%new_enrollments%' OR
    column_name LIKE '%arpu%' OR
    column_name LIKE '%capacity_rate%' OR
    column_name LIKE '%overdue_rate%' OR
    column_name LIKE '%churn_rate%' OR
    column_name LIKE '%late_rate%' OR
    column_name LIKE '%absent_rate%'
  );

-- 2. 각 메트릭별 컬럼 확인 (각 3개: avg, p25, p75)
SELECT
  'Metric Columns Breakdown' as check_name,
  SUM(CASE WHEN column_name LIKE '%new_enrollments%' THEN 1 ELSE 0 END) as new_enrollments_cols,
  SUM(CASE WHEN column_name LIKE '%arpu%' THEN 1 ELSE 0 END) as arpu_cols,
  SUM(CASE WHEN column_name LIKE '%capacity_rate%' THEN 1 ELSE 0 END) as capacity_rate_cols,
  SUM(CASE WHEN column_name LIKE '%overdue_rate%' THEN 1 ELSE 0 END) as overdue_rate_cols,
  SUM(CASE WHEN column_name LIKE '%churn_rate%' THEN 1 ELSE 0 END) as churn_rate_cols,
  SUM(CASE WHEN column_name LIKE '%late_rate%' THEN 1 ELSE 0 END) as late_rate_cols,
  SUM(CASE WHEN column_name LIKE '%absent_rate%' THEN 1 ELSE 0 END) as absent_rate_cols
FROM information_schema.columns
WHERE table_schema = 'analytics'
  AND table_name = 'daily_region_metrics';

-- 3. 실제 컬럼 리스트 확인
SELECT
  'Column List' as check_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'analytics'
  AND table_name = 'daily_region_metrics'
  AND (
    column_name LIKE '%new_enrollments%' OR
    column_name LIKE '%arpu%' OR
    column_name LIKE '%capacity_rate%' OR
    column_name LIKE '%overdue_rate%' OR
    column_name LIKE '%churn_rate%' OR
    column_name LIKE '%late_rate%' OR
    column_name LIKE '%absent_rate%'
  )
ORDER BY column_name;

-- 4. 마이그레이션 158 적용 확인
SELECT
  'Migration 158 Status' as check_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'analytics'
        AND table_name = 'daily_region_metrics'
        AND column_name = 'new_enrollments_avg'
    ) THEN '✅ Applied'
    ELSE '❌ Not Applied'
  END as status;

-- 5. 지역 통계 데이터 확인 (오늘 데이터)
SELECT
  'Regional Metrics Data Today' as check_name,
  COUNT(*) as record_count,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ Data exists'
    ELSE '⚠️ No data yet (normal if before 23:59 KST)'
  END as status
FROM analytics.daily_region_metrics
WHERE date_kst = CURRENT_DATE;

-- 6. 최종 요약
SELECT
  '=== FINAL SUMMARY ===' as summary,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = 'analytics' AND table_name = 'daily_region_metrics'
   AND (column_name LIKE '%new_enrollments%' OR column_name LIKE '%arpu%' OR
        column_name LIKE '%capacity_rate%' OR column_name LIKE '%overdue_rate%' OR
        column_name LIKE '%churn_rate%' OR column_name LIKE '%late_rate%' OR
        column_name LIKE '%absent_rate%')
  ) as phase123_columns_added,
  CASE
    WHEN (SELECT COUNT(*) FROM information_schema.columns
          WHERE table_schema = 'analytics' AND table_name = 'daily_region_metrics'
          AND (column_name LIKE '%new_enrollments%' OR column_name LIKE '%arpu%' OR
               column_name LIKE '%capacity_rate%' OR column_name LIKE '%overdue_rate%' OR
               column_name LIKE '%churn_rate%' OR column_name LIKE '%late_rate%' OR
               column_name LIKE '%absent_rate%')
    ) = 21 THEN '✅ ALL COLUMNS ADDED'
    ELSE '❌ MISSING COLUMNS'
  END as deployment_status;
