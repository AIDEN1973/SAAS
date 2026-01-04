-- Phase 1-3 모든 21개 컬럼 확인
SELECT
  column_name,
  data_type,
  CASE
    WHEN column_name LIKE '%new_enrollments%' THEN 'Phase 1'
    WHEN column_name LIKE '%arpu%' THEN 'Phase 1'
    WHEN column_name LIKE '%capacity_rate%' THEN 'Phase 2'
    WHEN column_name LIKE '%overdue_rate%' THEN 'Phase 2'
    WHEN column_name LIKE '%churn_rate%' THEN 'Phase 3'
    WHEN column_name LIKE '%late_rate%' THEN 'Phase 3'
    WHEN column_name LIKE '%absent_rate%' THEN 'Phase 3'
  END as phase
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
ORDER BY phase, column_name;

-- 총 개수 확인 (21개여야 함)
SELECT
  COUNT(*) as total_phase123_columns,
  CASE
    WHEN COUNT(*) = 21 THEN '✅ ALL 21 COLUMNS PRESENT'
    WHEN COUNT(*) > 0 THEN '⚠️ PARTIAL - ' || COUNT(*)::text || ' out of 21 columns'
    ELSE '❌ NO COLUMNS FOUND'
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
