-- Migration: Phase 2 AI Insights Cron Jobs
-- Description: Phase 2 AI 인사이트 기능들의 cron 작업 설정
-- Date: 2026-01-03
--
-- 추가되는 Cron 작업:
-- 1. ai-briefing-generation: 매일 07:00 KST (daily briefing)
-- 2. proactive-recommendation: 매일 08:00 KST (선제적 추천)
-- 3. meta-automation-pattern: 매주 월요일 06:00 KST (자동화 패턴 분석)
-- 4. daily-automation-digest: 매일 23:00 KST (일일 자동화 요약)

-- ============================================================================
-- 1. pg_cron 및 pg_net 확장 확인
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'pg_cron 확장이 활성화되지 않았습니다.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION 'pg_net 확장이 활성화되지 않았습니다.';
  END IF;

  RAISE NOTICE '✅ 필수 확장 확인 완료: pg_cron, pg_net';
END $$;

-- ============================================================================
-- 2. 기존 Phase 2 Cron 작업 삭제 (재설정 시)
-- ============================================================================
DO $$
DECLARE
  job_names TEXT[] := ARRAY[
    'ai-briefing-generation',
    'proactive-recommendation',
    'meta-automation-pattern',
    'daily-automation-digest'
  ];
  job_name TEXT;
  job_record RECORD;
BEGIN
  FOREACH job_name IN ARRAY job_names LOOP
    FOR job_record IN
      SELECT jobid, jobname
      FROM cron.job
      WHERE jobname = job_name
    LOOP
      PERFORM cron.unschedule(job_record.jobname);
      RAISE NOTICE '기존 cron 작업 삭제: %', job_record.jobname;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- 3. AI Briefing Generation Cron (매일 07:00 KST = 22:00 UTC 전일)
-- ============================================================================
SELECT cron.schedule(
  'ai-briefing-generation',
  '0 22 * * *',  -- 매일 22:00 UTC (다음날 07:00 KST)
  $$
  SELECT net.http_post(
    url := 'https://xawypsrotrfoyozhrsbb.supabase.co/functions/v1/ai-briefing-generation',
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
-- 4. Proactive Recommendation Cron (매일 08:00 KST = 23:00 UTC 전일)
-- ============================================================================
SELECT cron.schedule(
  'proactive-recommendation',
  '0 23 * * *',  -- 매일 23:00 UTC (다음날 08:00 KST)
  $$
  SELECT net.http_post(
    url := 'https://xawypsrotrfoyozhrsbb.supabase.co/functions/v1/proactive-recommendation',
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
-- 5. Meta Automation Pattern Cron (매주 월요일 06:00 KST = 일요일 21:00 UTC)
-- ============================================================================
SELECT cron.schedule(
  'meta-automation-pattern',
  '0 21 * * 0',  -- 매주 일요일 21:00 UTC (월요일 06:00 KST)
  $$
  SELECT net.http_post(
    url := 'https://xawypsrotrfoyozhrsbb.supabase.co/functions/v1/meta-automation-pattern',
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
-- 6. Daily Automation Digest Cron (매일 23:00 KST = 14:00 UTC)
-- ============================================================================
SELECT cron.schedule(
  'daily-automation-digest',
  '0 14 * * *',  -- 매일 14:00 UTC (23:00 KST)
  $$
  SELECT net.http_post(
    url := 'https://xawypsrotrfoyozhrsbb.supabase.co/functions/v1/daily-automation-digest',
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
-- 7. 생성된 cron 작업 확인
-- ============================================================================
SELECT
  jobid,
  schedule,
  jobname,
  active,
  CASE jobname
    WHEN 'ai-briefing-generation' THEN '매일 07:00 KST (일일 AI 브리핑)'
    WHEN 'proactive-recommendation' THEN '매일 08:00 KST (선제적 추천)'
    WHEN 'meta-automation-pattern' THEN '매주 월요일 06:00 KST (자동화 패턴 분석)'
    WHEN 'daily-automation-digest' THEN '매일 23:00 KST (일일 자동화 요약)'
    ELSE '기타'
  END AS schedule_description
FROM cron.job
WHERE jobname IN (
  'ai-briefing-generation',
  'proactive-recommendation',
  'meta-automation-pattern',
  'daily-automation-digest'
);

-- ============================================================================
-- 8. 완료 메시지
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Phase 2 AI Insights Cron 작업 생성 완료!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '생성된 작업:';
  RAISE NOTICE '  1. ai-briefing-generation: 매일 07:00 KST';
  RAISE NOTICE '     - 오늘의 일정, 수납 현황, 이상 패턴 요약';
  RAISE NOTICE '';
  RAISE NOTICE '  2. proactive-recommendation: 매일 08:00 KST';
  RAISE NOTICE '     - 수납 마감 알림, 이탈 방지, 상담 추천 등';
  RAISE NOTICE '';
  RAISE NOTICE '  3. meta-automation-pattern: 매주 월요일 06:00 KST';
  RAISE NOTICE '     - 주간 자동화 실행 패턴 분석';
  RAISE NOTICE '';
  RAISE NOTICE '  4. daily-automation-digest: 매일 23:00 KST';
  RAISE NOTICE '     - 오늘 실행된 자동화 작업 요약';
  RAISE NOTICE '';
END $$;
