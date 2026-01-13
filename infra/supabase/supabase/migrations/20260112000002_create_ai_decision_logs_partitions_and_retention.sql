-- ai_decision_logs 파티션 및 보존 정책 생성
-- [불변 규칙] 로그성 테이블이므로 파티셔닝 적용 (연도별 RANGE 파티션)
-- [불변 규칙] 모든 파티션에는 반드시 (tenant_id, created_at DESC) 복합 인덱스가 적용되어야 합니다.
-- [전략] 50년치 파티션 생성 + 90일 보존 정책 (AI 판단 디버깅용)

-- ============================================================
-- PART 1: 기존 테이블을 파티션 테이블로 전환
-- ============================================================

-- 1. 기존 데이터 백업 (임시 테이블)
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_backup AS
SELECT * FROM public.ai_decision_logs;

-- 2. 기존 테이블 삭제
DROP TABLE IF EXISTS public.ai_decision_logs CASCADE;

-- 3. 파티션 마스터 테이블 생성
CREATE TABLE public.ai_decision_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  model text NOT NULL,
  features jsonb,
  score numeric,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  skipped_by_flag boolean DEFAULT false,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- 4. 2025년 파티션 생성 (기존 데이터 복원용)
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2025
  PARTITION OF public.ai_decision_logs
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2025_tenant_created
  ON public.ai_decision_logs_2025(tenant_id, created_at DESC);

-- ============================================================
-- PART 2: 2026-2075년 파티션 생성 (50년치)
-- ============================================================

-- 2026-2030년 파티션
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2026 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2026_tenant_created ON public.ai_decision_logs_2026(tenant_id, created_at DESC);

-- 5. 기존 데이터 복원 (2025-2026년 파티션 생성 후)
INSERT INTO public.ai_decision_logs (
  id, model, features, score, reason, created_at, tenant_id, skipped_by_flag
)
SELECT
  id, model, features, score, reason, created_at, tenant_id, skipped_by_flag
FROM public.ai_decision_logs_backup
ON CONFLICT DO NOTHING;

-- 6. 백업 테이블 삭제
DROP TABLE IF EXISTS public.ai_decision_logs_backup;

CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2027 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2027_tenant_created ON public.ai_decision_logs_2027(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2028 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2028-01-01') TO ('2029-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2028_tenant_created ON public.ai_decision_logs_2028(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2029 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2029-01-01') TO ('2030-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2029_tenant_created ON public.ai_decision_logs_2029(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2030 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2030-01-01') TO ('2031-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2030_tenant_created ON public.ai_decision_logs_2030(tenant_id, created_at DESC);

-- 2031-2075년 파티션 (45개, 5년씩 묶어서 생성)
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2031 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2031-01-01') TO ('2032-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2031_tenant_created ON public.ai_decision_logs_2031(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2032 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2032-01-01') TO ('2033-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2032_tenant_created ON public.ai_decision_logs_2032(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2033 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2033-01-01') TO ('2034-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2033_tenant_created ON public.ai_decision_logs_2033(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2034 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2034-01-01') TO ('2035-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2034_tenant_created ON public.ai_decision_logs_2034(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2035 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2035-01-01') TO ('2036-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2035_tenant_created ON public.ai_decision_logs_2035(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2036 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2036-01-01') TO ('2037-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2036_tenant_created ON public.ai_decision_logs_2036(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2037 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2037-01-01') TO ('2038-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2037_tenant_created ON public.ai_decision_logs_2037(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2038 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2038-01-01') TO ('2039-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2038_tenant_created ON public.ai_decision_logs_2038(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2039 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2039-01-01') TO ('2040-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2039_tenant_created ON public.ai_decision_logs_2039(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2040 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2040-01-01') TO ('2041-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2040_tenant_created ON public.ai_decision_logs_2040(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2041 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2041-01-01') TO ('2042-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2041_tenant_created ON public.ai_decision_logs_2041(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2042 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2042-01-01') TO ('2043-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2042_tenant_created ON public.ai_decision_logs_2042(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2043 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2043-01-01') TO ('2044-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2043_tenant_created ON public.ai_decision_logs_2043(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2044 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2044-01-01') TO ('2045-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2044_tenant_created ON public.ai_decision_logs_2044(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2045 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2045-01-01') TO ('2046-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2045_tenant_created ON public.ai_decision_logs_2045(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2046 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2046-01-01') TO ('2047-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2046_tenant_created ON public.ai_decision_logs_2046(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2047 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2047-01-01') TO ('2048-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2047_tenant_created ON public.ai_decision_logs_2047(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2048 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2048-01-01') TO ('2049-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2048_tenant_created ON public.ai_decision_logs_2048(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2049 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2049-01-01') TO ('2050-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2049_tenant_created ON public.ai_decision_logs_2049(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2050 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2050-01-01') TO ('2051-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2050_tenant_created ON public.ai_decision_logs_2050(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2051 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2051-01-01') TO ('2052-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2051_tenant_created ON public.ai_decision_logs_2051(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2052 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2052-01-01') TO ('2053-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2052_tenant_created ON public.ai_decision_logs_2052(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2053 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2053-01-01') TO ('2054-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2053_tenant_created ON public.ai_decision_logs_2053(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2054 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2054-01-01') TO ('2055-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2054_tenant_created ON public.ai_decision_logs_2054(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2055 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2055-01-01') TO ('2056-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2055_tenant_created ON public.ai_decision_logs_2055(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2056 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2056-01-01') TO ('2057-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2056_tenant_created ON public.ai_decision_logs_2056(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2057 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2057-01-01') TO ('2058-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2057_tenant_created ON public.ai_decision_logs_2057(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2058 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2058-01-01') TO ('2059-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2058_tenant_created ON public.ai_decision_logs_2058(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2059 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2059-01-01') TO ('2060-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2059_tenant_created ON public.ai_decision_logs_2059(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2060 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2060-01-01') TO ('2061-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2060_tenant_created ON public.ai_decision_logs_2060(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2061 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2061-01-01') TO ('2062-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2061_tenant_created ON public.ai_decision_logs_2061(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2062 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2062-01-01') TO ('2063-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2062_tenant_created ON public.ai_decision_logs_2062(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2063 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2063-01-01') TO ('2064-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2063_tenant_created ON public.ai_decision_logs_2063(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2064 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2064-01-01') TO ('2065-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2064_tenant_created ON public.ai_decision_logs_2064(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2065 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2065-01-01') TO ('2066-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2065_tenant_created ON public.ai_decision_logs_2065(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2066 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2066-01-01') TO ('2067-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2066_tenant_created ON public.ai_decision_logs_2066(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2067 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2067-01-01') TO ('2068-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2067_tenant_created ON public.ai_decision_logs_2067(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2068 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2068-01-01') TO ('2069-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2068_tenant_created ON public.ai_decision_logs_2068(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2069 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2069-01-01') TO ('2070-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2069_tenant_created ON public.ai_decision_logs_2069(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2070 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2070-01-01') TO ('2071-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2070_tenant_created ON public.ai_decision_logs_2070(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2071 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2071-01-01') TO ('2072-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2071_tenant_created ON public.ai_decision_logs_2071(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2072 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2072-01-01') TO ('2073-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2072_tenant_created ON public.ai_decision_logs_2072(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2073 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2073-01-01') TO ('2074-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2073_tenant_created ON public.ai_decision_logs_2073(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2074 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2074-01-01') TO ('2075-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2074_tenant_created ON public.ai_decision_logs_2074(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_decision_logs_2075 PARTITION OF public.ai_decision_logs FOR VALUES FROM ('2075-01-01') TO ('2076-01-01');
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_2075_tenant_created ON public.ai_decision_logs_2075(tenant_id, created_at DESC);

-- ============================================================
-- PART 3: RLS 정책 재생성
-- ============================================================
ALTER TABLE public.ai_decision_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ai_decision_logs ON public.ai_decision_logs;
CREATE POLICY tenant_isolation_ai_decision_logs ON public.ai_decision_logs
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ============================================================
-- PART 4: 90일 보존 정책
-- ============================================================

-- 1. 오래된 로그 삭제 함수 (90일)
CREATE OR REPLACE FUNCTION public.cleanup_old_ai_decision_logs(retention_days int DEFAULT 90)
RETURNS TABLE(deleted_count bigint) AS $$
DECLARE
  deleted bigint;
BEGIN
  -- 90일(기본값)이 지난 로그 삭제
  WITH deleted_logs AS (
    DELETE FROM public.ai_decision_logs
    WHERE created_at < now() - (retention_days || ' days')::interval
    RETURNING id
  )
  SELECT count(*) INTO deleted FROM deleted_logs;

  deleted_count := deleted;
  RETURN NEXT;

  RAISE NOTICE '[cleanup_old_ai_decision_logs] Deleted % logs older than % days', deleted, retention_days;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.cleanup_old_ai_decision_logs(int) TO service_role;

-- 2. pg_cron 스케줄 (매일 03:00 KST)
DO $do_block$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cleanup_ai_decision_logs_daily');
    PERFORM cron.schedule(
      'cleanup_ai_decision_logs_daily',
      '0 18 * * *',
      'SELECT public.cleanup_old_ai_decision_logs(90)'
    );
    RAISE NOTICE '[pg_cron] ai_decision_logs cleanup job scheduled: daily at 18:00 UTC (03:00 KST)';
  ELSE
    RAISE NOTICE '[pg_cron] pg_cron extension not available. Manual cleanup required.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '[pg_cron] Failed to schedule cleanup job: %. Manual cleanup required.', SQLERRM;
END;
$do_block$;

-- 3. 관리자용 RPC 함수
CREATE OR REPLACE FUNCTION public.admin_cleanup_ai_decision_logs(p_retention_days int DEFAULT 90)
RETURNS jsonb AS $$
DECLARE
  result_count bigint;
BEGIN
  IF NOT (
    current_setting('role', true) = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.user_platform_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  ) THEN
    RAISE EXCEPTION 'Permission denied: Only service_role or super_admin can execute this function';
  END IF;

  SELECT deleted_count INTO result_count
  FROM public.cleanup_old_ai_decision_logs(p_retention_days);

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', result_count,
    'retention_days', p_retention_days,
    'executed_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_cleanup_ai_decision_logs(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cleanup_ai_decision_logs(int) TO service_role;

-- ============================================================
-- 완료 메시지
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE 'ai_decision_logs 파티션 생성 완료: 2025-2075년 (51년치)';
  RAISE NOTICE 'ai_decision_logs 보존 정책 생성 완료: 90일';
END $$;

COMMENT ON FUNCTION public.cleanup_old_ai_decision_logs(int) IS
  '90일이 지난 AI 판단 로그 자동 삭제. AI 디버깅 및 모델 개선용.';
COMMENT ON FUNCTION public.admin_cleanup_ai_decision_logs(int) IS
  '관리자용 AI 판단 로그 정리 함수. super_admin 또는 service_role만 실행 가능.';
