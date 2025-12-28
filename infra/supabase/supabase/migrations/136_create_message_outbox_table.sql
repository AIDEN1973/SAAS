-- Migration: Create message_outbox table for Outbox pattern
-- Description: 외부 발송(메시지/알림)을 DB 트랜잭션과 분리하여 멱등 발송 보장
-- ChatOps_계약_붕괴_방지_체계_분석.md 2.2.4 참조
-- Date: 2025-01-28

-- Outbox 패턴: 외부 발송 요청을 DB에 기록하고, 워커가 멱등 발송
-- - 중복 발송 방지
-- - 재시도 정책 적용
-- - 부분 성공 처리

CREATE TABLE IF NOT EXISTS message_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  intent_key text NOT NULL, -- 실행된 Intent 키
  student_ids uuid[] NOT NULL, -- 발송 대상 학생 ID 배열
  channel text NOT NULL, -- 'sms' | 'email' | 'push' 등
  template_id uuid, -- 메시지 템플릿 ID (선택적)
  params jsonb, -- 템플릿 파라미터
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'sent' | 'failed' | 'partial'
  idempotency_key text NOT NULL, -- 멱등성 키 (dedup_key와 동일)
  retry_count integer DEFAULT 0, -- 재시도 횟수
  max_retries integer DEFAULT 3, -- 최대 재시도 횟수
  success_count integer DEFAULT 0, -- 성공한 발송 수
  failure_count integer DEFAULT 0, -- 실패한 발송 수
  success_list jsonb, -- 성공한 학생 ID 리스트
  failure_list jsonb, -- 실패한 학생 ID 리스트 (이유 포함)
  error_message text, -- 전체 실패 시 에러 메시지
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  processed_at timestamptz, -- 처리 시작 시각
  completed_at timestamptz -- 처리 완료 시각
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_message_outbox_tenant_status
ON message_outbox(tenant_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_message_outbox_idempotency
ON message_outbox(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_message_outbox_pending
ON message_outbox(status, created_at)
WHERE status = 'pending';

-- 상태 체크 제약
ALTER TABLE message_outbox
ADD CONSTRAINT message_outbox_status_check
CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'partial'));

-- 멱등성 키 유니크 제약 (같은 요청의 중복 방지)
CREATE UNIQUE INDEX IF NOT EXISTS idx_message_outbox_idempotency_unique
ON message_outbox(idempotency_key)
WHERE status IN ('pending', 'processing', 'sent', 'processing');

COMMENT ON TABLE message_outbox IS '외부 발송 Outbox (Outbox 패턴 구현)';
COMMENT ON COLUMN message_outbox.idempotency_key IS '멱등성 키 (dedup_key와 동일)';
COMMENT ON COLUMN message_outbox.status IS '상태: pending(대기), processing(처리중), sent(성공), failed(실패), partial(부분성공)';
COMMENT ON COLUMN message_outbox.success_list IS '성공한 학생 ID 리스트 [{entity_id, entity_name}]';
COMMENT ON COLUMN message_outbox.failure_list IS '실패한 학생 ID 리스트 [{entity_id, entity_name, reason}]';

