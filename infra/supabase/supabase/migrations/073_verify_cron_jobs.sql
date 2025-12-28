/**
 * Cron 작업 확인 쿼리
 *
 * [목적] 현재 설정된 cron 작업을 확인합니다.
 *        ⚠️ 주의: Supabase는 cron 작업을 Dashboard에서 관리하므로,
 *                 SQL로 직접 확인하는 것은 제한적일 수 있습니다.
 */

-- ============================================================================
-- 1. pg_cron 확장 확인
-- ============================================================================
SELECT
  'pg_cron 확장 확인' AS check_type,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN '✅ 활성화됨'
    ELSE '❌ 비활성화됨'
  END AS status,
  COALESCE(
    (SELECT extversion FROM pg_extension WHERE extname = 'pg_cron'),
    '확장 없음'
  ) AS version;

-- ============================================================================
-- 2. cron 스키마 및 테이블 존재 확인
-- ============================================================================
DO $$
DECLARE
  cron_schema_exists BOOLEAN;
  cron_job_table_exists BOOLEAN;
BEGIN
  -- cron 스키마 확인
  SELECT EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name = 'cron'
  ) INTO cron_schema_exists;

  -- cron.job 테이블 확인
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'cron' AND table_name = 'job'
  ) INTO cron_job_table_exists;

  IF cron_schema_exists AND cron_job_table_exists THEN
    RAISE NOTICE '✅ cron.job 테이블이 존재합니다.';
  ELSE
    RAISE NOTICE '⚠️ cron.job 테이블이 존재하지 않습니다.';
    RAISE NOTICE '   Supabase는 Edge Functions의 cron 작업을 Dashboard에서 관리합니다.';
    RAISE NOTICE '   확인 방법: Dashboard > Edge Functions > 각 함수 > Cron Jobs 탭';
  END IF;
END $$;

-- ============================================================================
-- 3. Cron 작업 확인 (테이블이 있는 경우에만)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'cron' AND table_name = 'job'
  ) THEN
    -- 테이블이 있으면 쿼리 실행
    PERFORM 1;
  ELSE
    RAISE NOTICE '⚠️ cron.job 테이블이 없으므로 SQL로 cron 작업을 확인할 수 없습니다.';
    RAISE NOTICE '';
    RAISE NOTICE '대안: Supabase Dashboard에서 확인하세요:';
    RAISE NOTICE '  1. Dashboard > Edge Functions로 이동';
    RAISE NOTICE '  2. 각 함수를 선택';
    RAISE NOTICE '  3. "Cron Jobs" 탭에서 스케줄 확인';
    RAISE NOTICE '';
    RAISE NOTICE '설정해야 할 cron 작업:';
    RAISE NOTICE '  - auto-billing-generation: 매일 04:00 KST (0 19 * * * UTC)';
    RAISE NOTICE '  - student-task-card-generation: 매일 06:00 KST (0 21 * * * UTC)';
    RAISE NOTICE '  - ai-briefing-generation: 매일 07:00 KST (0 22 * * * UTC)';
    RAISE NOTICE '  - daily-statistics-update: 매일 23:59 KST (59 14 * * * UTC)';
    RAISE NOTICE '  - overdue-notification-scheduler: 매일 09:00 KST (0 0 * * * UTC)';
  END IF;
END $$;

-- cron.job 테이블이 있는 경우에만 실행되는 쿼리
-- (동적 SQL로 실행하려면 별도 함수 필요)
SELECT
  'Edge Functions cron 작업' AS check_type,
  jobid,
  schedule,
  command,
  active,
  jobname,
  CASE
    WHEN jobname = 'auto-billing-generation' THEN '매일 04:00 KST (19:00 UTC 전날)'
    WHEN jobname = 'student-task-card-generation' THEN '매일 06:00 KST (21:00 UTC 전날)'
    WHEN jobname = 'ai-briefing-generation' THEN '매일 07:00 KST (22:00 UTC 전날)'
    WHEN jobname = 'daily-statistics-update' THEN '매일 23:59 KST (14:59 UTC 당일)'
    WHEN jobname = 'overdue-notification-scheduler' THEN '매일 09:00 KST (00:00 UTC 당일)'
    ELSE '알 수 없음'
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
-- 4. Cron 작업 실행 이력 확인
-- ============================================================================
-- 주의: Supabase는 Edge Functions의 실행 이력을 Dashboard에서 제공합니다.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'cron' AND table_name = 'job_run_details'
  ) THEN
    RAISE NOTICE '✅ cron.job_run_details 테이블 존재';
  ELSE
    RAISE NOTICE '⚠️ cron.job_run_details 테이블이 존재하지 않습니다.';
    RAISE NOTICE '   Supabase Dashboard > Edge Functions > 각 함수 > Logs에서 실행 이력을 확인하세요.';
  END IF;
END $$;

-- ============================================================================
-- 5. 요약 및 권장사항
-- ============================================================================
SELECT
  'Cron 작업 확인 방법' AS check_type,
  'Supabase Dashboard' AS recommended_method,
  'Dashboard > Edge Functions > 각 함수 > Cron Jobs 탭' AS location,
  'SQL로 직접 확인하는 것은 제한적입니다.' AS note;

