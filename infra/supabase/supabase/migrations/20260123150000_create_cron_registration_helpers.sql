-- Migration: Cron Job 등록 헬퍼 함수 생성
-- Description: MCP 또는 프론트엔드에서 Cron Job을 등록할 수 있는 RPC 함수
-- Date: 2026-01-23

-- ============================================================================
-- 1. Cron Job 등록 헬퍼 함수들
-- ============================================================================

-- Edge Function 로그 동기화 Cron 등록
CREATE OR REPLACE FUNCTION register_sync_edge_function_logs_cron()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  job_exists BOOLEAN;
BEGIN
  -- 기존 Job 확인
  SELECT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'sync-edge-function-logs'
  ) INTO job_exists;

  IF job_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Cron job already exists',
      'jobname', 'sync-edge-function-logs'
    );
  END IF;

  -- Cron Job 등록
  PERFORM cron.schedule(
    'sync-edge-function-logs',
    '*/5 * * * *',
    $cron$
    SELECT
      net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-edge-function-logs',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
        body := '{}'::jsonb
      ) AS request_id;
    $cron$
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Cron job registered successfully',
    'jobname', 'sync-edge-function-logs',
    'schedule', '*/5 * * * *'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION register_sync_edge_function_logs_cron() TO authenticated;

-- Realtime 메트릭 수집 Cron 등록
CREATE OR REPLACE FUNCTION register_sync_realtime_metrics_cron()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  job_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'sync-realtime-metrics'
  ) INTO job_exists;

  IF job_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Cron job already exists',
      'jobname', 'sync-realtime-metrics'
    );
  END IF;

  PERFORM cron.schedule(
    'sync-realtime-metrics',
    '* * * * *',
    $cron$
    SELECT
      net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-realtime-metrics',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
        body := '{}'::jsonb
      ) AS request_id;
    $cron$
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Cron job registered successfully',
    'jobname', 'sync-realtime-metrics',
    'schedule', '* * * * *'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION register_sync_realtime_metrics_cron() TO authenticated;

-- Sentry 에러 동기화 Cron 등록
CREATE OR REPLACE FUNCTION register_sync_sentry_errors_cron()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  job_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'sync-sentry-errors'
  ) INTO job_exists;

  IF job_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Cron job already exists',
      'jobname', 'sync-sentry-errors'
    );
  END IF;

  PERFORM cron.schedule(
    'sync-sentry-errors',
    '*/5 * * * *',
    $cron$
    SELECT
      net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-sentry-errors',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
        body := '{}'::jsonb
      ) AS request_id;
    $cron$
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Cron job registered successfully',
    'jobname', 'sync-sentry-errors',
    'schedule', '*/5 * * * *'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION register_sync_sentry_errors_cron() TO authenticated;

-- ============================================================================
-- 2. 모든 Cron Job 한번에 등록하는 편의 함수
-- ============================================================================
CREATE OR REPLACE FUNCTION register_all_monitoring_cron_jobs()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result1 JSONB;
  result2 JSONB;
  result3 JSONB;
  all_results JSONB;
BEGIN
  -- 3개 Cron Job 등록
  result1 := register_sync_edge_function_logs_cron();
  result2 := register_sync_realtime_metrics_cron();
  result3 := register_sync_sentry_errors_cron();

  -- 결과 통합
  all_results := jsonb_build_object(
    'sync_edge_function_logs', result1,
    'sync_realtime_metrics', result2,
    'sync_sentry_errors', result3,
    'summary', jsonb_build_object(
      'total', 3,
      'success', (
        CASE WHEN result1->>'success' = 'true' THEN 1 ELSE 0 END +
        CASE WHEN result2->>'success' = 'true' THEN 1 ELSE 0 END +
        CASE WHEN result3->>'success' = 'true' THEN 1 ELSE 0 END
      ),
      'failed', (
        CASE WHEN result1->>'success' = 'false' THEN 1 ELSE 0 END +
        CASE WHEN result2->>'success' = 'false' THEN 1 ELSE 0 END +
        CASE WHEN result3->>'success' = 'false' THEN 1 ELSE 0 END
      )
    )
  );

  RETURN all_results;
END;
$$;

GRANT EXECUTE ON FUNCTION register_all_monitoring_cron_jobs() TO authenticated;

-- ============================================================================
-- 3. Cron Job 상태 확인 함수
-- ============================================================================
CREATE OR REPLACE FUNCTION get_monitoring_cron_status()
RETURNS TABLE (
  jobname TEXT,
  schedule TEXT,
  active BOOLEAN,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.jobname::TEXT,
    j.schedule::TEXT,
    j.active,
    CASE
      WHEN j.active THEN '✅ 활성화'
      ELSE '⚠️ 비활성화'
    END AS status
  FROM cron.job j
  WHERE j.jobname IN ('sync-edge-function-logs', 'sync-realtime-metrics', 'sync-sentry-errors')
  ORDER BY j.jobname;
END;
$$;

GRANT EXECUTE ON FUNCTION get_monitoring_cron_status() TO authenticated;

-- ============================================================================
-- 4. 완료 메시지
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ Cron Job 등록 헬퍼 함수 생성 완료!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE '생성된 함수:';
  RAISE NOTICE '  - register_sync_edge_function_logs_cron()';
  RAISE NOTICE '  - register_sync_realtime_metrics_cron()';
  RAISE NOTICE '  - register_sync_sentry_errors_cron()';
  RAISE NOTICE '  - register_all_monitoring_cron_jobs() [통합]';
  RAISE NOTICE '  - get_monitoring_cron_status() [상태 확인]';
  RAISE NOTICE '';
  RAISE NOTICE '📌 사용 방법:';
  RAISE NOTICE '   -- 모든 Cron Job 한번에 등록';
  RAISE NOTICE '   SELECT register_all_monitoring_cron_jobs();';
  RAISE NOTICE '';
  RAISE NOTICE '   -- 개별 등록';
  RAISE NOTICE '   SELECT register_sync_edge_function_logs_cron();';
  RAISE NOTICE '   SELECT register_sync_realtime_metrics_cron();';
  RAISE NOTICE '   SELECT register_sync_sentry_errors_cron();';
  RAISE NOTICE '';
  RAISE NOTICE '   -- 상태 확인';
  RAISE NOTICE '   SELECT * FROM get_monitoring_cron_status();';
  RAISE NOTICE '';
END $$;
