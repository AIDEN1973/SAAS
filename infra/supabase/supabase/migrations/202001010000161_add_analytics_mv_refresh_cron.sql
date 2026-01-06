/**
 * Analytics MV Refresh Cron Job 추가
 *
 * [불변 규칙] P1-3: Materialized View Refresh 전략
 * [요구사항] 매일 00:30 KST에 MV REFRESH
 *
 * ⚠️ 보안 주의: Service Role Key 포함 (Git 커밋 전 확인)
 */

-- ============================================================================
-- 1. 기존 Cron 작업 확인
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'analytics-mv-refresh'
  ) THEN
    PERFORM cron.unschedule('analytics-mv-refresh');
    RAISE NOTICE '기존 analytics-mv-refresh 작업 삭제 완료';
  END IF;
END $$;

-- ============================================================================
-- 2. Analytics MV Refresh Cron Job 생성
-- ============================================================================
-- 매일 00:30 KST = 15:30 UTC (전날)
-- daily-statistics-update (23:59 KST = 14:59 UTC) 완료 후 30분 뒤 실행
SELECT cron.schedule(
  'analytics-mv-refresh',
  '30 15 * * *',  -- UTC 15:30 (KST 다음날 00:30)
  $$
  SELECT analytics.refresh_all_materialized_views();
  $$
);

-- ============================================================================
-- 3. 생성된 Cron 작업 확인
-- ============================================================================
SELECT
  jobid,
  schedule,
  jobname,
  active,
  '매일 00:30 KST (Analytics MV Refresh)' AS schedule_description
FROM cron.job
WHERE jobname = 'analytics-mv-refresh';

-- ============================================================================
-- 4. 완료 메시지
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Analytics MV Refresh Cron Job 생성 완료!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '생성된 작업:';
  RAISE NOTICE '  - analytics-mv-refresh: 매일 00:30 KST';
  RAISE NOTICE '';
  RAISE NOTICE '실행 내용:';
  RAISE NOTICE '  - analytics.refresh_all_materialized_views() 호출';
  RAISE NOTICE '  - daily_region_metrics_mv REFRESH';
  RAISE NOTICE '  - daily_store_metrics_mv REFRESH';
  RAISE NOTICE '';
  RAISE NOTICE '📊 성능 향상:';
  RAISE NOTICE '   - AnalyticsPage 조회 속도 개선';
  RAISE NOTICE '   - 최근 30일/90일 데이터만 캐시';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- 5. 참고: Cron 작업 관리 명령어
-- ============================================================================
-- Cron 작업 목록 조회:
--   SELECT * FROM cron.job WHERE jobname = 'analytics-mv-refresh';
--
-- Cron 작업 비활성화:
--   UPDATE cron.job SET active = false WHERE jobname = 'analytics-mv-refresh';
--
-- Cron 작업 활성화:
--   UPDATE cron.job SET active = true WHERE jobname = 'analytics-mv-refresh';
--
-- Cron 작업 삭제:
--   SELECT cron.unschedule('analytics-mv-refresh');
--
-- Cron 작업 실행 이력 조회:
--   SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'analytics-mv-refresh');
