-- pg_cron 상태 확인 스크립트
-- Supabase SQL Editor에서 실행하세요

-- 1. pg_cron 확장 설치 확인
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
    THEN '✅ pg_cron 확장이 설치되어 있습니다.'
    ELSE '❌ pg_cron 확장이 설치되지 않았습니다. Extensions에서 활성화하세요.'
  END AS pg_cron_status;

-- 2. 학년 자동 상향 함수 확인
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_proc
      WHERE proname = 'upgrade_student_grades'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    )
    THEN '✅ upgrade_student_grades() 함수가 존재합니다.'
    ELSE '❌ upgrade_student_grades() 함수가 존재하지 않습니다.'
  END AS function_status;

-- 3. 등록된 cron 작업 확인 (pg_cron이 설치되어 있을 때만)
SELECT
  jobid,
  jobname,
  schedule,
  command,
  active,
  CASE
    WHEN jobname = 'upgrade-student-grades-yearly' THEN '✅ 학년 자동 상향 스케줄'
    ELSE jobname
  END AS description
FROM cron.job
WHERE EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
ORDER BY jobid;

-- 4. 학년 자동 상향 스케줄 상세 정보
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM cron.job
      WHERE jobname = 'upgrade-student-grades-yearly'
      AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
    )
    THEN '✅ 학년 자동 상향 스케줄이 등록되어 있습니다.'
    ELSE '❌ 학년 자동 상향 스케줄이 등록되지 않았습니다.'
  END AS schedule_status;

-- 5. 다음 실행 시간 확인 (cron 표현식 해석)
SELECT
  jobname,
  schedule,
  '매년 1월 1일 00:00:00' AS next_run_description
FROM cron.job
WHERE jobname = 'upgrade-student-grades-yearly'
AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron');

-- 6. 마지막 실행 기록 확인 (cron.job_run_details 테이블)
SELECT
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid IN (
  SELECT jobid FROM cron.job WHERE jobname = 'upgrade-student-grades-yearly'
)
AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
ORDER BY start_time DESC
LIMIT 10;

-- 7. 현재 academy_students 테이블의 학년 분포 확인
SELECT
  grade,
  COUNT(*) AS student_count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM public.academy_students WHERE grade IS NOT NULL), 2) AS percentage
FROM public.academy_students
WHERE grade IS NOT NULL
GROUP BY grade
ORDER BY
  CASE
    WHEN grade = '4세' THEN 1
    WHEN grade = '5세' THEN 2
    WHEN grade = '6세' THEN 3
    WHEN grade = '7세' THEN 4
    WHEN grade = '초등 1학년' THEN 5
    WHEN grade = '초등 2학년' THEN 6
    WHEN grade = '초등 3학년' THEN 7
    WHEN grade = '초등 4학년' THEN 8
    WHEN grade = '초등 5학년' THEN 9
    WHEN grade = '초등 6학년' THEN 10
    WHEN grade = '중등 1학년' THEN 11
    WHEN grade = '중등 2학년' THEN 12
    WHEN grade = '중등 3학년' THEN 13
    WHEN grade = '고등 1학년' THEN 14
    WHEN grade = '고등 2학년' THEN 15
    WHEN grade = '고등 3학년' THEN 16
    WHEN grade = '기타' THEN 17
    ELSE 18
  END;

-- 8. pg_cron 수동 설정 가이드 (pg_cron이 설치되었지만 스케줄이 없을 때)
SELECT
  '다음 SQL을 실행하여 스케줄을 등록하세요:' AS guide,
  $guide$
SELECT cron.schedule(
  'upgrade-student-grades-yearly',
  '0 0 1 1 *',
  $$SELECT public.upgrade_student_grades();$$
);
$guide$ AS setup_command
WHERE EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
AND NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'upgrade-student-grades-yearly');
