-- ============================================
-- pg_cron 스케줄 전체 확인 스크립트 (Supabase Dashboard용)
-- ============================================
-- 이 스크립트를 Supabase Dashboard SQL Editor에서 실행하세요
-- Dashboard URL: https://supabase.com/dashboard/project/xawypsrotrfoyozhrsbb/sql

-- PART 1: pg_cron 확장 설치 확인
DO $$ BEGIN RAISE NOTICE '=== PART 1: pg_cron 확장 설치 확인 ==='; END $$;

SELECT
  extname as "확장명",
  extversion as "버전",
  CASE
    WHEN extname = 'pg_cron' THEN '✅ pg_cron 사용 가능'
    ELSE 'ℹ️  설치됨'
  END as "상태"
FROM pg_extension
WHERE extname IN ('pg_cron', 'pgcrypto', 'uuid-ossp')
ORDER BY extname;

-- PART 2: 등록된 모든 pg_cron 작업 확인
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '=== PART 2: 등록된 pg_cron 작업 목록 ==='; END $$;

SELECT
  jobid as "작업ID",
  jobname as "작업명",
  schedule as "스케줄",
  CASE
    WHEN active THEN '✅ 활성'
    ELSE '❌ 비활성'
  END as "상태",
  database as "DB"
FROM cron.job
ORDER BY jobname;

-- PART 3: 활성화된 스케줄만 확인
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '=== PART 3: 활성화된 스케줄 (active = true) ==='; END $$;

SELECT
  jobid as "ID",
  jobname as "작업명",
  schedule as "스케줄",
  CASE
    WHEN schedule = '0 18 * * *' THEN '매일 18:00 UTC (03:00 KST)'
    WHEN schedule = '30 0 1 * *' THEN '매월 1일 00:30 UTC (09:30 KST)'
    ELSE schedule
  END as "실행 시간",
  CASE
    WHEN active THEN '✅ 활성'
    ELSE '❌ 비활성'
  END as "상태"
FROM cron.job
WHERE active = true
ORDER BY schedule, jobname;

-- PART 4: 예상 스케줄 목록
DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== 예상 스케줄 (7개) ===';
  RAISE NOTICE '1. cleanup_consultation_summary_jobs_daily (0 18 * * *)';
  RAISE NOTICE '2. cleanup_ai_decision_logs_daily (0 18 * * *)';
  RAISE NOTICE '3. cleanup_automation_safety_state_daily (0 18 * * *)';
  RAISE NOTICE '4. cleanup_execution_audit_runs_daily (0 18 * * *)';
  RAISE NOTICE '5. cleanup_automation_actions_daily (0 18 * * *)';
  RAISE NOTICE '6. drop_old_chatops_partitions_daily (0 18 * * *)';
  RAISE NOTICE '7. create_next_month_chatops_partition_monthly (30 0 1 * *)';
  RAISE NOTICE '';
END $$;

-- PART 5: 각 스케줄별 실행 함수 확인
DO $$ BEGIN RAISE NOTICE '=== PART 4: 각 스케줄이 호출하는 함수 ==='; END $$;

SELECT
  jobname as "작업명",
  CASE
    WHEN command LIKE '%consultation_summary_jobs%' THEN 'cleanup_old_consultation_summary_jobs(30)'
    WHEN command LIKE '%ai_decision_logs%' THEN 'cleanup_old_ai_decision_logs(90)'
    WHEN command LIKE '%automation_safety_state%' THEN 'cleanup_old_automation_safety_state(30)'
    WHEN command LIKE '%execution_audit_runs%' THEN 'cleanup_old_execution_audit_runs(730, 1825)'
    WHEN command LIKE '%automation_actions%' THEN 'cleanup_old_automation_actions(730)'
    WHEN command LIKE '%chatops.*partition%' AND command LIKE '%drop%' THEN 'drop_old_chatops_message_partitions(30)'
    WHEN command LIKE '%chatops.*partition%' AND command LIKE '%create%' THEN 'create_next_month_chatops_partition()'
    ELSE LEFT(command, 50) || '...'
  END as "실행 함수",
  CASE
    WHEN command LIKE '%consultation_summary_jobs%' THEN '30일 경과 작업 삭제'
    WHEN command LIKE '%ai_decision_logs%' THEN '90일 경과 로그 삭제'
    WHEN command LIKE '%automation_safety_state%' THEN '30일 경과 상태 삭제'
    WHEN command LIKE '%execution_audit_runs%' THEN '일반 2년/회계 5년 차등 삭제'
    WHEN command LIKE '%automation_actions%' THEN '2년 경과 액션 삭제'
    WHEN command LIKE '%chatops.*partition%' AND command LIKE '%drop%' THEN '30일 경과 파티션 DROP'
    WHEN command LIKE '%chatops.*partition%' AND command LIKE '%create%' THEN '다음달 파티션 자동 생성'
    ELSE '알 수 없음'
  END as "설명"
FROM cron.job
WHERE active = true
ORDER BY jobname;

-- PART 6: 누락된 스케줄 확인
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '=== PART 5: 누락된 스케줄 확인 ==='; END $$;

WITH expected_jobs AS (
  SELECT unnest(ARRAY[
    'cleanup_consultation_summary_jobs_daily',
    'cleanup_ai_decision_logs_daily',
    'cleanup_automation_safety_state_daily',
    'cleanup_execution_audit_runs_daily',
    'cleanup_automation_actions_daily',
    'drop_old_chatops_partitions_daily',
    'create_next_month_chatops_partition_monthly'
  ]) as jobname
),
existing_jobs AS (
  SELECT jobname FROM cron.job WHERE active = true
)
SELECT
  e.jobname as "누락된 작업명",
  CASE
    WHEN e.jobname LIKE '%consultation_summary_jobs%' THEN '20260112000001'
    WHEN e.jobname LIKE '%ai_decision_logs%' THEN '20260112000002'
    WHEN e.jobname LIKE '%automation_safety_state%' THEN '20260112000003'
    WHEN e.jobname LIKE '%execution_audit_runs%' THEN '20260112000010'
    WHEN e.jobname LIKE '%automation_actions%' THEN '20260112000012'
    WHEN e.jobname LIKE '%drop.*chatops%' THEN '20260112000013'
    WHEN e.jobname LIKE '%create.*chatops%' THEN '20260112000015'
    ELSE '알 수 없음'
  END as "관련 마이그레이션"
FROM expected_jobs e
LEFT JOIN existing_jobs ex ON e.jobname = ex.jobname
WHERE ex.jobname IS NULL;

-- PART 7: 종합 점검 결과
DO $$
DECLARE
  cron_exists boolean;
  job_count int;
  expected_count int := 7;
BEGIN
  -- pg_cron 확장 확인
  SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) INTO cron_exists;

  -- 활성 작업 개수 확인
  SELECT COUNT(*) INTO job_count FROM cron.job WHERE active = true;

  -- 결과 출력
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '         종합 점검 결과';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

  IF cron_exists THEN
    RAISE NOTICE '✅ pg_cron 확장: 설치됨';
  ELSE
    RAISE NOTICE '❌ pg_cron 확장: 미설치 (CREATE EXTENSION pg_cron 필요)';
  END IF;

  RAISE NOTICE 'ℹ️  활성 작업 개수: % / % (예상)', job_count, expected_count;

  IF job_count = expected_count THEN
    RAISE NOTICE '✅ 모든 스케줄 정상 등록됨';
  ELSIF job_count > expected_count THEN
    RAISE NOTICE '⚠️  예상보다 많은 스케줄 (중복 확인 필요)';
  ELSIF job_count < expected_count THEN
    RAISE NOTICE '❌ 누락된 스케줄 있음 (위 "누락된 스케줄 확인" 섹션 참조)';
  END IF;

  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '다음 작업:';
  RAISE NOTICE '1. "누락된 스케줄 확인" 섹션에서 누락 여부 확인';
  RAISE NOTICE '2. 누락된 경우 관련 마이그레이션 파일 재실행';
  RAISE NOTICE '3. 보존 정책 함수 확인 (verify-retention-functions-supabase.sql)';
  RAISE NOTICE '';
END $$;
