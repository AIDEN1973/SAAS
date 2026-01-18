-- pg_cron 스케줄 자동 등록
-- 작성일: 2026-01-18

-- 학년 자동 상향 스케줄 등록
-- 매년 1월 1일 00:00:00에 실행
DO $$
BEGIN
  -- pg_cron 확장이 설치되어 있는지 확인
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- 기존 스케줄이 있으면 삭제
    IF EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'upgrade-student-grades-yearly'
    ) THEN
      PERFORM cron.unschedule('upgrade-student-grades-yearly');
      RAISE NOTICE '기존 학년 자동 상향 스케줄을 삭제했습니다.';
    END IF;

    -- 새로운 스케줄 등록
    PERFORM cron.schedule(
      'upgrade-student-grades-yearly',  -- 작업 이름
      '0 0 1 1 *',                       -- 매년 1월 1일 00:00:00 (Cron 표현식)
      $$SELECT public.upgrade_student_grades();$$
    );

    RAISE NOTICE '학년 자동 상향 스케줄이 등록되었습니다.';
    RAISE NOTICE '실행 시간: 매년 1월 1일 00:00:00';
  ELSE
    RAISE WARNING 'pg_cron 확장이 설치되지 않았습니다.';
    RAISE NOTICE 'Supabase Dashboard -> Database -> Extensions에서 pg_cron을 활성화한 후 이 마이그레이션을 다시 실행하세요.';
  END IF;
END $$;
