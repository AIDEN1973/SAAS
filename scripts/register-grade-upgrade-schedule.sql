-- 학년 자동 상향 스케줄 수동 등록
-- Supabase SQL Editor에서 이 스크립트를 실행하세요

-- 1. 기존 스케줄이 있으면 먼저 삭제
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'upgrade-student-grades-yearly'
  ) THEN
    PERFORM cron.unschedule('upgrade-student-grades-yearly');
    RAISE NOTICE '기존 스케줄을 삭제했습니다.';
  END IF;
END $$;

-- 2. 새로운 스케줄 등록
SELECT cron.schedule(
  'upgrade-student-grades-yearly',  -- 작업 이름
  '0 0 1 1 *',                       -- 매년 1월 1일 00:00:00 (Cron 표현식: 분 시 일 월 요일)
  $$SELECT public.upgrade_student_grades();$$  -- 실행할 SQL
);

-- 3. 등록 확인
SELECT
  jobid,
  jobname,
  schedule,
  active,
  '✅ 스케줄이 성공적으로 등록되었습니다!' AS status
FROM cron.job
WHERE jobname = 'upgrade-student-grades-yearly';

-- 4. 스케줄 정보 확인
SELECT
  '매년 1월 1일 00:00:00 (서버 시간 기준)' AS execution_time,
  '모든 학생의 학년을 한 단계 상향 조정합니다.' AS description,
  '고등 3학년과 기타는 변경되지 않습니다.' AS note;
