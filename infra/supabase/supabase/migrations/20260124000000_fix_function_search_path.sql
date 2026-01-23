-- Migration: Security Lint 수정 - Function Search Path 설정
-- Description: disable_worker_cron_job, register_all_monitoring_cron_jobs 함수에 SET search_path 추가
-- Date: 2026-01-24
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- ============================================================================
-- 1. disable_worker_cron_job 함수 재생성 (SET search_path 추가)
-- ============================================================================
CREATE OR REPLACE FUNCTION disable_worker_cron_job()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public  -- ✅ SQL Injection 방지
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Cron job 비활성화
  UPDATE cron.job
  SET active = false
  WHERE jobname = 'worker-process-job';

  -- 결과 반환
  SELECT jsonb_build_object(
    'success', true,
    'message', 'Worker cron job disabled successfully',
    'jobname', 'worker-process-job',
    'active', false
  ) INTO result;

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION disable_worker_cron_job() IS
'Worker Cron Job을 비활성화합니다. 권한 문제로 직접 UPDATE할 수 없을 때 사용.';

-- ============================================================================
-- 2. register_all_monitoring_cron_jobs 함수 재생성 (SET search_path 추가)
-- ============================================================================
CREATE OR REPLACE FUNCTION register_all_monitoring_cron_jobs()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public  -- ✅ SQL Injection 방지
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

-- ============================================================================
-- 3. 완료 메시지
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ Security Lint 수정 완료!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE '수정된 함수:';
  RAISE NOTICE '  - disable_worker_cron_job() [SET search_path 추가]';
  RAISE NOTICE '  - register_all_monitoring_cron_jobs() [SET search_path 추가]';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 보안 개선:';
  RAISE NOTICE '   - SQL Injection 공격 방지';
  RAISE NOTICE '   - 함수 실행 시 search_path 고정';
  RAISE NOTICE '';
END $$;
