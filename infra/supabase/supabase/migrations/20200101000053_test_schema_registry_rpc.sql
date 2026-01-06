/**
 * Schema Registry RPC 함수 테스트
 * 
 * [불변 규칙] RPC 함수가 올바르게 작동하는지 확인
 */

-- 1. RPC 함수 존재 확인 (pg_proc 사용)
SELECT 
  'RPC 함수 존재 확인' AS check_type,
  p.proname AS routine_name,
  n.nspname AS routine_schema,
  CASE p.prokind
    WHEN 'f' THEN 'function'
    WHEN 'p' THEN 'procedure'
    WHEN 'a' THEN 'aggregate'
    WHEN 'w' THEN 'window'
    ELSE 'unknown'
  END AS routine_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname LIKE '%schema_registry%'
ORDER BY p.proname;

-- 2. RPC 함수 매개변수 확인 (pg_proc 사용)
SELECT 
  'RPC 함수 매개변수' AS check_type,
  p.proname AS routine_name,
  pg_get_function_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname LIKE '%schema_registry%'
ORDER BY p.proname;

-- 3. RPC 함수 권한 확인 (간단한 방법)
SELECT 
  'RPC 함수 권한' AS check_type,
  p.proname AS routine_name,
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

-- 4. 테스트 데이터 삽입 (선택적)
-- ⚠️ 주의: 실제 테스트가 필요하면 실행하세요
/*
DO $$
DECLARE
  v_test_id uuid;
BEGIN
  -- 테스트 스키마 생성
  INSERT INTO meta.schema_registry (
    entity,
    industry_type,
    version,
    min_supported_client,
    min_client,
    schema_json,
    status,
    registered_by
  ) VALUES (
    'test_entity',
    NULL,
    '1.0.0',
    '1.0.0',
    '1.0.0',
    '{"type": "form", "form": {"fields": []}}'::jsonb,
    'draft',
    auth.uid()
  )
  RETURNING id INTO v_test_id;
  
  RAISE NOTICE '테스트 스키마 생성 완료: %', v_test_id;
END $$;
*/

-- 5. RPC 함수 호출 테스트 (주석 처리 - 실제 호출은 클라이언트에서)
-- SELECT * FROM public.get_schema_registry_list(NULL, NULL, NULL);
-- SELECT * FROM public.get_schema_registry_list('test_entity', NULL, 'draft');

-- 최종 확인 메시지
DO $$
BEGIN
  RAISE NOTICE '=== Schema Registry RPC 함수 확인 ===';
  RAISE NOTICE '✅ RPC 함수 존재 여부 확인 완료';
  RAISE NOTICE '✅ 매개변수 확인 완료';
  RAISE NOTICE '✅ 권한 확인 완료';
  RAISE NOTICE '';
  RAISE NOTICE '📌 다음 단계:';
  RAISE NOTICE '   1. 프론트엔드에서 RPC 함수 호출 테스트';
  RAISE NOTICE '   2. 브라우저 콘솔에서 400 오류 확인';
  RAISE NOTICE '   3. Supabase Dashboard → Database → Functions에서 RPC 함수 확인';
END $$;

