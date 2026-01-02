/**
 * Analytics Region Metrics RLS 보안 강화
 *
 * [불변 규칙] P2-5: 익명화 보안 정책 적용
 * [요구사항] 기술문서 15-3-3-2: RLS 기반 데이터 격리
 *
 * Purpose: 사용자가 자신의 지역/업종 데이터만 조회하도록 제한
 */

-- ============================================================================
-- 1. 기존 RLS 정책 삭제
-- ============================================================================
DROP POLICY IF EXISTS industry_region_filter_daily_region_metrics ON analytics.daily_region_metrics;

-- ============================================================================
-- 2. 새로운 RLS 정책 생성
-- ============================================================================
-- 사용자의 업종과 지역 정보를 JWT claim 및 tenant_settings에서 가져와서 필터링
CREATE POLICY industry_region_filter_daily_region_metrics
ON analytics.daily_region_metrics
FOR SELECT TO authenticated
USING (
  -- 조건 1: 업종 필터 (JWT claim에서 industry_type 조회)
  (
    industry_type = COALESCE(
      (auth.jwt() ->> 'industry_type')::text,
      'academy'  -- Fallback: academy
    )
  )
  AND
  -- 조건 2: 지역 필터 (tenant_settings에서 location 조회)
  (
    -- 2-1. 동 레벨: location_code 매칭
    (
      region_level = 'dong'
      AND region_code IN (
        SELECT (value #>> '{location,location_code}')
        FROM tenant_settings
        WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
          AND key = 'config'
          AND (value #>> '{location,location_code}') IS NOT NULL
      )
    )
    OR
    -- 2-2. 구/군 레벨: sigungu_code 매칭
    (
      region_level = 'gu_gun'
      AND region_code IN (
        SELECT (value #>> '{location,sigungu_code}')
        FROM tenant_settings
        WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
          AND key = 'config'
          AND (value #>> '{location,sigungu_code}') IS NOT NULL
      )
    )
    OR
    -- 2-3. 시/도 레벨: sido_code 매칭
    (
      region_level = 'si'
      AND region_code IN (
        SELECT (value #>> '{location,sido_code}')
        FROM tenant_settings
        WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
          AND key = 'config'
          AND (value #>> '{location,sido_code}') IS NOT NULL
      )
    )
    OR
    -- 2-4. 권역 레벨: region_zone_code 매칭 (향후 확장)
    (
      region_level = 'region_zone'
      AND region_code IN (
        SELECT (value #>> '{location,region_zone_code}')
        FROM tenant_settings
        WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
          AND key = 'config'
          AND (value #>> '{location,region_zone_code}') IS NOT NULL
      )
    )
  )
);

-- ============================================================================
-- 3. daily_store_metrics RLS 정책 검증
-- ============================================================================
-- 기존 정책이 이미 tenant_id 기반으로 격리되어 있는지 확인
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'analytics'
      AND tablename = 'daily_store_metrics'
      AND policyname = 'tenant_isolation_daily_store_metrics'
  ) THEN
    RAISE EXCEPTION 'daily_store_metrics RLS 정책이 없습니다. 116_create_analytics_metrics_tables.sql 확인 필요';
  ELSE
    RAISE NOTICE '✅ daily_store_metrics RLS 정책 확인 완료';
  END IF;
END $$;

-- ============================================================================
-- 4. ranking_snapshot RLS 정책 검증
-- ============================================================================
-- 기존 정책이 이미 tenant_id 기반으로 격리되어 있는지 확인
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'analytics'
      AND tablename = 'ranking_snapshot'
      AND policyname = 'ranking_snapshot_select'
  ) THEN
    RAISE EXCEPTION 'ranking_snapshot RLS 정책이 없습니다. 089_create_ranking_snapshot_table.sql 확인 필요';
  ELSE
    RAISE NOTICE '✅ ranking_snapshot RLS 정책 확인 완료';
  END IF;
END $$;

-- ============================================================================
-- 5. 완료 메시지
-- ============================================================================
COMMENT ON POLICY industry_region_filter_daily_region_metrics ON analytics.daily_region_metrics IS
'[P2-5] 익명화 보안 정책: 사용자의 업종/지역 데이터만 조회 가능. JWT claim + tenant_settings 기반 필터링.';

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Analytics RLS 보안 정책 강화 완료!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '강화된 정책:';
  RAISE NOTICE '  - industry_region_filter_daily_region_metrics';
  RAISE NOTICE '';
  RAISE NOTICE '보안 규칙:';
  RAISE NOTICE '  1. 업종 필터: JWT claim의 industry_type 매칭';
  RAISE NOTICE '  2. 지역 필터: tenant_settings의 location.* 매칭';
  RAISE NOTICE '  3. 레벨별 필터: dong/gu_gun/si/region_zone';
  RAISE NOTICE '';
  RAISE NOTICE '📋 테스트 방법:';
  RAISE NOTICE '  - 다른 지역의 테넌트로 조회 시 데이터 미표시';
  RAISE NOTICE '  - 동일 지역의 통계만 조회 가능';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- 6. 참고: RLS 정책 테스트 쿼리
-- ============================================================================
-- 현재 사용자의 RLS 정책 확인:
--   SELECT * FROM analytics.daily_region_metrics LIMIT 10;
--
-- RLS 정책 목록 조회:
--   SELECT * FROM pg_policies WHERE schemaname = 'analytics';
--
-- RLS 정책 비활성화 (테스트용, 운영 환경 금지):
--   ALTER TABLE analytics.daily_region_metrics DISABLE ROW LEVEL SECURITY;
--
-- RLS 정책 활성화:
--   ALTER TABLE analytics.daily_region_metrics ENABLE ROW LEVEL SECURITY;
