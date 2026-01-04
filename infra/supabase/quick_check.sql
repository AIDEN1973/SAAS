-- 빠른 점검: Phase 1-3 메트릭 컬럼이 추가되었는지 확인
SELECT column_name
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
