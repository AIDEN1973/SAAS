-- AI 지역 인사이트 자동 생성 Cron Job 등록
-- 매일 07:30 KST에 실행 (ai-briefing-generation 이후)
-- 아키텍처 문서 3.6 섹션 참조

-- pg_cron 확장 활성화 확인 (이미 활성화되어 있어야 함)
-- 참조: 076_setup_edge_function_cron_jobs.sql

-- 필수: http 확장 활성화 (참조: 076_setup_edge_function_cron_jobs.sql)
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Cron Job 등록
-- Cron 시간대: UTC 기준
-- KST 07:30 = UTC 22:30 (겨울, UTC+9)
-- Cron 포맷: minute hour day month day_of_week
-- 매일 22:30 UTC에 실행: 30 22 * * *

-- ⚠️ 중요: Supabase Edge Functions의 Cron Job은 pg_cron 또는 cloud scheduler를 통해 등록합니다.
-- 아래는 pg_cron 방식 (Supabase Self-Hosted의 경우)
-- Cloud에서는 Supabase Dashboard에서 Functions > Cron Job으로 설정하세요.

DO $$
BEGIN
  -- pg_cron이 설치되어 있는지 확인
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- 기존 job 삭제 (있는 경우)
    PERFORM cron.unschedule('ai-regional-insights-generation-daily');

    -- Cron job 등록
    PERFORM cron.schedule(
      'ai-regional-insights-generation-daily',
      '30 22 * * *',  -- 매일 22:30 UTC (= 07:30 KST)
      $$
      SELECT extensions.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/ai-regional-insights-generation',
        headers := jsonb_build_object(
          'authorization', 'Bearer ' || current_setting('app.service_role_key'),
          'content-type', 'application/json'
        ),
        body := '{}'::jsonb
      );
      $$
    );

    RAISE NOTICE 'Cron job ai-regional-insights-generation-daily registered';
  ELSE
    RAISE WARNING 'pg_cron extension not found. Please register cron job manually via Supabase Dashboard.';
  END IF;
END $$;
