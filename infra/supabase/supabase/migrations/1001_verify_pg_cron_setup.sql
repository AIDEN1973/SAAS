-- pg_cron 확장 및 스케줄러 설정 확인
-- 작성일: 2026-01-18

-- 1. pg_cron 확장이 설치되어 있는지 확인
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    RAISE NOTICE 'pg_cron 확장이 활성화되어 있습니다.';
  ELSE
    RAISE WARNING 'pg_cron 확장이 설치되지 않았습니다. Supabase Dashboard에서 활성화해주세요.';
    RAISE NOTICE '활성화 방법: Dashboard -> Database -> Extensions -> pg_cron 검색 후 활성화';
  END IF;
END $$;

-- 2. 학년 자동 상향 스케줄이 등록되어 있는지 확인
DO $$
DECLARE
  cron_count INTEGER;
BEGIN
  -- pg_cron이 설치되어 있을 때만 실행
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT COUNT(*) INTO cron_count
    FROM cron.job
    WHERE jobname = 'upgrade-student-grades-yearly';

    IF cron_count > 0 THEN
      RAISE NOTICE '학년 자동 상향 스케줄이 등록되어 있습니다.';

      -- 등록된 스케줄 정보 출력
      RAISE NOTICE '스케줄 정보:';
      PERFORM
        RAISE NOTICE '  - Job ID: %, Schedule: %, Command: %',
        jobid, schedule, command
      FROM cron.job
      WHERE jobname = 'upgrade-student-grades-yearly';
    ELSE
      RAISE WARNING '학년 자동 상향 스케줄이 등록되지 않았습니다.';
      RAISE NOTICE '다음 SQL을 실행하여 스케줄을 등록하세요:';
      RAISE NOTICE 'SELECT cron.schedule(';
      RAISE NOTICE '  ''upgrade-student-grades-yearly'',';
      RAISE NOTICE '  ''0 0 1 1 *'',';
      RAISE NOTICE '  $$SELECT public.upgrade_student_grades();$$';
      RAISE NOTICE ');';
    END IF;
  END IF;
END $$;

-- 3. 학년 자동 상향 함수가 존재하는지 확인
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'upgrade_student_grades'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    RAISE NOTICE '학년 자동 상향 함수(upgrade_student_grades)가 존재합니다.';
  ELSE
    RAISE WARNING '학년 자동 상향 함수(upgrade_student_grades)가 존재하지 않습니다.';
  END IF;
END $$;

-- 4. 현재 등록된 모든 cron 작업 조회 (정보용)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE '=== 현재 등록된 모든 cron 작업 ===';
    PERFORM
      RAISE NOTICE 'Job ID: %, Name: %, Schedule: %, Active: %',
      jobid, jobname, schedule, active
    FROM cron.job
    ORDER BY jobid;
  END IF;
END $$;
