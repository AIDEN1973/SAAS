-- Execution Audit 테이블 생성
-- 액티비티.md 8.1, 8.2 섹션 참조
-- 목적: 실행 결과 감사 추적 시스템

-- ============================================================================
-- 8.1 테이블: execution_audit_runs
-- ============================================================================
CREATE TABLE IF NOT EXISTS execution_audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
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
  CONSTRAINT execution_audit_runs_status_check CHECK (status IN ('success', 'failed', 'partial')),
  CONSTRAINT execution_audit_runs_source_check CHECK (source IN ('ai', 'automation', 'scheduler', 'manual', 'webhook')),
  CONSTRAINT execution_audit_runs_actor_type_check CHECK (actor_type IN ('user', 'system', 'external'))
);

-- 인덱스 (액티비티.md 8.1 참조)
CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_tenant_occurred_id
ON execution_audit_runs(tenant_id, occurred_at DESC, id);

CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_tenant_operation_occurred
ON execution_audit_runs(tenant_id, operation_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_tenant_status_occurred
ON execution_audit_runs(tenant_id, status, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_execution_audit_runs_tenant_source_occurred
ON execution_audit_runs(tenant_id, source, occurred_at DESC);

-- ============================================================================
-- 8.2 테이블: execution_audit_steps
-- ============================================================================
CREATE TABLE IF NOT EXISTS execution_audit_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES execution_audit_runs(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  summary text NOT NULL,
  details jsonb,
  error_code text,
  error_summary text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT execution_audit_steps_status_check CHECK (status IN ('success', 'failed'))
);

-- 인덱스 (액티비티.md 8.2 참조)
CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_tenant_run
ON execution_audit_steps(tenant_id, run_id);

CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_tenant_occurred
ON execution_audit_steps(tenant_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_execution_audit_steps_tenant_status_occurred
ON execution_audit_steps(tenant_id, status, occurred_at DESC);

-- ============================================================================
-- RLS 정책
-- ============================================================================
ALTER TABLE execution_audit_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_audit_steps ENABLE ROW LEVEL SECURITY;

-- execution_audit_runs RLS 정책
DROP POLICY IF EXISTS tenant_isolation_execution_audit_runs ON execution_audit_runs;
CREATE POLICY tenant_isolation_execution_audit_runs ON execution_audit_runs
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- execution_audit_steps RLS 정책
DROP POLICY IF EXISTS tenant_isolation_execution_audit_steps ON execution_audit_steps;
CREATE POLICY tenant_isolation_execution_audit_steps ON execution_audit_steps
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ============================================================================
-- COMMENT
-- ============================================================================
COMMENT ON TABLE execution_audit_runs IS 'Execution Audit Run 테이블 (액티비티.md 8.1 참조)';
COMMENT ON TABLE execution_audit_steps IS 'Execution Audit Step 테이블 (액티비티.md 8.2 참조)';
COMMENT ON COLUMN execution_audit_runs.operation_type IS '작업 타입 (kebab-case, 예: send-sms, update-attendance)';
COMMENT ON COLUMN execution_audit_runs.reference IS '상관관계 키 묶음 (request_id, task_id 등)';
COMMENT ON COLUMN execution_audit_runs.counts IS '성공/실패 카운트 (다건 실행에서만 사용, 예: {"success": 11, "failed": 1})';

