-- daily_store_metrics 테이블의 모든 컬럼 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'analytics'
  AND table_name = 'daily_store_metrics'
ORDER BY ordinal_position;
