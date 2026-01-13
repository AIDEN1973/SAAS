-- execution_audit_steps 파티션 및 보존 정책
-- [불변 규칙] 감사 로그이므로 파티셔닝 적용 (연도별 RANGE 파티션)
-- [불변 규칙] 모든 파티션에는 반드시 (tenant_id, occurred_at DESC) 복합 인덱스 적용
-- [법적 근거] 상위 run과 동일한 보존 정책 적용
-- [전략] 7년치 파티션 생성 + 3년 보존 정책 (run 삭제 시 CASCADE 자동 삭제)

-- ============================================================
-- PART 1: 기존 테이블을 파티션 테이블로 전환
-- ============================================================

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_backup AS
SELECT * FROM public.execution_audit_steps;

DROP TABLE IF EXISTS public.execution_audit_steps CASCADE;

CREATE TABLE public.execution_audit_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  run_id uuid NOT NULL,  -- FK는 파티션 생성 후 추가
  occurred_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  summary text NOT NULL,
  details jsonb,
  error_code text,
  error_summary text,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id, occurred_at),
  CONSTRAINT execution_audit_steps_status_check CHECK (status IN ('success', 'failed'))
) PARTITION BY RANGE (occurred_at);

-- 2025년 파티션
CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2025
  PARTITION OF public.execution_audit_steps
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2025_tenant_occurred
  ON public.execution_audit_steps_2025(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2025_run
  ON public.execution_audit_steps_2025(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2025_status
  ON public.execution_audit_steps_2025(tenant_id, status, occurred_at DESC);

-- ============================================================
-- PART 2: 2026-2032년 파티션 생성 (7년치)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2026 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2026_tenant_occurred ON public.execution_audit_steps_2026(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2026_run ON public.execution_audit_steps_2026(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2026_status ON public.execution_audit_steps_2026(tenant_id, status, occurred_at DESC);

-- 기존 데이터 복원 (2025-2026년 파티션 생성 후)
INSERT INTO public.execution_audit_steps (
  id, tenant_id, run_id, occurred_at, status, target_type, target_id,
  summary, details, error_code, error_summary, created_at
)
SELECT
  id, tenant_id, run_id, occurred_at, status, target_type, target_id,
  summary, details, error_code, error_summary, created_at
FROM public.execution_audit_steps_backup
ON CONFLICT DO NOTHING;

DROP TABLE IF EXISTS public.execution_audit_steps_backup;

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2027 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2027_tenant_occurred ON public.execution_audit_steps_2027(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2027_run ON public.execution_audit_steps_2027(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2027_status ON public.execution_audit_steps_2027(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2028 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2028-01-01') TO ('2029-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2028_tenant_occurred ON public.execution_audit_steps_2028(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2028_run ON public.execution_audit_steps_2028(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2028_status ON public.execution_audit_steps_2028(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2029 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2029-01-01') TO ('2030-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2029_tenant_occurred ON public.execution_audit_steps_2029(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2029_run ON public.execution_audit_steps_2029(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2029_status ON public.execution_audit_steps_2029(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2030 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2030-01-01') TO ('2031-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2030_tenant_occurred ON public.execution_audit_steps_2030(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2030_run ON public.execution_audit_steps_2030(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2030_status ON public.execution_audit_steps_2030(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2031 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2031-01-01') TO ('2032-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2031_tenant_occurred ON public.execution_audit_steps_2031(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2031_run ON public.execution_audit_steps_2031(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2031_status ON public.execution_audit_steps_2031(tenant_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.execution_audit_steps_2032 PARTITION OF public.execution_audit_steps FOR VALUES FROM ('2032-01-01') TO ('2033-01-01');
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2032_tenant_occurred ON public.execution_audit_steps_2032(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2032_run ON public.execution_audit_steps_2032(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_2032_status ON public.execution_audit_steps_2032(tenant_id, status, occurred_at DESC);

-- ============================================================
-- PART 3: FK 제약조건 추가 (파티션 테이블에서는 나중에 추가)
-- ============================================================
-- ⚠️ 주의: 파티션 테이블에서는 run_id FK를 직접 추가할 수 없음
-- CASCADE 삭제는 애플리케이션 레벨에서 처리하거나 트리거 사용

-- ============================================================
-- PART 4: RLS 정책 재생성
-- ============================================================
ALTER TABLE public.execution_audit_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_execution_audit_steps ON public.execution_audit_steps;
CREATE POLICY tenant_isolation_execution_audit_steps ON public.execution_audit_steps
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ============================================================
-- PART 5: 보존 정책 (run 삭제 시 CASCADE로 자동 삭제 예정)
-- ============================================================

-- steps는 별도 보존 정책 없이 run 삭제 시 함께 삭제됨
-- 만약 run FK CASCADE가 작동하지 않으면 별도 정리 함수 필요

CREATE OR REPLACE FUNCTION public.cleanup_orphaned_execution_audit_steps()
RETURNS bigint AS $$
DECLARE
  deleted bigint;
BEGIN
  -- run이 삭제된 orphaned steps 정리
  WITH deleted_steps AS (
    DELETE FROM public.execution_audit_steps steps
    WHERE NOT EXISTS (
      SELECT 1 FROM public.execution_audit_runs runs
      WHERE runs.id = steps.run_id
    )
    RETURNING id
  )
  SELECT count(*) INTO deleted FROM deleted_steps;

  RAISE NOTICE '[cleanup_orphaned_execution_audit_steps] Deleted % orphaned steps', deleted;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.cleanup_orphaned_execution_audit_steps() TO service_role;

-- ============================================================
-- PART 6: 메타데이터
-- ============================================================
COMMENT ON TABLE public.execution_audit_steps IS 'Execution Audit Step 테이블 (파티션 적용, 액티비티.md 8.2 참조)';
COMMENT ON FUNCTION public.cleanup_orphaned_execution_audit_steps() IS
  'run이 삭제된 orphaned steps 정리 함수. run 삭제 시 CASCADE로 자동 삭제되지 않는 경우 사용.';

DO $$
BEGIN
  RAISE NOTICE '=== execution_audit_steps 파티션 생성 완료 ===';
  RAISE NOTICE '파티션: 2025-2032년 (8년치)';
  RAISE NOTICE '보존 정책: run 삭제 시 CASCADE 자동 삭제';
END $$;
