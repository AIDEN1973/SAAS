/**
 * Cron 작업 실행 상태 확인
 *
 * [목적] 생성된 cron 작업이 정상적으로 실행되고 있는지 확인합니다.
 */

-- ============================================================================
-- 1. 생성된 cron 작업 목록
-- ============================================================================
SELECT
  jobid,
  schedule,
  jobname,
  active,
  CASE
    WHEN jobname = 'auto-billing-generation' THEN '매일 04:00 KST'
    WHEN jobname = 'student-task-card-generation' THEN '매일 06:00 KST'
    WHEN jobname = 'ai-briefing-generation' THEN '매일 07:00 KST'
    WHEN jobname = 'daily-statistics-update' THEN '매일 23:59 KST'
    WHEN jobname = 'overdue-notification-scheduler' THEN '매일 09:00 KST'
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
-- 2. Cron 작업 실행 이력 확인 (가능한 경우)
-- ============================================================================
-- 주의: cron.job_run_details는 Supabase 버전에 따라 존재하지 않을 수 있습니다.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'cron' AND table_name = 'job_run_details'
  ) THEN
    RAISE NOTICE '✅ cron.job_run_details 테이블 존재';
    RAISE NOTICE '   실행 이력을 확인할 수 있습니다.';
  ELSE
    RAISE NOTICE '⚠️ cron.job_run_details 테이블이 존재하지 않습니다.';
    RAISE NOTICE '   Supabase Dashboard > Edge Functions > 각 함수 > Logs에서 실행 이력을 확인하세요.';
  END IF;
END $$;

-- 실행 이력이 있는 경우 조회 (최근 10개)
SELECT
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid IN (
  SELECT jobid FROM cron.job
  WHERE jobname IN (
    'auto-billing-generation',
    'student-task-card-generation',
    'ai-briefing-generation',
    'daily-statistics-update',
    'overdue-notification-scheduler'
  )
)
ORDER BY start_time DESC
LIMIT 10;

-- ============================================================================
-- 3. 요약
-- ============================================================================
SELECT
  'Cron 작업 요약' AS check_type,
  COUNT(*) FILTER (WHERE active = true) AS active_jobs,
  COUNT(*) FILTER (WHERE active = false) AS inactive_jobs,
  COUNT(*) AS total_jobs
FROM cron.job
WHERE jobname IN (
  'auto-billing-generation',
  'student-task-card-generation',
  'ai-briefing-generation',
  'daily-statistics-update',
  'overdue-notification-scheduler'
);

-- ============================================================================
-- 4. 다음 실행 시간 계산 (참고용)
-- ============================================================================
-- 주의: 실제 다음 실행 시간은 pg_cron이 계산하므로 여기서는 참고용입니다.
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Cron 작업 실행 시간 안내';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '모든 시간은 UTC 기준입니다 (KST = UTC+9):';
  RAISE NOTICE '  - auto-billing-generation: UTC 19:00 (KST 다음날 04:00)';
  RAISE NOTICE '  - student-task-card-generation: UTC 21:00 (KST 다음날 06:00)';
  RAISE NOTICE '  - ai-briefing-generation: UTC 22:00 (KST 다음날 07:00)';
  RAISE NOTICE '  - daily-statistics-update: UTC 14:59 (KST 23:59)';
  RAISE NOTICE '  - overdue-notification-scheduler: UTC 00:00 (KST 09:00)';
  RAISE NOTICE '';
  RAISE NOTICE '실행 이력 확인:';
  RAISE NOTICE '  - Dashboard > Edge Functions > 각 함수 > Logs';
  RAISE NOTICE '  - 또는 cron.job_run_details 테이블 (있는 경우)';
  RAISE NOTICE '';
END $$;

