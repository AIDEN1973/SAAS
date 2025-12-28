/**
 * pg_cron 확장 활성화
 *
 * [목적] pg_cron 확장을 활성화하여 cron 작업을 SQL로 관리할 수 있도록 합니다.
 *
 * ⚠️ 중요: Supabase Dashboard에서 먼저 확장을 활성화해야 합니다.
 *          이 마이그레이션은 확장이 이미 활성화된 경우에만 실행됩니다.
 *
 * 활성화 방법:
 * 1. Supabase Dashboard > Database > Extensions로 이동
 * 2. "pg_cron" 확장 찾기
 * 3. "Enable" 버튼 클릭
 * 4. 스키마 선택: "extensions" (권장) 또는 "pg_cron"
 *
 * 참고: Edge Functions의 cron 작업은 Dashboard에서 별도로 관리됩니다.
 *       pg_cron 확장은 PostgreSQL 함수를 스케줄링하는 용도입니다.
 */

-- ============================================================================
-- 1. pg_cron 확장 활성화 (확장이 없는 경우에만)
-- ============================================================================
-- 주의: Supabase Dashboard에서 먼저 활성화하는 것이 권장됩니다.
--       SQL로 직접 활성화하려면 superuser 권한이 필요할 수 있습니다.

DO $$
BEGIN
  -- 확장 존재 여부 확인
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- 확장 활성화 시도
    -- 주의: Supabase에서는 extensions 스키마에 설치하는 것이 권장됩니다.
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
      RAISE NOTICE '✅ pg_cron 확장 활성화 완료 (extensions 스키마)';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '⚠️ pg_cron 확장 활성화 실패: %', SQLERRM;
      RAISE NOTICE '';
      RAISE NOTICE 'Supabase Dashboard에서 수동으로 활성화하세요:';
      RAISE NOTICE '  Dashboard > Database > Extensions > pg_cron > Enable';
      RAISE NOTICE '  스키마 선택: "extensions" (권장)';
    END;
  ELSE
    RAISE NOTICE '✅ pg_cron 확장이 이미 활성화되어 있습니다.';

    -- 확장 정보 확인
    PERFORM 1;
  END IF;
END $$;

-- ============================================================================
-- 2. 확장 정보 확인
-- ============================================================================
SELECT
  'pg_cron 확장 정보' AS check_type,
  extname AS extension_name,
  extversion AS version,
  n.nspname AS schema_name
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE extname = 'pg_cron';

-- ============================================================================
-- 3. cron 스키마 및 테이블 확인
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'cron' AND table_name = 'job'
  ) THEN
    RAISE NOTICE '✅ cron.job 테이블이 존재합니다.';
    RAISE NOTICE '   이제 cron 작업을 SQL로 관리할 수 있습니다.';
  ELSE
    RAISE NOTICE '⚠️ cron.job 테이블이 아직 생성되지 않았습니다.';
    RAISE NOTICE '   pg_cron 확장이 완전히 활성화되면 자동으로 생성됩니다.';
  END IF;
END $$;

-- ============================================================================
-- 참고: Edge Functions의 cron 작업
-- ============================================================================
-- Supabase Edge Functions의 cron 작업은 Dashboard에서 별도로 관리됩니다.
-- Dashboard > Edge Functions > 각 함수 > Cron Jobs 탭에서 설정하세요.
--
-- pg_cron 확장은 PostgreSQL 함수를 스케줄링하는 용도이며,
-- Edge Functions의 cron과는 별개의 시스템입니다.

COMMENT ON EXTENSION pg_cron IS
'PostgreSQL cron 확장. PostgreSQL 함수를 스케줄링하는 용도입니다. '
'Edge Functions의 cron 작업은 Dashboard에서 별도로 관리됩니다.';

