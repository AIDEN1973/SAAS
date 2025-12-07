/**
 * PostgREST meta 스키마 노출 설정
 * 
 * [불변 규칙] PostgREST가 meta 스키마를 인식하도록 설정
 * [불변 규칙] Supabase Dashboard에서도 설정이 필요하지만, SQL로도 시도
 * 
 * ⚠️ 중요: Supabase는 PostgREST 설정을 SQL로 직접 변경할 수 없습니다.
 * 반드시 Supabase Dashboard → Settings → API → Exposed schemas에서 설정해야 합니다.
 * 
 * 이 마이그레이션은 권한만 확인하고, 실제 노출 설정은 Dashboard에서 해야 합니다.
 */

-- 권한 재확인 및 재부여
GRANT USAGE ON SCHEMA meta TO authenticated, anon;

-- schema_registry 권한 재확인
GRANT SELECT, INSERT, UPDATE, DELETE ON meta.schema_registry TO authenticated;
GRANT SELECT ON meta.schema_registry TO anon;

-- tenant_schema_pins 권한 재확인
GRANT SELECT, INSERT, UPDATE, DELETE ON meta.tenant_schema_pins TO authenticated;
GRANT SELECT ON meta.tenant_schema_pins TO anon;

-- 향후 생성되는 테이블에 대한 기본 권한 설정
ALTER DEFAULT PRIVILEGES IN SCHEMA meta
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA meta
GRANT SELECT ON TABLES TO anon;

-- PostgREST 스키마 캐시 새로고침 시도
-- ⚠️ 주의: Supabase에서는 이 방법이 작동하지 않을 수 있습니다.
-- Dashboard에서 "Reload schema"를 클릭해야 합니다.
NOTIFY pgrst, 'reload schema';

-- 최종 확인 메시지
DO $$
BEGIN
  RAISE NOTICE '=== PostgREST meta 스키마 노출 설정 ===';
  RAISE NOTICE '✅ 권한 설정 완료';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  중요: 다음 단계를 반드시 수행하세요:';
  RAISE NOTICE '1. Supabase Dashboard 접속';
  RAISE NOTICE '2. Settings → API 이동';
  RAISE NOTICE '3. "Exposed schemas" 섹션 찾기';
  RAISE NOTICE '4. "public,meta" 또는 "meta" 추가';
  RAISE NOTICE '5. "Reload schema" 버튼 클릭';
  RAISE NOTICE '';
  RAISE NOTICE '이 설정 없이는 PostgREST가 meta 스키마를 인식하지 못합니다.';
END $$;

