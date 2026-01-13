-- execution_audit_runs 파티션 및 보존 정책
-- [불변 규칙] 감사 로그이므로 파티셔닝 적용 (연도별 RANGE 파티션)
-- [불변 규칙] 모든 파티션에는 반드시 (tenant_id, occurred_at DESC) 복합 인덱스 적용
-- [법적 근거] 개인정보보호법 2년 (최소) 보존 (회계 관련은 5년)
-- [전략] 7년치 파티션 생성 (장기 보존 요구 대비) + 2년 보존 정책 적용

-- ============================================================
-- PART 1: 기존 테이블을 파티션 테이블로 전환
-- ============================================================

-- 1. 기존 데이터 백업
CREATE TABLE IF NOT EXISTS public.execution_audit_runs_backup AS
SELECT * FROM public.execution_audit_runs;

-- 2. 기존 인덱스 및 제약조건 저장
-- (파티션 테이블 재생성 후 복원 예정)

-- 3. 기존 테이블 삭제
DROP TABLE IF EXISTS public.execution_audit_runs CASCADE;

-- 4. 파티션 마스터 테이블 생성
CREATE TABLE public.execution_audit_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  operation_type text NOT NULL,
  status text NOT NULL,
  source text NOT NULL,
  actor_type text NOT NULL,
  actor_id text,
  summary text NOT NULL,
  details jsonb,
  reference jsonb NOT NULL,
  counts jsonb,
  error_code text,
  error_summary text,
  duration_ms integer,
  version text,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id, occurred_at),
  CONSTRAINT execution_audit_runs_status_check CHECK (status IN ('success', 'failed', 'partial')),
  CONSTRAINT execution_audit_runs_source_check CHECK (source IN ('ai', 'automation', 'scheduler', 'manual', 'webhook')),
  CONSTRAINT execution_audit_runs_actor_type_check CHECK (actor_type IN ('user', 'system', 'external'))
) PARTITION BY RANGE (occurred_at);

-- 5. 2025년 파티션 생성 (기존 데이터 복원용)
CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2025
  PARTITION OF public.execution_audit_runs
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2025_tenant_occurred
  ON public.execution_audit_runs_2025(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2025_operation
  ON public.execution_audit_runs_2025(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2025_status
  ON public.execution_audit_runs_2025(tenant_id, status, occurred_at DESC);

-- ============================================================
-- PART 2: 2026-2032년 파티션 생성 (7년치, 최소 법적 요구 충족)
-- ============================================================

-- 2026년 (현재 데이터를 위해 먼저 생성)
CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2026 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2026_tenant_occurred ON public.execution_audit_runs_2026(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2026_operation ON public.execution_audit_runs_2026(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2026_status ON public.execution_audit_runs_2026(tenant_id, status, occurred_at DESC);

-- 6. 기존 데이터 복원 (2025-2026년 파티션 생성 후)
INSERT INTO public.execution_audit_runs (
  id, tenant_id, occurred_at, operation_type, status, source, actor_type, actor_id,
  summary, details, reference, counts, error_code, error_summary, duration_ms, version, created_at
)
SELECT
  id, tenant_id, occurred_at, operation_type, status, source, actor_type, actor_id,
  summary, details, reference, counts, error_code, error_summary, duration_ms, version, created_at
FROM public.execution_audit_runs_backup
ON CONFLICT DO NOTHING;

-- 7. 백업 테이블 삭제
DROP TABLE IF EXISTS public.execution_audit_runs_backup;

-- 2027년
CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2027 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2027_tenant_occurred ON public.execution_audit_runs_2027(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2027_operation ON public.execution_audit_runs_2027(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2027_status ON public.execution_audit_runs_2027(tenant_id, status, occurred_at DESC);

-- 2028년
CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2028 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2028-01-01') TO ('2029-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2028_tenant_occurred ON public.execution_audit_runs_2028(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2028_operation ON public.execution_audit_runs_2028(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2028_status ON public.execution_audit_runs_2028(tenant_id, status, occurred_at DESC);

-- 2029년
CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2029 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2029-01-01') TO ('2030-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2029_tenant_occurred ON public.execution_audit_runs_2029(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2029_operation ON public.execution_audit_runs_2029(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2029_status ON public.execution_audit_runs_2029(tenant_id, status, occurred_at DESC);

-- 2030년
CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2030 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2030-01-01') TO ('2031-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2030_tenant_occurred ON public.execution_audit_runs_2030(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2030_operation ON public.execution_audit_runs_2030(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2030_status ON public.execution_audit_runs_2030(tenant_id, status, occurred_at DESC);

-- 2031년
CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2031 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2031-01-01') TO ('2032-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2031_tenant_occurred ON public.execution_audit_runs_2031(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2031_operation ON public.execution_audit_runs_2031(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2031_status ON public.execution_audit_runs_2031(tenant_id, status, occurred_at DESC);

-- 2032년
CREATE TABLE IF NOT EXISTS public.execution_audit_runs_2032 PARTITION OF public.execution_audit_runs FOR VALUES FROM ('2032-01-01') TO ('2033-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2032_tenant_occurred ON public.execution_audit_runs_2032(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2032_operation ON public.execution_audit_runs_2032(tenant_id, operation_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_2032_status ON public.execution_audit_runs_2032(tenant_id, status, occurred_at DESC);

-- ============================================================
-- PART 3: RLS 정책 재생성
-- ============================================================
ALTER TABLE public.execution_audit_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_execution_audit_runs ON public.execution_audit_runs;
CREATE POLICY tenant_isolation_execution_audit_runs ON public.execution_audit_runs
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ============================================================
-- PART 4: 2년 보존 정책 (최소) + 회계 로그 5년 보존 (최소)
-- ============================================================

-- 1. 차등 보존 삭제 함수 (일반 2년, 회계 5년)
CREATE OR REPLACE FUNCTION public.cleanup_old_execution_audit_runs(
  general_retention_days int DEFAULT 730,   -- 2년 (최소)
  financial_retention_days int DEFAULT 1825 -- 5년 (회계 로그, 최소)
)
RETURNS TABLE(deleted_general bigint, deleted_financial bigint) AS $$
DECLARE
  deleted_gen bigint;
  deleted_fin bigint;
BEGIN
  -- 일반 로그: 2년 삭제 (개인정보보호법 최소 요건)
  WITH deleted_general_rows AS (
    DELETE FROM public.execution_audit_runs
    WHERE occurred_at < now() - (general_retention_days || ' days')::interval
      AND operation_type NOT IN (
        'send-invoice',      -- 청구서 발송
        'process-payment',   -- 결제 처리
        'issue-refund',      -- 환불 처리
        'generate-billing',  -- 청구 생성
        'update-billing',    -- 청구 업데이트
        'cancel-payment'     -- 결제 취소
      )
    RETURNING id
  )
  SELECT count(*) INTO deleted_gen FROM deleted_general_rows;

  -- 회계 로그: 5년 삭제 (국세기본법)
  WITH deleted_financial_rows AS (
    DELETE FROM public.execution_audit_runs
    WHERE occurred_at < now() - (financial_retention_days || ' days')::interval
      AND operation_type IN (
        'send-invoice',
        'process-payment',
        'issue-refund',
        'generate-billing',
        'update-billing',
        'cancel-payment'
      )
    RETURNING id
  )
  SELECT count(*) INTO deleted_fin FROM deleted_financial_rows;

  deleted_general := deleted_gen;
  deleted_financial := deleted_fin;
  RETURN NEXT;

  RAISE NOTICE '[cleanup_old_execution_audit_runs] Deleted general: %, financial: %', deleted_gen, deleted_fin;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.cleanup_old_execution_audit_runs(int, int) TO service_role;

-- 2. pg_cron 스케줄 (매일 03:00 KST)
DO $do_block$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cleanup_execution_audit_runs_daily');
    PERFORM cron.schedule(
      'cleanup_execution_audit_runs_daily',
      '0 18 * * *',  -- 18:00 UTC = 03:00 KST
      'SELECT public.cleanup_old_execution_audit_runs(730, 1825)'
    );
    RAISE NOTICE '[pg_cron] execution_audit_runs cleanup scheduled: daily at 18:00 UTC (03:00 KST)';
  ELSE
    RAISE NOTICE '[pg_cron] pg_cron extension not available. Manual cleanup required.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '[pg_cron] Failed to schedule cleanup job: %. Manual cleanup required.', SQLERRM;
END;
$do_block$;

-- 3. 관리자용 RPC 함수
CREATE OR REPLACE FUNCTION public.admin_cleanup_execution_audit_runs(
  p_general_retention_days int DEFAULT 730,
  p_financial_retention_days int DEFAULT 1825
)
RETURNS jsonb AS $$
DECLARE
  result_general bigint;
  result_financial bigint;
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

  SELECT deleted_general, deleted_financial
  INTO result_general, result_financial
  FROM public.cleanup_old_execution_audit_runs(p_general_retention_days, p_financial_retention_days);

  RETURN jsonb_build_object(
    'success', true,
    'deleted_general', result_general,
    'deleted_financial', result_financial,
    'general_retention_days', p_general_retention_days,
    'financial_retention_days', p_financial_retention_days,
    'executed_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_cleanup_execution_audit_runs(int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cleanup_execution_audit_runs(int, int) TO service_role;

-- ============================================================
-- PART 5: 메타데이터 및 주석
-- ============================================================
COMMENT ON TABLE public.execution_audit_runs IS 'Execution Audit Run 테이블 (파티션 적용, 액티비티.md 8.1 참조)';
COMMENT ON FUNCTION public.cleanup_old_execution_audit_runs(int, int) IS
  '차등 보존 정책: 일반 로그 2년(최소), 회계 로그 5년(최소). 개인정보보호법 및 국세기본법 준수.';
COMMENT ON FUNCTION public.admin_cleanup_execution_audit_runs(int, int) IS
  '관리자용 실행 감사 로그 정리 함수. super_admin 또는 service_role만 실행 가능.';

-- ============================================================
-- 완료 메시지
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '=== execution_audit_runs 파티션 및 보존 정책 생성 완료 ===';
  RAISE NOTICE '파티션: 2025-2032년 (8년치)';
  RAISE NOTICE '보존 정책: 일반 2년(최소), 회계 5년(최소)';
  RAISE NOTICE '법적 근거: 개인정보보호법 2년, 국세기본법 5년';
END $$;
