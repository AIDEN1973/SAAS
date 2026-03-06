-- error_logs 테이블 생성
-- Edge Function error-tracking.ts에서 참조하는 테이블
-- [불변 규칙] RLS 정책 + tenant_id 격리 적용

BEGIN;

-- 테이블 생성
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  function_name TEXT NOT NULL,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  severity TEXT NOT NULL DEFAULT 'error'
    CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_error_logs_function_severity
  ON error_logs(function_name, severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at
  ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_tenant_id
  ON error_logs(tenant_id)
  WHERE tenant_id IS NOT NULL;

-- RLS 활성화
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- RLS 정책: tenant 격리
CREATE POLICY "tenant_isolation" ON error_logs
  FOR ALL
  USING (
    tenant_id IS NULL
    OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

-- RLS 정책: service_role 전체 접근 (Edge Function에서 사용)
CREATE POLICY "service_role_full_access" ON error_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 30일 자동 정리 (pg_cron)
-- Note: pg_cron이 활성화된 경우에만 동작
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup_error_logs_30d',
      '0 3 * * *',
      $$DELETE FROM error_logs WHERE created_at < now() - interval '30 days'$$
    );
  END IF;
END;
$$;

COMMIT;
