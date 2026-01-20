-- Step 1: List all triggers on academy_classes table
-- 실행 후 어떤 트리거가 있는지 확인하세요
SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'academy_classes'
AND event_object_schema = 'public';

-- Step 2: List all functions that reference 'sc.status' or 'student_classes' with 'status'
-- 이 쿼리로 문제가 있는 함수를 찾을 수 있습니다
SELECT
  proname as function_name,
  prosrc as function_source
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND prosrc LIKE '%sc.status%';
