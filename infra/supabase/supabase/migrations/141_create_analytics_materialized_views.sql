/**
 * Analytics Materialized Views 생성
 *
 * [불변 규칙] P1-3: Materialized View Refresh 전략
 * [요구사항] 아키텍처 문서 7.5: MV 활용 성능 최적화
 *
 * Purpose: 지역 통계 조회 성능 최적화
 * Refresh: 매일 00:30 KST (daily-statistics-update 완료 후)
 */

-- ============================================================================
-- 1. daily_region_metrics_mv (지역 통계 Materialized View)
-- ============================================================================
-- 최근 30일 지역 통계만 캐시 (성능 최적화)
DROP MATERIALIZED VIEW IF EXISTS analytics.daily_region_metrics_mv;

CREATE MATERIALIZED VIEW analytics.daily_region_metrics_mv AS
SELECT
  region_code,
  region_level,
  industry_type,
  tenant_count,
  student_count,
  avg_arpu,
  avg_attendance_rate,
  attendance_rate_p25,
  attendance_rate_p75,
  student_growth_rate_avg,
  revenue_growth_rate_avg,
  student_growth_rate_p75,
  revenue_growth_rate_p75,
  date_kst,
  created_at,
  updated_at
FROM analytics.daily_region_metrics
WHERE date_kst >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY date_kst DESC, region_level, region_code;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_daily_region_metrics_mv_region_date
  ON analytics.daily_region_metrics_mv(region_code, region_level, industry_type, date_kst DESC);

CREATE INDEX IF NOT EXISTS idx_daily_region_metrics_mv_date
  ON analytics.daily_region_metrics_mv(date_kst DESC);

-- ============================================================================
-- 2. daily_store_metrics_mv (매장 통계 Materialized View)
-- ============================================================================
-- 최근 90일 매장 통계만 캐시
DROP MATERIALIZED VIEW IF EXISTS analytics.daily_store_metrics_mv;

CREATE MATERIALIZED VIEW analytics.daily_store_metrics_mv AS
SELECT
  id,
  tenant_id,
  store_id,
  student_count,
  revenue,
  attendance_rate,
  new_enrollments,
  late_rate,
  absent_rate,
  active_student_count,
  inactive_student_count,
  avg_students_per_class,
  avg_capacity_rate,
  arpu,
  date_kst,
  created_at,
  updated_at
FROM analytics.daily_store_metrics
WHERE date_kst >= CURRENT_DATE - INTERVAL '90 days'
ORDER BY date_kst DESC, tenant_id;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_daily_store_metrics_mv_tenant_date
  ON analytics.daily_store_metrics_mv(tenant_id, date_kst DESC);

CREATE INDEX IF NOT EXISTS idx_daily_store_metrics_mv_date
  ON analytics.daily_store_metrics_mv(date_kst DESC);

-- ============================================================================
-- 3. MV Refresh 함수
-- ============================================================================
-- 모든 Analytics MV를 한 번에 REFRESH하는 함수
CREATE OR REPLACE FUNCTION analytics.refresh_all_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- daily_region_metrics_mv REFRESH
  REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.daily_region_metrics_mv;
  RAISE NOTICE 'Refreshed daily_region_metrics_mv';

  -- daily_store_metrics_mv REFRESH
  REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.daily_store_metrics_mv;
  RAISE NOTICE 'Refreshed daily_store_metrics_mv';

  RAISE NOTICE 'All analytics materialized views refreshed successfully';
END;
$$;

-- 함수 권한 설정
GRANT EXECUTE ON FUNCTION analytics.refresh_all_materialized_views() TO postgres;
GRANT EXECUTE ON FUNCTION analytics.refresh_all_materialized_views() TO service_role;

-- ============================================================================
-- 4. 수동 Refresh 테스트
-- ============================================================================
-- 테스트용 (실행 후 주석 처리)
-- SELECT analytics.refresh_all_materialized_views();

-- ============================================================================
-- 5. PostgREST 노출 (선택적)
-- ============================================================================
-- MV를 public view로 노출하려면 아래 주석 해제
-- CREATE OR REPLACE VIEW public.daily_region_metrics_recent AS
-- SELECT * FROM analytics.daily_region_metrics_mv;

-- CREATE OR REPLACE VIEW public.daily_store_metrics_recent AS
-- SELECT * FROM analytics.daily_store_metrics_mv;

-- GRANT SELECT ON public.daily_region_metrics_recent TO authenticated;
-- GRANT SELECT ON public.daily_store_metrics_recent TO authenticated;

-- ============================================================================
-- 6. 완료 메시지
-- ============================================================================
COMMENT ON MATERIALIZED VIEW analytics.daily_region_metrics_mv IS
'[P1-3] 지역 통계 Materialized View (최근 30일). 매일 00:30 KST에 REFRESH (Cron Job 필요)';

COMMENT ON MATERIALIZED VIEW analytics.daily_store_metrics_mv IS
'[P1-3] 매장 통계 Materialized View (최근 90일). 매일 00:30 KST에 REFRESH (Cron Job 필요)';

COMMENT ON FUNCTION analytics.refresh_all_materialized_views() IS
'[P1-3] 모든 Analytics MV를 REFRESH하는 함수. Cron Job에서 호출됨.';

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Analytics Materialized Views 생성 완료!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '생성된 MV:';
  RAISE NOTICE '  - analytics.daily_region_metrics_mv (최근 30일)';
  RAISE NOTICE '  - analytics.daily_store_metrics_mv (최근 90일)';
  RAISE NOTICE '';
  RAISE NOTICE 'Refresh 함수:';
  RAISE NOTICE '  - analytics.refresh_all_materialized_views()';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ 중요: Cron Job 등록 필요';
  RAISE NOTICE '   - 매일 00:30 KST에 SELECT analytics.refresh_all_materialized_views();';
  RAISE NOTICE '   - 142_add_analytics_mv_refresh_cron.sql 참조';
  RAISE NOTICE '';
END $$;
