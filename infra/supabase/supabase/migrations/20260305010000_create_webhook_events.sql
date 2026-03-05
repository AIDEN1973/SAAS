-- Phase 0-1: webhook_events 테이블 생성 (멱등성 처리용)
-- 웹훅 이벤트 수신 기록 + 중복 처리 방지

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스: event_id 조회 (중복 체크용)
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);

-- 인덱스: 상태별 조회 + 오래된 이벤트 정리용
CREATE INDEX IF NOT EXISTS idx_webhook_events_status_created ON webhook_events(status, created_at);

-- RLS: webhook_events는 시스템(service_role)만 접근 가능
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- service_role만 접근 허용 (anon/authenticated 차단)
-- Edge Function에서 service_role_key로 접근하므로 RLS 정책 불필요 (service_role은 RLS bypass)
COMMENT ON TABLE webhook_events IS 'Webhook event deduplication table. Accessed only by Edge Functions via service_role.';
