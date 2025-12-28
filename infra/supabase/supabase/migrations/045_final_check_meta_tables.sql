/**
 * meta 스키마 테이블 최종 확인
 * 
 * [불변 규칙] 테이블 생성, 컬럼, 인덱스, RLS 정책 모두 확인
 */

-- 1. 테이블 존재 확인 (간단 버전)
SELECT 
  '테이블 존재 확인' AS check_type,
  table_name,
  CASE 
    WHEN table_name IS NOT NULL THEN '✅ 존재'
    ELSE '❌ 없음'
  END AS status
FROM information_schema.tables
WHERE table_schema = 'meta'
  AND table_name IN ('schema_registry', 'tenant_schema_pins')
ORDER BY table_name;

-- 2. schema_registry 컬럼 상세 확인
SELECT 
  'schema_registry 컬럼' AS check_type,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'meta' 
  AND table_name = 'schema_registry'
ORDER BY ordinal_position;

-- 3. tenant_schema_pins 컬럼 상세 확인
SELECT 
  'tenant_schema_pins 컬럼' AS check_type,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'meta' 
  AND table_name = 'tenant_schema_pins'
ORDER BY ordinal_position;

-- 4. min_client 컬럼 확인 (중요)
SELECT 
  'min_client 컬럼 확인' AS check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'meta'
        AND table_name = 'schema_registry'
        AND column_name = 'min_client'
    ) THEN '✅ min_client 컬럼 존재'
    ELSE '❌ min_client 컬럼 없음 (추가 필요)'
  END AS status;

-- 5. 인덱스 확인
SELECT 
  '인덱스' AS check_type,
  indexname,
  tablename
FROM pg_indexes
WHERE schemaname = 'meta'
ORDER BY tablename, indexname;

-- 6. RLS 활성화 확인
SELECT 
  'RLS 활성화' AS check_type,
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'meta'
ORDER BY tablename;

-- 7. RLS 정책 확인
SELECT 
  'RLS 정책' AS check_type,
  tablename,
  policyname,
  cmd AS command,
  CASE 
    WHEN roles = '{authenticated}' THEN 'authenticated'
    WHEN roles = '{anon}' THEN 'anon'
    ELSE array_to_string(roles, ', ')
  END AS roles
FROM pg_policies
WHERE schemaname = 'meta'
ORDER BY tablename, policyname;

-- 8. 최종 요약
DO $$
DECLARE
  v_schema_registry_exists boolean;
  v_tenant_schema_pins_exists boolean;
  v_min_client_exists boolean;
  v_schema_registry_rls boolean;
  v_tenant_schema_pins_rls boolean;
BEGIN
  -- 테이블 존재 확인
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'meta' 
    AND table_name = 'schema_registry'
  ) INTO v_schema_registry_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'meta' 
    AND table_name = 'tenant_schema_pins'
  ) INTO v_tenant_schema_pins_exists;
  
  -- min_client 컬럼 확인
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'meta'
      AND table_name = 'schema_registry'
      AND column_name = 'min_client'
  ) INTO v_min_client_exists;
  
  -- RLS 활성화 확인
  SELECT rowsecurity INTO v_schema_registry_rls
  FROM pg_tables
  WHERE schemaname = 'meta' AND tablename = 'schema_registry';
  
  SELECT rowsecurity INTO v_tenant_schema_pins_rls
  FROM pg_tables
  WHERE schemaname = 'meta' AND tablename = 'tenant_schema_pins';
  
  RAISE NOTICE '=== 최종 확인 결과 ===';
  RAISE NOTICE 'meta.schema_registry 테이블: %', CASE WHEN v_schema_registry_exists THEN '✅ 존재' ELSE '❌ 없음' END;
  RAISE NOTICE 'meta.tenant_schema_pins 테이블: %', CASE WHEN v_tenant_schema_pins_exists THEN '✅ 존재' ELSE '❌ 없음' END;
  RAISE NOTICE 'min_client 컬럼: %', CASE WHEN v_min_client_exists THEN '✅ 존재' ELSE '❌ 없음' END;
  RAISE NOTICE 'schema_registry RLS: %', CASE WHEN v_schema_registry_rls THEN '✅ 활성화' ELSE '❌ 비활성화' END;
  RAISE NOTICE 'tenant_schema_pins RLS: %', CASE WHEN v_tenant_schema_pins_rls THEN '✅ 활성화' ELSE '❌ 비활성화' END;
  
  IF v_schema_registry_exists AND v_tenant_schema_pins_exists AND v_min_client_exists AND v_schema_registry_rls AND v_tenant_schema_pins_rls THEN
    RAISE NOTICE '✅ 모든 설정이 완료되었습니다!';
    RAISE NOTICE '⚠️  다음 단계: Supabase Dashboard → Settings → API → Exposed schemas에 "meta" 추가';
  ELSE
    RAISE WARNING '❌ 일부 설정이 누락되었습니다. 마이그레이션을 다시 확인하세요.';
  END IF;
END $$;

