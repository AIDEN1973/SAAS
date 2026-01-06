-- Migration: Create Worker Cron Job
-- Description: Worker 프로세스를 주기적으로 실행하여 실패한 job 재시도 및 누락된 job 처리
-- ChatOps_계약_붕괴_방지_체계_분석.md 4.7 참조
-- Date: 2025-01-28

-- ⚠️ 중요: Worker는 job 생성 후 즉시 호출되지만, Cron은 이중 안전장치로 필요합니다.
-- - 즉시 실행이 실패한 경우 재시도
-- - 누락된 job 처리
-- - 재시도가 필요한 job 처리

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
-- 2. 기존 Worker Cron 작업 삭제 (재설정 시)
-- ============================================================================
DO $$
DECLARE
  job_record RECORD;
BEGIN
  FOR job_record IN
    SELECT jobid, jobname
    FROM cron.job
    WHERE jobname = 'worker-process-job'
  LOOP
    PERFORM cron.unschedule(job_record.jobname);
    RAISE NOTICE '기존 cron 작업 삭제: %', job_record.jobname;
  END LOOP;
END $$;

-- ============================================================================
-- 3. Worker Cron 작업 생성
-- ============================================================================
-- ⚠️ 보안 주의: 이 파일에는 Service Role Key가 포함되어 있습니다.
--               Git에 커밋하기 전에 확인하세요!

-- Worker 프로세스 실행 (1분마다)
-- ⚠️ 보안 주의: Service Role Key는 실제 값으로 교체해야 합니다.
--    Dashboard > Project Settings > API > Service Role Key
--    기존 다른 cron 작업과 동일한 Service Role Key를 사용합니다.
SELECT cron.schedule(
  'worker-process-job',
  '* * * * *',  -- 1분마다 실행
  $$
  SELECT net.http_post(
    url := 'https://xawypsrotrfoyozhrsbb.supabase.co/functions/v1/worker-process-job',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhhd3lwc3JvdHJmb3lvemhyc2JiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDk0NDYwNiwiZXhwIjoyMDgwNTIwNjA2fQ.s1t72EahAuqROS3d334ERIEpgiZGMs-lxCb2BGVkjZo'
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
  '1분마다 실행 (실패한 job 재시도 및 누락된 job 처리)' AS schedule_description
FROM cron.job
WHERE jobname = 'worker-process-job';

-- ============================================================================
-- 5. 참고: Cron 작업 관리 명령어
-- ============================================================================
-- Cron 작업 목록 조회:
--   SELECT * FROM cron.job WHERE jobname = 'worker-process-job';
--
-- Cron 작업 비활성화:
--   UPDATE cron.job SET active = false WHERE jobname = 'worker-process-job';
--
-- Cron 작업 활성화:
--   UPDATE cron.job SET active = true WHERE jobname = 'worker-process-job';
--
-- Cron 작업 삭제:
--   SELECT cron.unschedule('worker-process-job');
--
-- Cron 작업 실행 이력 조회:
--   SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'worker-process-job');

COMMENT ON TABLE job_executions IS 'Worker 아키텍처를 위한 job 실행 테이블. Cron 작업(worker-process-job)이 1분마다 pending 상태의 job을 처리합니다.';

-- ============================================================================
-- 6. 완료 메시지
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Worker Cron 작업 생성 완료!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '생성된 작업:';
  RAISE NOTICE '  - worker-process-job: 1분마다 실행';
  RAISE NOTICE '';
  RAISE NOTICE '기능:';
  RAISE NOTICE '  - 실패한 job 재시도';
  RAISE NOTICE '  - 누락된 job 처리';
  RAISE NOTICE '  - 재시도가 필요한 job 처리';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ 보안 주의:';
  RAISE NOTICE '   이 파일에는 Service Role Key가 포함되어 있습니다.';
  RAISE NOTICE '   Git에 커밋하기 전에 확인하세요!';
  RAISE NOTICE '';
END $$;

