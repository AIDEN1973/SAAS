-- ============================================
-- 파티션 마이그레이션 검증 및 실행 스크립트
-- ============================================
-- 이 스크립트를 Supabase Dashboard SQL Editor에서 실행하세요
-- Dashboard URL: https://supabase.com/dashboard/project/xawypsrotrfoyozhrsbb/sql

-- PART 1: 현재 파티션 상태 확인
\echo '=== 현재 파티션 테이블 확인 ==='
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
  AND (
    tablename LIKE 'execution_audit_runs_%'
    OR tablename LIKE 'execution_audit_steps_%'
    OR tablename LIKE 'automation_actions_%'
    OR tablename LIKE 'ai_decision_logs_%'
    OR tablename LIKE 'chatops_messages_%'
  )
ORDER BY tablename;

-- PART 2: 마이그레이션 실행 상태 확인
\echo '=== 마이그레이션 기록 확인 ==='
SELECT version, name, inserted_at
FROM supabase_migrations.schema_migrations
WHERE version::text LIKE '202601120000%'
ORDER BY version;

-- PART 3: pg_cron 스케줄 확인
\echo '=== pg_cron 스케줄 확인 ==='
SELECT
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname LIKE '%cleanup%' OR jobname LIKE '%drop%'
ORDER BY jobid;

-- PART 4: 보존 정책 함수 확인
\echo '=== 보존 정책 함수 확인 ==='
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (
    routine_name LIKE '%cleanup%'
    OR routine_name LIKE '%drop%'
    OR routine_name LIKE '%retention%'
  )
ORDER BY routine_name;
