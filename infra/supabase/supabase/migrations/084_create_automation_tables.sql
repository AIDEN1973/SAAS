-- 자동화 관련 필수 테이블 생성
-- 프론트 자동화 문서 2.5 섹션 참조
-- Zero-Management 아키텍처 필수 테이블

-- 1. 자동화 실행 로그 테이블 (필수)
CREATE TABLE IF NOT EXISTS automation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES task_cards(id),
  action_type text NOT NULL,
  executed_by uuid REFERENCES auth.users(id),
  executed_at timestamptz DEFAULT now(),
  result jsonb,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- ⚠️ 감사/추적 필수 필드 (표준화, 프론트 자동화 문서 14.2 섹션 참조)
  trace_id text,              -- 요청 추적 ID (분산 추적용)
  request_id text,            -- 요청 ID (멱등성/재시도 추적용)
  policy_version text,        -- RLS 정책 버전 (보안 감사용)
  rule_id text,               -- 실행된 규칙 ID (비즈니스 로직 추적용)
  dedup_key text,             -- 중복 방지 키 (멱등성 검증용)
  approved_by uuid REFERENCES auth.users(id), -- 승인자 ID (Teacher의 request-approval인 경우)
  approved_at timestamptz,    -- 승인 시각
  executor_role text,         -- 실행자 역할 (admin/instructor/teacher 등, 감사용)  -- instructor는 정본 키, teacher는 backward compatibility
  execution_context jsonb     -- 실행 컨텍스트 (추가 메타데이터)
);

CREATE INDEX IF NOT EXISTS idx_automation_actions_tenant_date
ON automation_actions(tenant_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_actions_task
ON automation_actions(task_id);

COMMENT ON TABLE automation_actions IS '자동화 실행 로그 (Zero-Management 아키텍처 필수)';
COMMENT ON COLUMN automation_actions.trace_id IS '요청 추적 ID (분산 추적용)';
COMMENT ON COLUMN automation_actions.request_id IS '요청 ID (멱등성/재시도 추적용)';
COMMENT ON COLUMN automation_actions.approved_by IS '승인자 ID (Teacher의 request-approval인 경우)';
COMMENT ON COLUMN automation_actions.executor_role IS '실행자 역할 (admin/instructor/teacher 등, 감사용)  -- instructor는 정본 키, teacher는 backward compatibility';

-- 2. 자동화 Undo 로그 테이블 (감사/롤백용)
CREATE TABLE IF NOT EXISTS automation_undo_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES automation_actions(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reason text NOT NULL,
  before_state jsonb NOT NULL,  -- 변경 전 전체 상태 (snapshot)
  after_state jsonb NOT NULL,   -- 변경 후 전체 상태 (snapshot)
  reversible boolean NOT NULL DEFAULT true,  -- Undo 가능 여부 플래그
  original_action_type text NOT NULL,  -- 원본 액션 타입
  original_entity_type text NOT NULL,  -- 원본 엔티티 타입
  original_entity_id uuid NOT NULL,    -- 원본 엔티티 ID
  undo_status text NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_undo_logs_tenant_date
ON automation_undo_logs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_undo_logs_action
ON automation_undo_logs(action_id);

COMMENT ON TABLE automation_undo_logs IS '자동화 Undo 로그 (감사/롤백용)';

-- 3. 자동 실행 자기 억제 메커니즘 (Self-Regulation) - 필수
CREATE TABLE IF NOT EXISTS automation_safety_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  action_type text NOT NULL, -- 'send_message', 'create_task', 'generate_billing' 등
  window_start timestamptz NOT NULL, -- 시간 윈도우 시작 (예: 오늘 00:00 KST)
  window_end timestamptz NOT NULL, -- 시간 윈도우 종료 (예: 오늘 23:59 KST)
  executed_count integer DEFAULT 0, -- 현재 윈도우에서 실행된 횟수
  max_allowed integer NOT NULL, -- 최대 허용 횟수
  state text NOT NULL DEFAULT 'normal', -- 'normal' | 'throttled' | 'paused'
  last_reset_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT automation_safety_state_state_check CHECK (state IN ('normal', 'throttled', 'paused'))
);

CREATE INDEX IF NOT EXISTS idx_automation_safety_tenant_action
ON automation_safety_state(tenant_id, action_type, window_start);

COMMENT ON TABLE automation_safety_state IS '자동화 자기 억제 메커니즘 (Self-Regulation) - 필수';
COMMENT ON COLUMN automation_safety_state.state IS '상태: normal, throttled, paused';

-- 4. AI 판단 로그 테이블
CREATE TABLE IF NOT EXISTS ai_decision_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model text NOT NULL,
  features jsonb,
  score numeric,
  reason text,
  created_at timestamptz DEFAULT now(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  skipped_by_flag boolean DEFAULT false -- AI 기능이 꺼져 있어 스킵된 경우
);

CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_tenant_date
ON ai_decision_logs(tenant_id, created_at DESC);

COMMENT ON TABLE ai_decision_logs IS 'AI 판단 로그';

-- RLS 정책 (프론트 자동화 문서 2.5 섹션 참조)
ALTER TABLE automation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_undo_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_safety_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_decision_logs ENABLE ROW LEVEL SECURITY;

-- automation_actions RLS 정책 (RLS.txt 참조)
DROP POLICY IF EXISTS tenant_isolation_automation_actions ON automation_actions;
CREATE POLICY tenant_isolation_automation_actions ON automation_actions
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- automation_undo_logs RLS 정책 (RLS.txt 참조)
DROP POLICY IF EXISTS tenant_isolation_automation_undo_logs ON automation_undo_logs;
CREATE POLICY tenant_isolation_automation_undo_logs ON automation_undo_logs
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- automation_safety_state RLS 정책 (RLS.txt 참조)
DROP POLICY IF EXISTS tenant_isolation_automation_safety_state ON automation_safety_state;
CREATE POLICY tenant_isolation_automation_safety_state ON automation_safety_state
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ai_decision_logs RLS 정책 (RLS.txt 참조)
DROP POLICY IF EXISTS tenant_isolation_ai_decision_logs ON ai_decision_logs;
CREATE POLICY tenant_isolation_ai_decision_logs ON ai_decision_logs
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);




