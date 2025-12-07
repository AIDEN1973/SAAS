/**
 * meta 스키마 테이블 가시성 확인
 * 
 * [불변 규칙] Table Editor에서 보이지 않아도 SQL로는 접근 가능해야 함
 * [불변 규칙] PostgREST 노출 설정이 완료되어야 API 접근 가능
 */

-- 1. 테이블 존재 및 데이터 확인
SELECT 
  '테이블 데이터 확인' AS check_type,
  'meta.schema_registry' AS table_name,
  COUNT(*) AS row_count
FROM meta.schema_registry;

SELECT 
  '테이블 데이터 확인' AS check_type,
  'meta.tenant_schema_pins' AS table_name,
  COUNT(*) AS row_count
FROM meta.tenant_schema_pins;

-- 2. 테이블 구조 확인
SELECT 
  '테이블 구조' AS check_type,
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'meta'
  AND table_name IN ('schema_registry', 'tenant_schema_pins')
ORDER BY table_name, ordinal_position;

-- 3. 테스트 데이터 삽입 (선택적 - 테스트용)
-- ⚠️ 주의: 실제 데이터가 필요하면 실행하세요
/*
INSERT INTO meta.schema_registry (
  entity,
  industry_type,
  version,
  min_supported_client,
  min_client,
  schema_json,
  status
) VALUES (
  'test',
  NULL,
  '1.0.0',
  '1.0.0',
  '1.0.0',
  '{"type": "form", "form": {"fields": []}}'::jsonb,
  'draft'
) ON CONFLICT DO NOTHING;
*/

-- 4. 최종 확인 메시지
DO $$
BEGIN
  RAISE NOTICE '=== meta 스키마 테이블 확인 ===';
  RAISE NOTICE '✅ 테이블이 SQL로는 접근 가능합니다.';
  RAISE NOTICE '';
  RAISE NOTICE '📌 Table Editor에서 보이지 않는 이유:';
  RAISE NOTICE '   - Supabase Dashboard Table Editor는 기본적으로 public 스키마만 표시합니다.';
  RAISE NOTICE '   - meta 스키마는 SQL Editor에서 직접 쿼리해야 합니다.';
  RAISE NOTICE '';
  RAISE NOTICE '📌 PostgREST API 접근을 위한 필수 설정:';
  RAISE NOTICE '   1. Supabase Dashboard → Settings → API';
  RAISE NOTICE '   2. "Exposed schemas"에 "public,meta" 추가';
  RAISE NOTICE '   3. "Reload schema" 클릭';
  RAISE NOTICE '';
  RAISE NOTICE '✅ 이 설정이 완료되면 프론트엔드에서 API 접근이 가능합니다.';
END $$;

