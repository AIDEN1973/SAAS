/**
 * RPC 함수 생성 확인 및 재생성
 * 
 * [불변 규칙] RPC 함수가 제대로 생성되었는지 확인하고, 없으면 재생성
 */

-- 1. RPC 함수 존재 확인
SELECT 
  'RPC 함수 존재 확인' AS check_type,
  p.proname AS function_name,
  n.nspname AS schema_name,
  CASE 
    WHEN p.proname = 'get_schema_registry_list' THEN '✅ 필수'
    WHEN p.proname = 'get_schema_registry' THEN '✅ 필수'
    WHEN p.proname = 'create_schema_registry' THEN '✅ 필수'
    WHEN p.proname = 'update_schema_registry' THEN '✅ 필수'
    WHEN p.proname = 'activate_schema_registry' THEN '✅ 필수'
    WHEN p.proname = 'delete_schema_registry' THEN '✅ 필수'
    ELSE '⚠️ 선택'
  END AS status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname LIKE '%schema_registry%'
ORDER BY p.proname;

-- 2. 필수 RPC 함수가 없으면 경고
DO $$
DECLARE
  v_missing_functions text[] := ARRAY[]::text[];
  v_required_functions text[] := ARRAY[
    'get_schema_registry_list',
    'get_schema_registry',
    'create_schema_registry',
    'update_schema_registry',
    'activate_schema_registry',
    'delete_schema_registry'
  ];
  v_func text;
BEGIN
  FOREACH v_func IN ARRAY v_required_functions
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = v_func
    ) THEN
      v_missing_functions := array_append(v_missing_functions, v_func);
    END IF;
  END LOOP;
  
  IF array_length(v_missing_functions, 1) > 0 THEN
    RAISE WARNING '❌ 다음 RPC 함수가 없습니다: %', array_to_string(v_missing_functions, ', ');
    RAISE NOTICE '📌 해결 방법: 048_create_schema_registry_rpc.sql을 실행하세요.';
  ELSE
    RAISE NOTICE '✅ 모든 필수 RPC 함수가 존재합니다.';
  END IF;
END $$;

-- 3. RPC 함수 권한 확인
SELECT 
  'RPC 함수 권한' AS check_type,
  p.proname AS function_name,
  CASE 
    WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN '✅'
    ELSE '❌'
  END AS authenticated,
  CASE 
    WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN '✅'
    ELSE '❌'
  END AS anon
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname LIKE '%schema_registry%'
ORDER BY p.proname;

-- 4. 권한이 없는 함수가 있으면 경고
DO $$
DECLARE
  v_func_name text;
  v_has_permission boolean;
BEGIN
  FOR v_func_name IN 
    SELECT p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname LIKE '%schema_registry%'
  LOOP
    SELECT has_function_privilege('authenticated', 
      (SELECT oid FROM pg_proc WHERE proname = v_func_name AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') LIMIT 1),
      'EXECUTE'
    ) INTO v_has_permission;
    
    IF NOT v_has_permission THEN
      RAISE WARNING '❌ 함수 %에 authenticated 역할에 대한 EXECUTE 권한이 없습니다.', v_func_name;
    END IF;
  END LOOP;
  
  RAISE NOTICE '✅ 권한 확인 완료';
END $$;

