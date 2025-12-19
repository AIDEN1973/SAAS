/**
 * Edge Functions Cron 작업 생성 (실제 값 사용)
 *
 * ⚠️ 중요: 이 파일을 실행하기 전에 다음 값을 확인하세요:
 * 1. 프로젝트 ref: Dashboard > Settings > General > Reference ID
 * 2. Service Role Key: Dashboard > Project Settings > API > Service Role Key
 *
 * 이 파일의 값들을 실제 값으로 수정한 후 실행하세요.
 */

-- ============================================================================
-- 1. 사전 확인
-- ============================================================================
DO $$
BEGIN
  -- pg_cron 확장 확인
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'pg_cron 확장이 활성화되지 않았습니다. Dashboard > Database > Extensions에서 활성화하세요.';
  END IF;

  -- pg_net 확장 확인
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION 'pg_net 확장이 활성화되지 않았습니다. Dashboard > Database > Extensions에서 활성화하세요.';
  END IF;

  RAISE NOTICE '✅ 필수 확장 확인 완료: pg_cron, pg_net';
END $$;

-- ============================================================================
-- 2. 실제 값 설정 (여기를 수정하세요!)
-- ============================================================================
-- ⚠️ 중요: 아래 값들을 실제 값으로 변경하세요!

-- 프로젝트 ref (코드에서 확인됨: xawypsrotrfoyozhrsbb)
-- ⚠️ 중요: 아래 SQL 쿼리에서 YOUR_SERVICE_ROLE_KEY를 실제 Service Role Key로 교체하세요!
--          Dashboard > Project Settings > API > Service Role Key에서 확인 가능

DO $$
BEGIN
  RAISE NOTICE '⚠️ 아래 cron.schedule 쿼리들을 실행하기 전에';
  RAISE NOTICE '   YOUR_SERVICE_ROLE_KEY를 실제 Service Role Key로 교체하세요!';
  RAISE NOTICE '';
  RAISE NOTICE '   Dashboard > Project Settings > API > Service Role Key';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- 3. 기존 cron 작업 삭제 (재설정 시)
-- ============================================================================
DO $$
DECLARE
  job_record RECORD;
BEGIN
  FOR job_record IN
    SELECT jobid, jobname
    FROM cron.job
    WHERE jobname IN (
      'auto-billing-generation',
      'student-task-card-generation',
      'ai-briefing-generation',
      'daily-statistics-update',
      'overdue-notification-scheduler'
    )
  LOOP
    PERFORM cron.unschedule(job_record.jobname);
    RAISE NOTICE '기존 cron 작업 삭제: %', job_record.jobname;
  END LOOP;
END $$;

-- ============================================================================
-- 4. Cron 작업 생성 (실제 값으로 수정 필요)
-- ============================================================================
-- ⚠️ 주의: 아래 쿼리에서 YOUR_PROJECT_REF와 YOUR_SERVICE_ROLE_KEY를
--          실제 값으로 교체한 후 실행하세요!

-- 자동 청구 생성 (매일 04:00 KST = 19:00 UTC 전날)
-- ⚠️ YOUR_SERVICE_ROLE_KEY를 실제 값으로 교체하세요!
SELECT cron.schedule(
  'auto-billing-generation',
  '0 19 * * *',  -- UTC 19:00 (KST 다음날 04:00)
  $$
  SELECT net.http_post(
    url := 'https://xawypsrotrfoyozhrsbb.supabase.co/functions/v1/auto-billing-generation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- StudentTaskCard 배치 생성 (매일 06:00 KST = 21:00 UTC 전날)
-- ⚠️ YOUR_SERVICE_ROLE_KEY를 실제 값으로 교체하세요!
SELECT cron.schedule(
  'student-task-card-generation',
  '0 21 * * *',  -- UTC 21:00 (KST 다음날 06:00)
  $$
  SELECT net.http_post(
    url := 'https://xawypsrotrfoyozhrsbb.supabase.co/functions/v1/student-task-card-generation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- AI 브리핑 카드 생성 (매일 07:00 KST = 22:00 UTC 전날)
-- ⚠️ YOUR_SERVICE_ROLE_KEY를 실제 값으로 교체하세요!
SELECT cron.schedule(
  'ai-briefing-generation',
  '0 22 * * *',  -- UTC 22:00 (KST 다음날 07:00)
  $$
  SELECT net.http_post(
    url := 'https://xawypsrotrfoyozhrsbb.supabase.co/functions/v1/ai-briefing-generation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 일일 통계 업데이트 (매일 23:59 KST = 14:59 UTC 당일)
-- ⚠️ YOUR_SERVICE_ROLE_KEY를 실제 값으로 교체하세요!
SELECT cron.schedule(
  'daily-statistics-update',
  '59 14 * * *',  -- UTC 14:59 (KST 23:59)
  $$
  SELECT net.http_post(
    url := 'https://xawypsrotrfoyozhrsbb.supabase.co/functions/v1/daily-statistics-update',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 미납 알림 자동 발송 (매일 09:00 KST = 00:00 UTC 당일)
-- ⚠️ YOUR_SERVICE_ROLE_KEY를 실제 값으로 교체하세요!
SELECT cron.schedule(
  'overdue-notification-scheduler',
  '0 0 * * *',  -- UTC 00:00 (KST 09:00)
  $$
  SELECT net.http_post(
    url := 'https://xawypsrotrfoyozhrsbb.supabase.co/functions/v1/overdue-notification-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================================
-- 5. 생성된 cron 작업 확인
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

