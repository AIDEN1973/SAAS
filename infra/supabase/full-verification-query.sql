-- ============================================
-- 파티션 및 보존 정책 전체 정밀 점검 쿼리
-- ============================================
-- Supabase Dashboard SQL Editor에서 실행
-- https://supabase.com/dashboard/project/xawypsrotrfoyozhrsbb/sql

-- ================================================================
-- SECTION 1: pg_cron 스케줄 전체 점검 (예상: 7개)
-- ================================================================

DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '========================================'; RAISE NOTICE 'SECTION 1: pg_cron 스케줄 전체 점검'; RAISE NOTICE '========================================'; END $$;

-- 1-1. 등록된 모든 스케줄 목록
SELECT
  jobid as "ID",
  jobname as "작업명",
  schedule as "스케줄",
  CASE
    WHEN schedule = '0 18 * * *' THEN '매일 03:00 KST'
    WHEN schedule = '30 0 1 * *' THEN '매월 1일 09:30 KST'
    ELSE schedule
  END as "실행 시간",
  CASE WHEN active THEN '✅ 활성' ELSE '❌ 비활성' END as "상태",
  LEFT(command, 60) || '...' as "명령어"
FROM cron.job
ORDER BY jobname;

-- 1-2. 예상 7개 스케줄 누락 확인
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '--- 누락된 스케줄 확인 (0개여야 정상) ---'; END $$;

WITH expected AS (
  SELECT unnest(ARRAY[
    'cleanup_consultation_summary_jobs_daily',
    'cleanup_ai_decision_logs_daily',
    'cleanup_automation_safety_state_daily',
    'cleanup_execution_audit_runs_daily',
    'cleanup_automation_actions_daily',
    'drop_old_chatops_partitions_daily',
    'create_next_month_chatops_partition_monthly'
  ]) as name
)
SELECT e.name as "누락된 스케줄"
FROM expected e
LEFT JOIN cron.job j ON j.jobname = e.name AND j.active = true
WHERE j.jobname IS NULL;

-- ================================================================
-- SECTION 2: 보존 정책 함수 전체 점검 (예상: 15개)
-- ================================================================

DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '========================================'; RAISE NOTICE 'SECTION 2: 보존 정책 함수 전체 점검'; RAISE NOTICE '========================================'; END $$;

-- 2-1. 모든 cleanup/drop/create 함수 목록
SELECT
  routine_name as "함수명",
  CASE
    WHEN routine_name LIKE '%admin%' THEN 'Admin (수동)'
    ELSE 'Auto (자동)'
  END as "유형",
  data_type as "반환 타입"
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (
    routine_name LIKE '%cleanup%'
    OR routine_name LIKE '%drop%old%'
    OR routine_name LIKE '%create_next%'
  )
ORDER BY
  CASE WHEN routine_name LIKE '%admin%' THEN 2 ELSE 1 END,
  routine_name;

-- 2-2. 예상 15개 함수 누락 확인
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '--- 누락된 함수 확인 (0개여야 정상) ---'; END $$;

WITH expected AS (
  SELECT unnest(ARRAY[
    'cleanup_old_consultation_summary_jobs',
    'cleanup_old_ai_decision_logs',
    'cleanup_old_automation_safety_state',
    'cleanup_old_execution_audit_runs',
    'cleanup_old_automation_actions',
    'cleanup_orphaned_execution_audit_steps',
    'drop_old_chatops_message_partitions',
    'create_next_month_chatops_partition',
    'admin_cleanup_consultation_summary_jobs',
    'admin_cleanup_ai_decision_logs',
    'admin_cleanup_automation_safety_state',
    'admin_cleanup_execution_audit_runs',
    'admin_cleanup_automation_actions',
    'admin_drop_old_chatops_partitions',
    'admin_create_next_month_chatops_partition'
  ]) as name
)
SELECT e.name as "누락된 함수"
FROM expected e
LEFT JOIN information_schema.routines r
  ON r.routine_schema = 'public' AND r.routine_name = e.name
WHERE r.routine_name IS NULL;

-- 2-3. 함수 파라미터 기본값 확인 (핵심 함수만)
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '--- 핵심 함수 파라미터 확인 ---'; END $$;

SELECT
  p.proname as "함수명",
  pg_get_function_arguments(p.oid) as "파라미터 (기본값 포함)"
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'cleanup_old_execution_audit_runs',
    'cleanup_old_automation_actions',
    'cleanup_old_ai_decision_logs',
    'drop_old_chatops_message_partitions'
  )
ORDER BY p.proname;

-- ================================================================
-- SECTION 3: 파티션 테이블 전체 점검 (5개 테이블)
-- ================================================================

DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '========================================'; RAISE NOTICE 'SECTION 3: 파티션 테이블 전체 점검'; RAISE NOTICE '========================================'; END $$;

-- 3-1. 각 테이블별 파티션 개수
SELECT
  CASE
    WHEN tablename LIKE 'execution_audit_runs_%' THEN 'execution_audit_runs'
    WHEN tablename LIKE 'execution_audit_steps_%' THEN 'execution_audit_steps'
    WHEN tablename LIKE 'automation_actions_%' THEN 'automation_actions'
    WHEN tablename LIKE 'ai_decision_logs_%' THEN 'ai_decision_logs'
    WHEN tablename LIKE 'chatops_messages_%' THEN 'chatops_messages'
  END as "테이블",
  COUNT(*) as "파티션 개수",
  CASE
    WHEN tablename LIKE 'chatops_messages_%' THEN '월별 (자동 증가)'
    ELSE '연도별 (2025-2075)'
  END as "파티션 유형"
FROM pg_tables
WHERE schemaname = 'public'
  AND (
    tablename LIKE 'execution_audit_runs_%'
    OR tablename LIKE 'execution_audit_steps_%'
    OR tablename LIKE 'automation_actions_%'
    OR tablename LIKE 'ai_decision_logs_%'
    OR tablename LIKE 'chatops_messages_%'
  )
GROUP BY 1, 3
ORDER BY 1;

-- 3-2. 파티션 범위 확인 (첫 번째/마지막)
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '--- 파티션 범위 확인 (첫/끝) ---'; END $$;

SELECT 'execution_audit_runs' as "테이블",
  MIN(tablename) as "첫 파티션",
  MAX(tablename) as "마지막 파티션"
FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'execution_audit_runs_20%'
UNION ALL
SELECT 'execution_audit_steps',
  MIN(tablename), MAX(tablename)
FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'execution_audit_steps_20%'
UNION ALL
SELECT 'automation_actions',
  MIN(tablename), MAX(tablename)
FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'automation_actions_20%'
UNION ALL
SELECT 'ai_decision_logs',
  MIN(tablename), MAX(tablename)
FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'ai_decision_logs_20%'
UNION ALL
SELECT 'chatops_messages',
  MIN(tablename), MAX(tablename)
FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'chatops_messages_20%';

-- 3-3. chatops_messages 파티션 상세 (월별)
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '--- chatops_messages 월별 파티션 상세 ---'; END $$;

SELECT
  tablename as "파티션명",
  pg_size_pretty(pg_total_relation_size('public.' || tablename)) as "크기"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'chatops_messages_20%'
ORDER BY tablename;

-- ================================================================
-- SECTION 4: 인덱스 일관성 점검
-- ================================================================

DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '========================================'; RAISE NOTICE 'SECTION 4: 인덱스 일관성 점검'; RAISE NOTICE '========================================'; END $$;

-- 4-1. 파티션별 인덱스 개수 확인
SELECT
  CASE
    WHEN tablename LIKE 'execution_audit_runs_%' THEN 'execution_audit_runs'
    WHEN tablename LIKE 'execution_audit_steps_%' THEN 'execution_audit_steps'
    WHEN tablename LIKE 'automation_actions_%' THEN 'automation_actions'
    WHEN tablename LIKE 'ai_decision_logs_%' THEN 'ai_decision_logs'
    WHEN tablename LIKE 'chatops_messages_%' THEN 'chatops_messages'
  END as "테이블",
  COUNT(DISTINCT tablename) as "파티션 수",
  COUNT(*) as "총 인덱스 수",
  ROUND(COUNT(*)::numeric / COUNT(DISTINCT tablename), 1) as "파티션당 인덱스"
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    tablename LIKE 'execution_audit_runs_%'
    OR tablename LIKE 'execution_audit_steps_%'
    OR tablename LIKE 'automation_actions_%'
    OR tablename LIKE 'ai_decision_logs_%'
    OR tablename LIKE 'chatops_messages_%'
  )
GROUP BY 1
ORDER BY 1;

-- 4-2. 인덱스 누락된 파티션 확인 (샘플)
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '--- 인덱스 확인 (execution_audit_runs_2026 샘플) ---'; END $$;

SELECT
  indexname as "인덱스명",
  indexdef as "인덱스 정의"
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'execution_audit_runs_2026'
ORDER BY indexname;

-- ================================================================
-- SECTION 5: RLS 정책 점검
-- ================================================================

DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '========================================'; RAISE NOTICE 'SECTION 5: RLS 정책 점검'; RAISE NOTICE '========================================'; END $$;

-- 5-1. RLS 활성화 상태
SELECT
  relname as "테이블",
  CASE WHEN relrowsecurity THEN '✅ 활성' ELSE '❌ 비활성' END as "RLS 상태"
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'execution_audit_runs',
    'execution_audit_steps',
    'automation_actions',
    'ai_decision_logs',
    'chatops_messages'
  )
ORDER BY relname;

-- 5-2. RLS 정책 목록
SELECT
  schemaname as "스키마",
  tablename as "테이블",
  policyname as "정책명",
  cmd as "적용 명령"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'execution_audit_runs',
    'execution_audit_steps',
    'automation_actions',
    'ai_decision_logs',
    'chatops_messages'
  )
ORDER BY tablename, policyname;

-- ================================================================
-- SECTION 6: 삭제 대상 데이터 확인 (DRY RUN)
-- ================================================================

DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '========================================'; RAISE NOTICE 'SECTION 6: 삭제 대상 데이터 확인'; RAISE NOTICE '========================================'; END $$;

-- 6-1. 각 테이블별 삭제 대상 개수
SELECT 'consultation_summary_jobs' as "테이블", '30일' as "보존", COUNT(*) as "삭제 대상"
FROM public.consultation_summary_jobs
WHERE (status = 'completed' AND completed_at < now() - interval '30 days')
   OR (status = 'failed' AND created_at < now() - interval '30 days')
UNION ALL
SELECT 'ai_decision_logs', '90일', COUNT(*)
FROM public.ai_decision_logs
WHERE created_at < now() - interval '90 days'
UNION ALL
SELECT 'automation_safety_state', '30일', COUNT(*)
FROM public.automation_safety_state
WHERE window_end < now() - interval '30 days'
UNION ALL
SELECT 'execution_audit_runs (일반)', '2년', COUNT(*)
FROM public.execution_audit_runs
WHERE occurred_at < now() - interval '730 days'
  AND operation_type NOT IN ('send-invoice','process-payment','issue-refund','generate-billing','update-billing','cancel-payment')
UNION ALL
SELECT 'execution_audit_runs (회계)', '5년', COUNT(*)
FROM public.execution_audit_runs
WHERE occurred_at < now() - interval '1825 days'
  AND operation_type IN ('send-invoice','process-payment','issue-refund','generate-billing','update-billing','cancel-payment')
UNION ALL
SELECT 'automation_actions', '2년', COUNT(*)
FROM public.automation_actions
WHERE executed_at < now() - interval '730 days';

-- 6-2. chatops_messages DROP 대상 파티션
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '--- chatops_messages DROP 대상 파티션 ---'; END $$;

SELECT
  tablename as "파티션명",
  TO_DATE(SUBSTRING(tablename FROM 'chatops_messages_([0-9]{4}_[0-9]{2})$'), 'YYYY_MM') as "파티션 월",
  CURRENT_DATE - interval '30 days' as "30일 전 기준",
  '⚠️ DROP 대상' as "상태"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'chatops_messages_%'
  AND tablename ~ 'chatops_messages_[0-9]{4}_[0-9]{2}$'
  AND TO_DATE(SUBSTRING(tablename FROM 'chatops_messages_([0-9]{4}_[0-9]{2})$'), 'YYYY_MM') < CURRENT_DATE - interval '30 days';

-- ================================================================
-- SECTION 7: 종합 점검 결과
-- ================================================================

DO $$
DECLARE
  cron_count int;
  func_count int;
  partition_total int;
  ear_count int;
  eas_count int;
  aa_count int;
  adl_count int;
  cm_count int;
BEGIN
  -- pg_cron 개수
  SELECT COUNT(*) INTO cron_count FROM cron.job WHERE active = true;

  -- 함수 개수
  SELECT COUNT(*) INTO func_count
  FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND (routine_name LIKE '%cleanup%' OR routine_name LIKE '%drop%old%' OR routine_name LIKE '%create_next%');

  -- 파티션 개수
  SELECT COUNT(*) INTO ear_count FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'execution_audit_runs_%';
  SELECT COUNT(*) INTO eas_count FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'execution_audit_steps_%';
  SELECT COUNT(*) INTO aa_count FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'automation_actions_%';
  SELECT COUNT(*) INTO adl_count FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'ai_decision_logs_%';
  SELECT COUNT(*) INTO cm_count FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'chatops_messages_%';
  partition_total := ear_count + eas_count + aa_count + adl_count + cm_count;

  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '                  종합 점검 결과                        ';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';

  -- pg_cron 결과
  IF cron_count = 7 THEN
    RAISE NOTICE '✅ pg_cron 스케줄: % / 7 (정상)', cron_count;
  ELSE
    RAISE NOTICE '❌ pg_cron 스케줄: % / 7 (비정상)', cron_count;
  END IF;

  -- 함수 결과
  IF func_count = 15 THEN
    RAISE NOTICE '✅ 보존 정책 함수: % / 15 (정상)', func_count;
  ELSE
    RAISE NOTICE '❌ 보존 정책 함수: % / 15 (비정상)', func_count;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '--- 파티션 개수 ---';

  IF ear_count = 51 THEN
    RAISE NOTICE '✅ execution_audit_runs: % / 51', ear_count;
  ELSE
    RAISE NOTICE '❌ execution_audit_runs: % / 51', ear_count;
  END IF;

  IF eas_count = 51 THEN
    RAISE NOTICE '✅ execution_audit_steps: % / 51', eas_count;
  ELSE
    RAISE NOTICE '❌ execution_audit_steps: % / 51', eas_count;
  END IF;

  IF aa_count = 51 THEN
    RAISE NOTICE '✅ automation_actions: % / 51', aa_count;
  ELSE
    RAISE NOTICE '❌ automation_actions: % / 51', aa_count;
  END IF;

  IF adl_count = 51 THEN
    RAISE NOTICE '✅ ai_decision_logs: % / 51', adl_count;
  ELSE
    RAISE NOTICE '❌ ai_decision_logs: % / 51', adl_count;
  END IF;

  IF cm_count >= 13 THEN
    RAISE NOTICE '✅ chatops_messages: % (월별, 13개 이상)', cm_count;
  ELSE
    RAISE NOTICE '⚠️ chatops_messages: % (월별, 예상보다 적음)', cm_count;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '총 파티션 수: %', partition_total;
  RAISE NOTICE '';

  -- 최종 판정
  IF cron_count = 7 AND func_count = 15 AND ear_count = 51 AND eas_count = 51 AND aa_count = 51 AND adl_count = 51 AND cm_count >= 13 THEN
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '🎉 모든 점검 항목 정상! 자동화 완료!';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  ELSE
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '⚠️ 일부 항목 확인 필요';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  END IF;

  RAISE NOTICE '';
END $$;
