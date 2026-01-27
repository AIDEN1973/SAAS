-- =====================================================
-- 선제적 알림 트리거 설정 테이블
-- =====================================================
-- 목적: AI가 데이터 패턴을 분석하여 관리자에게 선제적 조치 권고
-- 기능:
--   - 관리자가 트리거 조건을 직접 설정/수정 가능
--   - 트리거 유형: filter_tag_spike, billing_overdue_spike, attendance_drop, churn_risk_increase
--   - Cron Job으로 매일 9AM 체크
-- =====================================================

CREATE TABLE IF NOT EXISTS proactive_alert_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 트리거 메타데이터
  name TEXT NOT NULL, -- 사용자 정의 트리거 이름 (예: "필터 태그 급증 감지")
  description TEXT, -- 설명

  -- 트리거 유형
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'filter_tag_spike',           -- 필터 태그 급증
    'billing_overdue_spike',      -- 결제 연체 급증
    'attendance_drop',            -- 출석률 급감
    'churn_risk_increase'         -- 이탈 위험 증가
  )),

  -- 트리거 조건 (JSON)
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 예시 (filter_tag_spike):
  -- {
  --   "tag_ids": ["tag-uuid-1", "tag-uuid-2"],
  --   "threshold_percent": 50,  -- 50% 이상 증가
  --   "period_days": 7,          -- 7일 기준
  --   "min_change": 3            -- 최소 3명 이상 변화
  -- }
  -- 예시 (billing_overdue_spike):
  -- {
  --   "threshold_count": 5,      -- 5명 이상
  --   "period_days": 7
  -- }
  -- 예시 (attendance_drop):
  -- {
  --   "threshold_percent": 20,   -- 20% 이상 하락
  --   "period_days": 14,
  --   "target_courses": ["course-uuid-1"]
  -- }
  -- 예시 (churn_risk_increase):
  -- {
  --   "threshold_count": 3,      -- 3명 이상
  --   "period_days": 30
  -- }

  -- 활성화 상태
  is_active BOOLEAN DEFAULT true,

  -- 마지막 트리거 시각
  last_triggered_at TIMESTAMPTZ,

  -- 마지막 체크 시각
  last_check_at TIMESTAMPTZ,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- RLS 정책
-- =====================================================
ALTER TABLE proactive_alert_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON proactive_alert_triggers
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY "tenant_isolation_insert" ON proactive_alert_triggers
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY "tenant_isolation_update" ON proactive_alert_triggers
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY "tenant_isolation_delete" ON proactive_alert_triggers
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- =====================================================
-- 인덱스
-- =====================================================
CREATE INDEX idx_proactive_alert_triggers_tenant ON proactive_alert_triggers(tenant_id);
CREATE INDEX idx_proactive_alert_triggers_type ON proactive_alert_triggers(trigger_type);
CREATE INDEX idx_proactive_alert_triggers_active ON proactive_alert_triggers(is_active);

-- =====================================================
-- Updated_at 자동 업데이트 트리거
-- =====================================================
CREATE TRIGGER update_proactive_alert_triggers_updated_at
  BEFORE UPDATE ON proactive_alert_triggers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 주석
-- =====================================================
COMMENT ON TABLE proactive_alert_triggers IS '선제적 알림 트리거 설정 (관리자가 직접 설정/수정 가능)';
COMMENT ON COLUMN proactive_alert_triggers.trigger_type IS '트리거 유형: filter_tag_spike, billing_overdue_spike, attendance_drop, churn_risk_increase';
COMMENT ON COLUMN proactive_alert_triggers.config IS '트리거 조건 (JSON 형식)';
COMMENT ON COLUMN proactive_alert_triggers.is_active IS '트리거 활성화 여부';
COMMENT ON COLUMN proactive_alert_triggers.last_triggered_at IS '마지막 트리거 실행 시각';
COMMENT ON COLUMN proactive_alert_triggers.last_check_at IS '마지막 체크 시각';
