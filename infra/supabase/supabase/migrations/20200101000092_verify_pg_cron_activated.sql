/**
 * pg_cron 확장 활성화 확인 및 cron.job 테이블 검증
 *
 * [목적] pg_cron 확장이 활성화되었는지 확인하고,
 *        cron.job 테이블이 생성되었는지 검증합니다.
 */

-- ============================================================================
-- 1. pg_cron 확장 정보 확인
-- ============================================================================
SELECT
  'pg_cron 확장 정보' AS check_type,
  extname AS extension_name,
  extversion AS version,
  n.nspname AS schema_name
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE extname = 'pg_cron';

-- ============================================================================
-- 2. cron 스키마 존재 확인
-- ============================================================================
SELECT
  'cron 스키마 확인' AS check_type,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.schemata WHERE schema_name = 'cron'
    ) THEN '✅ cron 스키마 존재'
    ELSE '❌ cron 스키마 없음'
  END AS status;

-- ============================================================================
-- 3. cron.job 테이블 확인
-- ============================================================================
SELECT
  'cron.job 테이블 확인' AS check_type,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'cron' AND table_name = 'job'
    ) THEN '✅ cron.job 테이블 존재'
    ELSE '❌ cron.job 테이블 없음'
  END AS status;

-- ============================================================================
-- 4. 현재 설정된 cron 작업 목록 (테이블이 있는 경우)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'cron' AND table_name = 'job'
  ) THEN
    RAISE NOTICE '✅ cron.job 테이블이 존재합니다.';
    RAISE NOTICE '   현재 설정된 cron 작업:';
  ELSE
    RAISE NOTICE '⚠️ cron.job 테이블이 아직 생성되지 않았습니다.';
    RAISE NOTICE '   잠시 후 다시 확인하거나 Supabase를 재시작해보세요.';
  END IF;
END $$;

-- cron.job 테이블이 있는 경우 작업 목록 조회
SELECT
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job
ORDER BY jobname;

-- ============================================================================
-- 5. Edge Functions 관련 cron 작업 확인
-- ============================================================================
SELECT
  'Edge Functions cron 작업' AS check_type,
  jobid,
  schedule,
  command,
  active,
  jobname,
  CASE
    WHEN jobname = 'auto-billing-generation' THEN '매일 04:00 KST (0 19 * * * UTC)'
    WHEN jobname = 'student-task-card-generation' THEN '매일 06:00 KST (0 21 * * * UTC)'
    WHEN jobname = 'ai-briefing-generation' THEN '매일 07:00 KST (0 22 * * * UTC)'
    WHEN jobname = 'daily-statistics-update' THEN '매일 23:59 KST (59 14 * * * UTC)'
    WHEN jobname = 'overdue-notification-scheduler' THEN '매일 09:00 KST (0 0 * * * UTC)'
    ELSE '기타'
  END AS schedule_description
FROM cron.job
WHERE jobname IN (
  'auto-billing-generation',
  'student-task-card-generation',
  'ai-briefing-generation',
  'daily-statistics-update',
  'overdue-notification-scheduler'
)
ORDER BY jobname;

-- ============================================================================
-- 6. 요약
-- ============================================================================
SELECT
  '요약' AS check_type,
  (SELECT COUNT(*) FROM pg_extension WHERE extname = 'pg_cron') AS pg_cron_enabled,
  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = 'cron' AND table_name = 'job') AS cron_job_table_exists,
  (SELECT COUNT(*) FROM cron.job
   WHERE jobname IN (
     'auto-billing-generation',
     'student-task-card-generation',
     'ai-briefing-generation',
     'daily-statistics-update',
     'overdue-notification-scheduler'
   )) AS edge_function_cron_jobs_count;

