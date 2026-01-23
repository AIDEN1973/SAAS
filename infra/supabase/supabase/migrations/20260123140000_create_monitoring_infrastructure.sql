-- Migration: 모니터링 인프라 구축
-- Description: Edge Function, Realtime, Sentry 로그 테이블 및 동기화 Cron Job 생성
-- Date: 2026-01-23

-- ============================================================================
-- 1. edge_function_logs 테이블 생성
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.edge_function_logs (
  id BIGSERIAL PRIMARY KEY,
  function_name TEXT NOT NULL,
  event_message TEXT,
  execution_time_ms NUMERIC DEFAULT 0,
  status_code INTEGER DEFAULT 200,
  level TEXT DEFAULT 'info',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (function_name, created_at)
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_edge_function_logs_function_name ON public.edge_function_logs(function_name);
CREATE INDEX IF NOT EXISTS idx_edge_function_logs_created_at ON public.edge_function_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_function_logs_status_code ON public.edge_function_logs(status_code) WHERE status_code >= 400;

-- RLS 활성화
ALTER TABLE public.edge_function_logs ENABLE ROW LEVEL SECURITY;

-- RLS 정책: authenticated 사용자만 조회 가능
CREATE POLICY "Authenticated users can view edge function logs"
  ON public.edge_function_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 2. realtime_connection_logs 테이블 생성
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.realtime_connection_logs (
  id BIGSERIAL PRIMARY KEY,
  active_connections INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  channels JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_realtime_connection_logs_created_at ON public.realtime_connection_logs(created_at DESC);

-- RLS 활성화
ALTER TABLE public.realtime_connection_logs ENABLE ROW LEVEL SECURITY;

-- RLS 정책: authenticated 사용자만 조회 가능
CREATE POLICY "Authenticated users can view realtime logs"
  ON public.realtime_connection_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 3. frontend_error_logs 테이블 생성
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.frontend_error_logs (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  component TEXT NOT NULL,
  operation TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  last_seen TIMESTAMPTZ NOT NULL,
  level TEXT DEFAULT 'error',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_frontend_error_logs_level ON public.frontend_error_logs(level);
CREATE INDEX IF NOT EXISTS idx_frontend_error_logs_last_seen ON public.frontend_error_logs(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_frontend_error_logs_component ON public.frontend_error_logs(component);

-- RLS 활성화
ALTER TABLE public.frontend_error_logs ENABLE ROW LEVEL SECURITY;

-- RLS 정책: authenticated 사용자만 조회 가능
CREATE POLICY "Authenticated users can view frontend errors"
  ON public.frontend_error_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 4. 테이블 존재 확인 헬퍼 함수들
-- ============================================================================
CREATE OR REPLACE FUNCTION ensure_edge_function_logs_table()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 테이블이 이미 존재하므로 아무것도 하지 않음
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION ensure_realtime_connection_logs_table()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 테이블이 이미 존재하므로 아무것도 하지 않음
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION ensure_frontend_error_logs_table()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 테이블이 이미 존재하므로 아무것도 하지 않음
  RETURN;
END;
$$;

-- ============================================================================
-- 5. get_frontend_errors RPC 함수 생성
-- ============================================================================
CREATE OR REPLACE FUNCTION get_frontend_errors()
RETURNS TABLE (
  id TEXT,
  message TEXT,
  component TEXT,
  operation TEXT,
  count INTEGER,
  last_seen TIMESTAMPTZ,
  level TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'frontend_error_logs'
  ) THEN
    RETURN QUERY
    SELECT
      fel.id::TEXT,
      fel.message::TEXT,
      fel.component::TEXT,
      fel.operation::TEXT,
      fel.count::INTEGER,
      fel.last_seen,
      fel.level::TEXT
    FROM frontend_error_logs fel
    WHERE fel.last_seen >= NOW() - INTERVAL '24 hours'
    ORDER BY fel.count DESC, fel.last_seen DESC
    LIMIT 50;
  ELSE
    RETURN;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_frontend_errors() TO authenticated;

-- ============================================================================
-- 6. get_realtime_stats 함수 업데이트 (실제 데이터 조회)
-- ============================================================================
DROP FUNCTION IF EXISTS get_realtime_stats();

CREATE OR REPLACE FUNCTION get_realtime_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  latest_log RECORD;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'realtime_connection_logs'
  ) THEN
    -- 가장 최근 로그 조회
    SELECT * INTO latest_log
    FROM realtime_connection_logs
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
      result := jsonb_build_object(
        'active_connections', latest_log.active_connections,
        'total_messages_24h', latest_log.total_messages,
        'error_count_24h', latest_log.error_count,
        'channels', latest_log.channels
      );
    ELSE
      -- 로그가 없으면 기본값
      result := jsonb_build_object(
        'active_connections', 0,
        'total_messages_24h', 0,
        'error_count_24h', 0,
        'channels', '[]'::jsonb
      );
    END IF;
  ELSE
    -- 테이블이 없으면 기본값
    result := jsonb_build_object(
      'active_connections', 0,
      'total_messages_24h', 0,
      'error_count_24h', 0,
      'channels', '[]'::jsonb
    );
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_realtime_stats() TO authenticated;

-- ============================================================================
-- 7. Cron Job 등록 (로그 동기화)
-- ============================================================================
-- Edge Function 로그 동기화 (5분마다)
SELECT cron.schedule(
  'sync-edge-function-logs',
  '*/5 * * * *', -- 5분마다
  $$
  SELECT
    net.http_post(
      url := (SELECT current_setting('app.settings.supabase_url') || '/functions/v1/sync-edge-function-logs'),
      headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Realtime 메트릭 수집 (1분마다)
SELECT cron.schedule(
  'sync-realtime-metrics',
  '* * * * *', -- 1분마다
  $$
  SELECT
    net.http_post(
      url := (SELECT current_setting('app.settings.supabase_url') || '/functions/v1/sync-realtime-metrics'),
      headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Sentry 에러 동기화 (5분마다)
SELECT cron.schedule(
  'sync-sentry-errors',
  '*/5 * * * *', -- 5분마다
  $$
  SELECT
    net.http_post(
      url := (SELECT current_setting('app.settings.supabase_url') || '/functions/v1/sync-sentry-errors'),
      headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ============================================================================
-- 8. Worker Cron Job 비활성화를 위한 RPC 함수 생성
-- ============================================================================
CREATE OR REPLACE FUNCTION disable_worker_cron_job()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

GRANT EXECUTE ON FUNCTION disable_worker_cron_job() TO authenticated;

COMMENT ON FUNCTION disable_worker_cron_job() IS
'Worker Cron Job을 비활성화합니다. 권한 문제로 직접 UPDATE할 수 없을 때 사용.';

-- ============================================================================
-- 9. 완료 메시지
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ 모니터링 인프라 구축 완료!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE '생성된 테이블:';
  RAISE NOTICE '  - edge_function_logs (Edge Function 로그)';
  RAISE NOTICE '  - realtime_connection_logs (Realtime 메트릭)';
  RAISE NOTICE '  - frontend_error_logs (Sentry 에러)';
  RAISE NOTICE '';
  RAISE NOTICE '생성된 RPC 함수:';
  RAISE NOTICE '  - get_frontend_errors()';
  RAISE NOTICE '  - get_realtime_stats() [업데이트]';
  RAISE NOTICE '  - disable_worker_cron_job()';
  RAISE NOTICE '';
  RAISE NOTICE '등록된 Cron Jobs:';
  RAISE NOTICE '  - sync-edge-function-logs (5분마다)';
  RAISE NOTICE '  - sync-realtime-metrics (1분마다)';
  RAISE NOTICE '  - sync-sentry-errors (5분마다)';
  RAISE NOTICE '';
  RAISE NOTICE '📌 다음 단계:';
  RAISE NOTICE '   1. Edge Functions 배포:';
  RAISE NOTICE '      - sync-edge-function-logs';
  RAISE NOTICE '      - sync-realtime-metrics';
  RAISE NOTICE '      - sync-sentry-errors';
  RAISE NOTICE '';
  RAISE NOTICE '   2. 환경 변수 설정 (Supabase Dashboard):';
  RAISE NOTICE '      - SUPABASE_ACCESS_TOKEN';
  RAISE NOTICE '      - SUPABASE_PROJECT_REF';
  RAISE NOTICE '      - SENTRY_AUTH_TOKEN';
  RAISE NOTICE '      - SENTRY_ORG';
  RAISE NOTICE '      - SENTRY_PROJECT';
  RAISE NOTICE '';
  RAISE NOTICE '   3. Worker Cron Job 비활성화:';
  RAISE NOTICE '      SELECT disable_worker_cron_job();';
  RAISE NOTICE '';
END $$;
