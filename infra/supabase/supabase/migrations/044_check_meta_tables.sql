/**
 * meta 스키마 테이블 존재 확인
 * 
 * [불변 규칙] meta.schema_registry와 meta.tenant_schema_pins 테이블이 제대로 생성되었는지 확인
 */

-- 1. meta 스키마 존재 확인
SELECT 
  'meta 스키마' AS check_item,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'meta') 
    THEN '✅ 존재' 
    ELSE '❌ 없음' 
  END AS status;

-- 2. schema_registry 테이블 존재 확인
SELECT 
  'meta.schema_registry 테이블' AS check_item,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'meta' 
      AND table_name = 'schema_registry'
    ) 
    THEN '✅ 존재' 
    ELSE '❌ 없음' 
  END AS status;

-- 3. schema_registry 컬럼 확인
SELECT 
  'meta.schema_registry 컬럼' AS check_item,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'meta' 
  AND table_name = 'schema_registry'
ORDER BY ordinal_position;

-- 4. tenant_schema_pins 테이블 존재 확인
SELECT 
  'meta.tenant_schema_pins 테이블' AS check_item,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'meta' 
      AND table_name = 'tenant_schema_pins'
    ) 
    THEN '✅ 존재' 
    ELSE '❌ 없음' 
  END AS status;

-- 5. tenant_schema_pins 컬럼 확인
SELECT 
  'meta.tenant_schema_pins 컬럼' AS check_item,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'meta' 
  AND table_name = 'tenant_schema_pins'
ORDER BY ordinal_position;

-- 6. 인덱스 확인
SELECT 
  '인덱스' AS check_item,
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'meta'
ORDER BY tablename, indexname;

-- 7. RLS 정책 확인
SELECT 
  'RLS 정책' AS check_item,
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'meta'
ORDER BY tablename, policyname;

-- 8. 권한 확인
SELECT 
  '권한' AS check_item,
  table_schema,
  table_name,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'meta'
  AND grantee IN ('authenticated', 'anon')
ORDER BY table_name, grantee, privilege_type;

