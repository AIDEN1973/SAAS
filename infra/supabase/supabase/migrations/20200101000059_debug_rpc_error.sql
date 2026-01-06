/**
 * RPC 함수 오류 디버깅
 * 
 * [불변 규칙] 400 Bad Request 오류 원인 확인
 */

-- 1. RPC 함수 존재 확인
SELECT 
  'RPC 함수 존재 확인' AS check_type,
  p.proname AS function_name,
  n.nspname AS schema_name,
  pg_get_function_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname LIKE '%schema_registry%'
ORDER BY p.proname;

-- 2. RPC 함수 권한 확인
SELECT 
  'RPC 함수 권한' AS check_type,
  p.proname AS function_name,
  CASE 
    WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN '✅ authenticated'
    ELSE '❌ authenticated'
  END AS has_authenticated,
  CASE 
    WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN '✅ anon'
    ELSE '❌ anon'
  END AS has_anon
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname LIKE '%schema_registry%'
ORDER BY p.proname;

-- 3. 현재 사용자의 플랫폼 역할 확인
SELECT 
  '현재 사용자 플랫폼 역할' AS check_type,
  auth.uid() AS user_id,
  upr.role AS platform_role,
  upr.created_at
FROM public.user_platform_roles upr
WHERE upr.user_id = auth.uid();

-- 4. RPC 함수 직접 테스트 (현재 사용자로)
-- ⚠️ 주의: 이 쿼리는 실제로 RPC 함수를 호출합니다
DO $$
DECLARE
  v_result jsonb;
  v_error text;
BEGIN
  BEGIN
    -- get_schema_registry_list 함수 테스트
    SELECT * INTO v_result
    FROM public.get_schema_registry_list(NULL, NULL, NULL);
    
    RAISE NOTICE '✅ RPC 함수 호출 성공';
    RAISE NOTICE '결과: %', v_result;
  EXCEPTION WHEN OTHERS THEN
    v_error := SQLERRM;
    RAISE NOTICE '❌ RPC 함수 호출 실패: %', v_error;
    RAISE NOTICE '오류 코드: %', SQLSTATE;
  END;
END $$;

-- 5. user_platform_roles 테이블 구조 확인
SELECT 
  '테이블 구조' AS check_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_platform_roles'
ORDER BY ordinal_position;

-- 6. 최종 확인 메시지
DO $$
BEGIN
  RAISE NOTICE '=== RPC 함수 디버깅 정보 ===';
  RAISE NOTICE '✅ RPC 함수 존재 여부 확인 완료';
  RAISE NOTICE '✅ 권한 확인 완료';
  RAISE NOTICE '✅ 사용자 역할 확인 완료';
  RAISE NOTICE '';
  RAISE NOTICE '📌 다음 단계:';
  RAISE NOTICE '   1. RPC 함수가 존재하는지 확인';
  RAISE NOTICE '   2. authenticated 역할에 EXECUTE 권한이 있는지 확인';
  RAISE NOTICE '   3. 현재 사용자가 user_platform_roles에 있는지 확인';
  RAISE NOTICE '   4. 브라우저 콘솔에서 상세 오류 메시지 확인';
END $$;

