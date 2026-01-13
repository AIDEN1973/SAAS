-- ============================================
-- 보존 정책 함수 전체 확인 스크립트
-- ============================================
-- 이 스크립트를 Supabase Dashboard SQL Editor에서 실행하세요
-- Dashboard URL: https://supabase.com/dashboard/project/xawypsrotrfoyozhrsbb/sql

-- PART 1: 모든 보존 정책 함수 목록
\echo '=== 보존 정책 함수 목록 (cleanup/drop 함수) ==='
SELECT
  routine_name as "함수명",
  routine_type as "타입",
  data_type as "반환 타입",
  CASE
    WHEN routine_name LIKE '%admin%' THEN 'Admin (수동 실행용)'
    WHEN routine_name LIKE '%cleanup%' THEN 'Cleanup (자동 실행용)'
    WHEN routine_name LIKE '%drop%' THEN 'Drop Partition (자동 실행용)'
    WHEN routine_name LIKE '%create_next%' THEN 'Create Partition (자동 실행용)'
    ELSE 'Other'
  END as "용도"
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (
    routine_name LIKE '%cleanup%'
    OR routine_name LIKE '%drop%'
    OR routine_name LIKE '%create_next%'
  )
ORDER BY
  CASE
    WHEN routine_name LIKE '%admin%' THEN 2
    ELSE 1
  END,
  routine_name;

\echo ''
\echo '=== 예상 함수 (14개) ==='
\echo '자동 실행용 (7개):'
\echo '  1. cleanup_old_consultation_summary_jobs'
\echo '  2. cleanup_old_ai_decision_logs'
\echo '  3. cleanup_old_automation_safety_state'
\echo '  4. cleanup_old_execution_audit_runs'
\echo '  5. cleanup_old_automation_actions'
\echo '  6. drop_old_chatops_message_partitions'
\echo '  7. create_next_month_chatops_partition'
\echo ''
\echo '관리자 수동 실행용 (7개):'
\echo '  8. admin_cleanup_consultation_summary_jobs'
\echo '  9. admin_cleanup_ai_decision_logs'
\echo ' 10. admin_cleanup_automation_safety_state'
\echo ' 11. admin_cleanup_execution_audit_runs'
\echo ' 12. admin_cleanup_automation_actions'
\echo ' 13. admin_drop_old_chatops_partitions'
\echo ' 14. admin_create_next_month_chatops_partition'
\echo ''
\echo '기타 (선택):'
\echo ' 15. cleanup_orphaned_execution_audit_steps (orphaned steps 정리용)'
\echo ''

-- PART 2: 함수 파라미터 확인
\echo '=== 각 함수의 파라미터 및 기본값 ==='
SELECT
  p.proname as "함수명",
  pg_get_function_arguments(p.oid) as "파라미터",
  CASE
    WHEN p.proname LIKE '%consultation_summary_jobs%' THEN '30일'
    WHEN p.proname LIKE '%ai_decision_logs%' THEN '90일'
    WHEN p.proname LIKE '%automation_safety_state%' THEN '30일'
    WHEN p.proname LIKE '%execution_audit_runs%' THEN '일반 730일(2년), 회계 1825일(5년)'
    WHEN p.proname LIKE '%automation_actions%' THEN '730일(2년)'
    WHEN p.proname LIKE '%chatops%' AND p.proname LIKE '%drop%' THEN '30일'
    WHEN p.proname LIKE '%chatops%' AND p.proname LIKE '%create%' THEN '파라미터 없음 (자동 계산)'
    WHEN p.proname LIKE '%orphaned%' THEN '파라미터 없음'
    ELSE '알 수 없음'
  END as "보존 기간"
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
    p.proname LIKE '%cleanup%'
    OR p.proname LIKE '%drop%'
    OR p.proname LIKE '%create_next%'
  )
ORDER BY
  CASE
    WHEN p.proname LIKE '%admin%' THEN 2
    ELSE 1
  END,
  p.proname;

\echo ''

-- PART 3: 함수별 권한 확인
\echo '=== 함수 실행 권한 확인 ==='
SELECT
  p.proname as "함수명",
  array_to_string(array_agg(DISTINCT pr.rolname), ', ') as "실행 권한 있는 롤"
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
LEFT JOIN pg_proc_acl pa ON p.oid = pa.oid
LEFT JOIN pg_roles pr ON pa.grantee = pr.oid
WHERE n.nspname = 'public'
  AND (
    p.proname LIKE '%cleanup%'
    OR p.proname LIKE '%drop%'
    OR p.proname LIKE '%create_next%'
  )
GROUP BY p.proname
ORDER BY p.proname;

\echo ''
\echo 'ℹ️  예상 권한:'
\echo '  - 자동 실행 함수: service_role'
\echo '  - 관리자 함수: authenticated, service_role'
\echo ''

-- PART 4: 각 테이블별 보존 정책 요약
\echo '=== 테이블별 보존 정책 요약 ==='
SELECT
  '1. consultation_summary_jobs' as "테이블명",
  '30일' as "보존 기간",
  '법적 의무 없음' as "법적 근거",
  'cleanup_old_consultation_summary_jobs(30)' as "정리 함수",
  '일반 테이블' as "파티션 여부"
UNION ALL
SELECT
  '2. ai_decision_logs',
  '90일',
  'ISMS 6개월 권장',
  'cleanup_old_ai_decision_logs(90)',
  '연도별 (2025-2075, 51년)'
UNION ALL
SELECT
  '3. automation_safety_state',
  '30일',
  '법적 의무 없음',
  'cleanup_old_automation_safety_state(30)',
  '일반 테이블'
UNION ALL
SELECT
  '4. execution_audit_runs',
  '2년(일반) / 5년(회계)',
  '개인정보보호법 2년 / 국세기본법 5년',
  'cleanup_old_execution_audit_runs(730, 1825)',
  '연도별 (2025-2075, 51년)'
UNION ALL
SELECT
  '5. execution_audit_steps',
  'CASCADE (상위 run 삭제시)',
  '상위 run 정책 준수',
  'cleanup_orphaned_execution_audit_steps()',
  '연도별 (2025-2075, 51년)'
UNION ALL
SELECT
  '6. automation_actions',
  '2년',
  '개인정보보호법 2년',
  'cleanup_old_automation_actions(730)',
  '연도별 (2025-2075, 51년)'
UNION ALL
SELECT
  '7. chatops_messages',
  '30일 (파티션 DROP)',
  '법적 의무 없음',
  'drop_old_chatops_message_partitions(30)',
  '월별 (자동 생성)';

\echo ''

-- PART 5: 각 함수의 실제 정의 확인
\echo '=== 주요 함수 정의 확인 (요약) ==='
SELECT
  p.proname as "함수명",
  pg_get_functiondef(p.oid) as "함수 정의"
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'cleanup_old_execution_audit_runs',
    'cleanup_old_automation_actions',
    'drop_old_chatops_message_partitions',
    'create_next_month_chatops_partition'
  )
ORDER BY p.proname;

\echo ''
\echo 'ℹ️  Note: 함수 정의가 너무 길어 출력이 잘릴 수 있습니다.'
\echo ''

-- PART 6: 수동 테스트 실행 (DRY RUN)
\echo '=== 수동 테스트 명령어 (실제 삭제 X, 개수만 확인) ==='
\echo ''
\echo '-- 각 테이블에서 삭제 대상 개수 확인:'
\echo ''

-- consultation_summary_jobs
SELECT
  'consultation_summary_jobs' as "테이블",
  COUNT(*) as "삭제 대상 (30일 경과)"
FROM public.consultation_summary_jobs
WHERE
  (status = 'completed' AND completed_at < now() - interval '30 days')
  OR (status = 'failed' AND created_at < now() - interval '30 days')
  OR (status IN ('pending', 'processing') AND created_at < now() - interval '30 days');

-- ai_decision_logs
SELECT
  'ai_decision_logs' as "테이블",
  COUNT(*) as "삭제 대상 (90일 경과)"
FROM public.ai_decision_logs
WHERE created_at < now() - interval '90 days';

-- automation_safety_state
SELECT
  'automation_safety_state' as "테이블",
  COUNT(*) as "삭제 대상 (30일 경과)"
FROM public.automation_safety_state
WHERE window_end < now() - interval '30 days';

-- execution_audit_runs (일반)
SELECT
  'execution_audit_runs (일반)' as "테이블",
  COUNT(*) as "삭제 대상 (2년 경과)"
FROM public.execution_audit_runs
WHERE occurred_at < now() - interval '730 days'
  AND operation_type NOT IN (
    'send-invoice', 'process-payment', 'issue-refund',
    'generate-billing', 'update-billing', 'cancel-payment'
  );

-- execution_audit_runs (회계)
SELECT
  'execution_audit_runs (회계)' as "테이블",
  COUNT(*) as "삭제 대상 (5년 경과)"
FROM public.execution_audit_runs
WHERE occurred_at < now() - interval '1825 days'
  AND operation_type IN (
    'send-invoice', 'process-payment', 'issue-refund',
    'generate-billing', 'update-billing', 'cancel-payment'
  );

-- automation_actions
SELECT
  'automation_actions' as "테이블",
  COUNT(*) as "삭제 대상 (2년 경과)"
FROM public.automation_actions
WHERE executed_at < now() - interval '730 days';

-- chatops_messages (파티션 DROP 대상)
SELECT
  'chatops_messages (파티션)' as "테이블",
  string_agg(tablename, ', ') as "DROP 대상 파티션 (30일 이전)"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'chatops_messages_%'
  AND tablename ~ 'chatops_messages_[0-9]{4}_[0-9]{2}$'
  AND TO_DATE(
    SUBSTRING(tablename FROM 'chatops_messages_([0-9]{4}_[0-9]{2})$'),
    'YYYY_MM'
  ) < CURRENT_DATE - interval '30 days';

\echo ''
\echo 'ℹ️  위 쿼리 결과가 모두 0이면 삭제 대상 없음 (정상)'
\echo ''

-- PART 7: 누락된 함수 확인
\echo '=== 누락된 함수 확인 ==='
WITH expected_functions AS (
  SELECT unnest(ARRAY[
    'cleanup_old_consultation_summary_jobs',
    'cleanup_old_ai_decision_logs',
    'cleanup_old_automation_safety_state',
    'cleanup_old_execution_audit_runs',
    'cleanup_old_automation_actions',
    'drop_old_chatops_message_partitions',
    'create_next_month_chatops_partition',
    'admin_cleanup_consultation_summary_jobs',
    'admin_cleanup_ai_decision_logs',
    'admin_cleanup_automation_safety_state',
    'admin_cleanup_execution_audit_runs',
    'admin_cleanup_automation_actions',
    'admin_drop_old_chatops_partitions',
    'admin_create_next_month_chatops_partition',
    'cleanup_orphaned_execution_audit_steps'
  ]) as function_name
),
existing_functions AS (
  SELECT routine_name as function_name
  FROM information_schema.routines
  WHERE routine_schema = 'public'
)
SELECT
  e.function_name as "누락된 함수명",
  CASE
    WHEN e.function_name LIKE '%consultation_summary_jobs%' THEN '20260112000001'
    WHEN e.function_name LIKE '%ai_decision_logs%' THEN '20260112000002'
    WHEN e.function_name LIKE '%automation_safety_state%' THEN '20260112000003'
    WHEN e.function_name LIKE '%execution_audit_runs%' THEN '20260112000010'
    WHEN e.function_name LIKE '%execution_audit_steps%' THEN '20260112000011'
    WHEN e.function_name LIKE '%automation_actions%' THEN '20260112000012'
    WHEN e.function_name LIKE '%chatops%' AND e.function_name LIKE '%drop%' THEN '20260112000013'
    WHEN e.function_name LIKE '%chatops%' AND e.function_name LIKE '%create%' THEN '20260112000015'
    ELSE '알 수 없음'
  END as "관련 마이그레이션"
FROM expected_functions e
LEFT JOIN existing_functions ex ON e.function_name = ex.function_name
WHERE ex.function_name IS NULL;

\echo ''
\echo '=== 누락된 함수가 없으면 "0 rows" 표시됨 (정상) ==='
\echo ''

-- PART 8: 종합 점검 결과
\echo '=== 종합 점검 결과 ==='
DO $$
DECLARE
  cleanup_count int;
  admin_count int;
  expected_cleanup int := 7;
  expected_admin int := 7;
BEGIN
  -- 자동 실행 함수 개수 확인
  SELECT COUNT(*) INTO cleanup_count
  FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND routine_name NOT LIKE '%admin%'
    AND (
      routine_name LIKE '%cleanup%'
      OR routine_name LIKE '%drop%'
      OR routine_name LIKE '%create_next%'
    );

  -- 관리자 함수 개수 확인
  SELECT COUNT(*) INTO admin_count
  FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND routine_name LIKE '%admin%'
    AND (
      routine_name LIKE '%cleanup%'
      OR routine_name LIKE '%drop%'
      OR routine_name LIKE '%create%'
    );

  -- 결과 출력
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '       보존 정책 함수 종합 점검 결과';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE 'ℹ️  자동 실행 함수: % / % (예상)', cleanup_count, expected_cleanup;
  RAISE NOTICE 'ℹ️  관리자 함수: % / % (예상)', admin_count, expected_admin;
  RAISE NOTICE '';

  IF cleanup_count = expected_cleanup AND admin_count = expected_admin THEN
    RAISE NOTICE '✅ 모든 보존 정책 함수 정상 생성됨';
  ELSE
    RAISE NOTICE '❌ 누락된 함수 있음 (위 "누락된 함수 확인" 섹션 참조)';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '다음 작업:';
  RAISE NOTICE '1. "누락된 함수 확인" 섹션에서 누락 여부 확인';
  RAISE NOTICE '2. 누락된 경우 관련 마이그레이션 파일 재실행';
  RAISE NOTICE '3. "수동 테스트 명령어"로 각 함수 정상 작동 확인';
  RAISE NOTICE '4. pg_cron 스케줄 확인 (verify-cron-jobs.sql)';
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;
