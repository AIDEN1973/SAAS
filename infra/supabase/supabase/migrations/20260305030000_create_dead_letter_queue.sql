-- Phase 3: Dead Letter Queue (DLQ) 테이블 생성
-- 재시도 소진된 실패 작업을 저장하고 재처리하기 위한 테이블
-- [불변 규칙] tenant_id 기반 RLS 적용

CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- tenant_id는 nullable: webhook 등 tenant 식별 전 실패 시 null 허용
  tenant_id UUID REFERENCES tenants(id),
  function_name TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  error_code TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'failed', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT now(),
  last_retried_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

-- RLS 적용
ALTER TABLE dead_letter_queue ENABLE ROW LEVEL SECURITY;

-- [불변 규칙] tenant_id 기반 RLS 정책 (tenant_id가 null인 레코드는 tenant 사용자에게 노출되지 않음)
CREATE POLICY "tenant_isolation" ON dead_letter_queue
  FOR ALL USING (tenant_id IS NOT NULL AND tenant_id = current_setting('app.current_tenant_id')::uuid);

-- service_role은 RLS 우회 (Edge Function에서 사용)
CREATE POLICY "service_role_full_access" ON dead_letter_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 인덱스: 재처리 대상 조회 최적화
CREATE INDEX idx_dlq_status_pending ON dead_letter_queue(status) WHERE status = 'pending';
CREATE INDEX idx_dlq_function_status ON dead_letter_queue(function_name, status);
CREATE INDEX idx_dlq_created_at ON dead_letter_queue(created_at DESC);

-- 원자적 DLQ claim을 위한 RPC 함수 (FOR UPDATE SKIP LOCKED)
-- 동시 worker 실행 시 중복 처리 방지
CREATE OR REPLACE FUNCTION claim_dlq_records(
  p_function_name TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS SETOF dead_letter_queue
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE dead_letter_queue
  SET status = 'retrying', last_retried_at = now()
  WHERE id IN (
    SELECT id FROM dead_letter_queue
    WHERE status = 'pending'
      AND (p_function_name IS NULL OR function_name = p_function_name)
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

COMMENT ON TABLE dead_letter_queue IS 'Phase 3: Edge Function 실패 작업 DLQ (재시도 소진 후 저장)';
COMMENT ON FUNCTION claim_dlq_records IS 'Phase 3: 원자적 DLQ 레코드 claim (FOR UPDATE SKIP LOCKED)';
