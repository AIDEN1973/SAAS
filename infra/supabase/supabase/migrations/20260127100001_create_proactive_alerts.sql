-- =====================================================
-- 선제적 알림 기록 테이블
-- =====================================================
-- 목적: AI가 생성한 선제적 알림 기록 저장
-- 기능:
--   - 트리거별 알림 기록
--   - 알림 내용 및 권고 조치
--   - 읽음/안읽음 상태 관리
-- =====================================================

CREATE TABLE IF NOT EXISTS proactive_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 트리거 정보
  trigger_id UUID NOT NULL REFERENCES proactive_alert_triggers(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,

  -- 알림 내용
  title TEXT NOT NULL, -- 알림 제목 (예: "필터 태그 급증 감지")
  message TEXT NOT NULL, -- AI가 생성한 상세 메시지
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),

  -- 권고 조치 (AI 생성)
  recommended_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- 예시:
  -- [
  --   {
  --     "action": "send_message",
  --     "label": "해당 학생들에게 메시지 발송",
  --     "params": {"tag_ids": ["tag-uuid-1"]}
  --   },
  --   {
  --     "action": "review_filter",
  --     "label": "필터 조건 검토",
  --     "params": {"filter_id": "filter-uuid"}
  --   }
  -- ]

  -- 감지된 데이터
  detected_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 예시 (filter_tag_spike):
  -- {
  --   "tag_id": "tag-uuid-1",
  --   "previous_count": 10,
  --   "current_count": 17,
  --   "change_percent": 70,
  --   "period_days": 7
  -- }

  -- 상태 관리
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ
);

-- =====================================================
-- RLS 정책
-- =====================================================
ALTER TABLE proactive_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON proactive_alerts
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY "tenant_isolation_insert" ON proactive_alerts
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY "tenant_isolation_update" ON proactive_alerts
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY "tenant_isolation_delete" ON proactive_alerts
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- =====================================================
-- 인덱스
-- =====================================================
CREATE INDEX idx_proactive_alerts_tenant ON proactive_alerts(tenant_id);
CREATE INDEX idx_proactive_alerts_trigger ON proactive_alerts(trigger_id);
CREATE INDEX idx_proactive_alerts_read ON proactive_alerts(is_read);
CREATE INDEX idx_proactive_alerts_dismissed ON proactive_alerts(is_dismissed);
CREATE INDEX idx_proactive_alerts_created_at ON proactive_alerts(created_at DESC);

-- =====================================================
-- 주석
-- =====================================================
COMMENT ON TABLE proactive_alerts IS '선제적 알림 기록 (AI가 생성)';
COMMENT ON COLUMN proactive_alerts.trigger_id IS '트리거 설정 ID';
COMMENT ON COLUMN proactive_alerts.trigger_type IS '트리거 유형';
COMMENT ON COLUMN proactive_alerts.severity IS '심각도: info, warning, critical';
COMMENT ON COLUMN proactive_alerts.recommended_actions IS 'AI가 생성한 권고 조치 목록';
COMMENT ON COLUMN proactive_alerts.detected_data IS '감지된 데이터 (JSON 형식)';
COMMENT ON COLUMN proactive_alerts.is_read IS '읽음 여부';
COMMENT ON COLUMN proactive_alerts.is_dismissed IS '무시됨 여부';
