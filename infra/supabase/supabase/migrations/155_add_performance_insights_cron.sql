-- Migration: AI Performance Insights Cron Job
-- Description: 성과 분석 인사이트를 매일 자동 생성하는 cron 작업
-- Date: 2025-01-03

-- ============================================================================
-- 1. pg_cron 및 pg_net 확장 확인
-- ============================================================================
DO $$
BEGIN
  -- pg_cron 확장 확인
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'pg_cron 확장이 활성화되지 않았습니다. Dashboard > Database > Extensions에서 활성화하세요.';
  END IF;

  -- pg_net 확장 확인 (HTTP 요청을 위해 필요)
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION 'pg_net 확장이 활성화되지 않았습니다. Dashboard > Database > Extensions에서 활성화하세요.';
  END IF;

  RAISE NOTICE '✅ 필수 확장 확인 완료: pg_cron, pg_net';
END $$;

-- ============================================================================
-- 2. 기존 Performance Insights Cron 작업 삭제 (재설정 시)
-- ============================================================================
DO $$
DECLARE
  job_record RECORD;
BEGIN
  FOR job_record IN
    SELECT jobid, jobname
    FROM cron.job
    WHERE jobname = 'generate-performance-insights'
  LOOP
    PERFORM cron.unschedule(job_record.jobname);
    RAISE NOTICE '기존 cron 작업 삭제: %', job_record.jobname;
  END LOOP;
END $$;

-- ============================================================================
-- 3. Performance Insights Cron 작업 생성
-- ============================================================================
-- 매일 오전 7:30 KST (UTC 22:30 전일) 실행
-- AI 브리핑 생성 (07:00) 후 30분 뒤에 실행하여 순차적 처리

SELECT cron.schedule(
  'generate-performance-insights',
  '30 22 * * *',  -- 매일 22:30 UTC (다음날 07:30 KST)
  $$
  SELECT net.http_post(
    url := 'https://xawypsrotrfoyozhrsbb.supabase.co/functions/v1/generate-performance-insights',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhhd3lwc3JvdHJmb3lvemhyc2JiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDk0NDYwNiwiZXhwIjoyMDgwNTIwNjA2fQ.s1t72EahAuqROS3d334ERIEpgiZGMs-lxCb2BGVkjZo',
      'x-cron-job', 'true'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================================
-- 4. 생성된 cron 작업 확인
-- ============================================================================
SELECT
  jobid,
  schedule,
  jobname,
  active,
  '매일 07:30 KST 실행 (반별 성과 분석 인사이트 생성)' AS schedule_description
FROM cron.job
WHERE jobname = 'generate-performance-insights';

-- ============================================================================
-- 5. 완료 메시지
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Performance Insights Cron 작업 생성 완료!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '생성된 작업:';
  RAISE NOTICE '  - generate-performance-insights: 매일 07:30 KST 실행';
  RAISE NOTICE '';
  RAISE NOTICE '기능:';
  RAISE NOTICE '  - 반별 출석 데이터 분석';
  RAISE NOTICE '  - ChatGPT 기반 AI 인사이트 생성';
  RAISE NOTICE '  - ai_insights 테이블에 결과 저장';
  RAISE NOTICE '';
END $$;
