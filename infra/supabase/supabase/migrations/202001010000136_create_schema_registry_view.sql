/**
 * Schema Registry View 생성 (PostgREST 노출용)
 *
 * [불변 규칙] PostgREST가 meta 스키마를 노출하지 않는 경우를 대비한 public View
 * [불변 규칙] meta.schema_registry를 public.schema_registry View로 노출
 * [불변 규칙] RLS 정책은 underlying table(meta.schema_registry)의 RLS에 의해 보호됨
 *
 * 기술문서: docu/스키마엔진.txt 4. Schema Registry (DB + RLS)
 * 참고: infra/supabase/migrations/046_postgrest_expose_meta_schema.sql
 */

-- ============================================================================
-- 1. 기존 VIEW 삭제 (있다면)
-- ============================================================================
DROP VIEW IF EXISTS public.schema_registry;

-- ============================================================================
-- 2. schema_registry VIEW 생성 (meta.schema_registry 노출)
-- ============================================================================
CREATE OR REPLACE VIEW public.schema_registry AS
SELECT
  id,
  entity,
  industry_type,
  version,
  min_supported_client,
  min_client,
  schema_json,
  migration_script,
  status,
  registered_by,
  registered_at,
  activated_at,
  deprecated_at
FROM meta.schema_registry;

-- ============================================================================
-- 3. VIEW COMMENT
-- ============================================================================
COMMENT ON VIEW public.schema_registry IS
'Schema Registry View (PostgREST 노출용). underlying table은 meta.schema_registry입니다. RLS 정책은 underlying table에 의해 보호됩니다.';

-- ============================================================================
-- 4. VIEW 권한 설정
-- ============================================================================
-- VIEW는 underlying table RLS에 의해 보호되므로 추가 정책 불필요
-- 하지만 명시적으로 권한 부여
GRANT SELECT ON public.schema_registry TO authenticated;
GRANT SELECT ON public.schema_registry TO anon;  -- RLS 정책에 따라 실제 접근은 제한됨

-- ============================================================================
-- 5. PostgREST 노출을 위한 COMMENT
-- ============================================================================
-- PostgREST가 VIEW를 자동으로 노출하도록 COMMENT 추가
COMMENT ON VIEW public.schema_registry IS
'Schema Registry View (PostgREST 노출용). underlying table은 meta.schema_registry입니다. RLS 정책은 underlying table에 의해 보호됩니다.';

-- ============================================================================
-- 주의사항
-- ============================================================================
-- ⚠️ 중요: 이 VIEW는 읽기용입니다.
-- 쓰기는 RPC 함수(create_schema_registry, update_schema_registry 등)를 사용하세요.
-- ⚠️ 중요: RLS 정책은 underlying table(meta.schema_registry)의 RLS에 의해 보호됩니다.
-- VIEW에 추가 RLS 정책을 생성하지 마세요.

-- ============================================================================
-- 마이그레이션 완료 로그
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ schema_registry VIEW가 생성되었습니다.';
  RAISE NOTICE '   - 읽기용 VIEW (PostgREST 노출용)';
  RAISE NOTICE '   - underlying table: meta.schema_registry';
  RAISE NOTICE '   - RLS 정책은 underlying table에 의해 보호됨';
  RAISE NOTICE '   - 쓰기는 RPC 함수 사용 권장';
END $$;

