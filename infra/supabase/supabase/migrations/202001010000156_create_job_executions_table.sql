-- Migration: Create job_executions table for Worker architecture
-- Description: Worker 아키텍처를 위한 job 실행 테이블 생성
-- ChatOps_계약_붕괴_방지_체계_분석.md 4.6 참조
-- Date: 2025-01-28

-- Worker 아키텍처: Apply 단계는 job 생성만, 실제 실행은 Worker가 처리
-- - 중복 실행 방지 (idempotency_key)
-- - 재시도 정책 적용
-- - 부분 성공 처리
-- - 상태 추적 (pending → running → success/partial/failed)

CREATE TABLE IF NOT EXISTS job_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  intent_key text NOT NULL, -- 실행할 Intent 키
  automation_level text, -- 'L1' | 'L2'
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'running' | 'success' | 'partial' | 'failed'
  idempotency_key text NOT NULL, -- 멱등성 키 (중복 실행 방지)
  payload jsonb NOT NULL, -- 실행 입력 (UUID만 포함, PII 제외)
  result jsonb, -- 성공/실패 상세 (HandlerResult 형태)
  retry_count integer DEFAULT 0, -- 재시도 횟수
  max_retries integer DEFAULT 3, -- 최대 재시도 횟수
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  started_at timestamptz, -- 처리 시작 시각
  completed_at timestamptz, -- 처리 완료 시각
  error_message text, -- 실패 시 에러 메시지
  execution_context jsonb -- 실행 컨텍스트 (resolve_snapshot, apply_input, policy_verdict 등)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_job_executions_tenant_status
ON job_executions(tenant_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_job_executions_idempotency
ON job_executions(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_job_executions_pending
ON job_executions(status, created_at)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_job_executions_running
ON job_executions(status, started_at)
WHERE status = 'running';

-- 상태 체크 제약
ALTER TABLE job_executions
ADD CONSTRAINT job_executions_status_check
CHECK (status IN ('pending', 'running', 'success', 'partial', 'failed'));

-- automation_level 체크 제약
ALTER TABLE job_executions
ADD CONSTRAINT job_executions_automation_level_check
CHECK (automation_level IS NULL OR automation_level IN ('L1', 'L2'));

-- 멱등성 키 유니크 제약 (같은 요청의 중복 방지)
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_executions_idempotency_unique
ON job_executions(idempotency_key)
WHERE status IN ('pending', 'running');

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_job_executions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_job_executions_updated_at
BEFORE UPDATE ON job_executions
FOR EACH ROW
EXECUTE FUNCTION update_job_executions_updated_at();

COMMENT ON TABLE job_executions IS 'Worker 아키텍처를 위한 job 실행 테이블';
COMMENT ON COLUMN job_executions.idempotency_key IS '멱등성 키 (중복 실행 방지)';
COMMENT ON COLUMN job_executions.status IS '상태: pending(대기), running(처리중), success(성공), partial(부분성공), failed(실패)';
COMMENT ON COLUMN job_executions.payload IS '실행 입력 (UUID만 포함, PII 제외)';
COMMENT ON COLUMN job_executions.result IS '성공/실패 상세 (HandlerResult 형태)';
COMMENT ON COLUMN job_executions.execution_context IS '실행 컨텍스트 (resolve_snapshot, apply_input, policy_verdict 등)';

