/**
 * Schedules 테이블 생성 (캘린더 기능)
 *
 * [불변 규칙] 전체 기술문서 3644-3658줄: schedules 테이블 스키마 정의
 * [불변 규칙] JWT claim 기반 RLS 사용 (PgBouncer Transaction Pooling 호환)
 * [불변 규칙] 상용화 단계 필수 기능
 */

CREATE TABLE IF NOT EXISTS schedules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  start_time      timestamptz NOT NULL,
  end_time        timestamptz NOT NULL,
  repeat_pattern  text CHECK (repeat_pattern IN ('daily', 'weekly', 'monthly', 'none')), -- 'daily', 'weekly', 'monthly', 'none'
  capacity        integer,
  assigned_to     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- 제약조건: end_time은 start_time보다 이후여야 함
  CONSTRAINT schedules_end_after_start CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_schedules_tenant ON schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_schedules_assigned_to ON schedules(assigned_to);
CREATE INDEX IF NOT EXISTS idx_schedules_start_time ON schedules(start_time);
CREATE INDEX IF NOT EXISTS idx_schedules_tenant_start_time ON schedules(tenant_id, start_time);

-- RLS 활성화
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- schedules RLS 정책 (JWT claim 기반)
CREATE POLICY tenant_isolation_schedules ON schedules
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_schedules_updated_at
  BEFORE UPDATE ON schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_schedules_updated_at();

