/**
 * 결제 완료 시 알림 자동 발송 트리거
 *
 * 아키텍처 문서 2451줄 참조: 결제 완료 알림 발송
 * 주의: 영수증은 알림뱅킹에서 자동 발송되므로, 여기서는 결제 완료 알림만 처리
 * Zero-Management: 사용자 개입 없이 자동 실행
 */

-- 결제 완료 시 알림 자동 발송 트리거 (영수증은 알림뱅킹에서 처리)
CREATE OR REPLACE FUNCTION send_payment_complete_notification()
RETURNS TRIGGER AS $$
DECLARE
  invoice_record RECORD;
  payer_record RECORD;
  guardian_record RECORD;
  notification_channel TEXT;
  auto_notification_enabled BOOLEAN;
BEGIN
  -- 결제 완료 상태로 변경된 경우에만 처리
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    -- 청구서 정보 조회
    SELECT * INTO invoice_record
    FROM invoices
    WHERE id = NEW.invoice_id AND tenant_id = NEW.tenant_id;

    IF invoice_record IS NULL THEN
      RETURN NEW;
    END IF;

    -- 납부자(학생) 정보 조회
    SELECT * INTO payer_record
    FROM persons
    WHERE id = invoice_record.payer_id AND tenant_id = NEW.tenant_id;

    IF payer_record IS NULL THEN
      RETURN NEW;
    END IF;

    -- 학부모 정보 조회 (주 연락처 우선)
    SELECT * INTO guardian_record
    FROM guardians
    WHERE student_id = payer_record.id
      AND tenant_id = NEW.tenant_id
      AND is_primary = true
    LIMIT 1;

    -- 주 연락처가 없으면 첫 번째 연락처 사용
    IF guardian_record IS NULL THEN
      SELECT * INTO guardian_record
      FROM guardians
      WHERE student_id = payer_record.id
        AND tenant_id = NEW.tenant_id
      LIMIT 1;
    END IF;

    -- 알림 채널 및 자동 알림 설정 확인 (한 번의 쿼리로 최적화)
    SELECT
      COALESCE(
        (settings->'notification'->'auto_notification'->>'payment_complete')::boolean,
        false
      ),
      COALESCE(
        (settings->'notification'->'auto_notification'->>'channel'),
        'sms'
      )
    INTO auto_notification_enabled, notification_channel
    FROM tenant_settings
    WHERE tenant_id = NEW.tenant_id
    LIMIT 1;

    -- 결제 완료 알림 발송 (영수증은 알림뱅킹에서 자동 발송됨)
    -- 아키텍처 문서 2451줄: Webhook 처리 순서 5번 "Notification 발송 (결제 완료 알림)"
    -- 알림뱅킹에서 영수증을 발송하지만, 추가 알림이 필요한 경우에만 발송

    -- 자동 알림이 활성화되어 있고 학부모 연락처가 있는 경우에만 발송
    IF auto_notification_enabled AND guardian_record.phone IS NOT NULL THEN
      INSERT INTO notifications (
        tenant_id,
        recipient_type,
        recipient_id,
        channel,
        event_type,
        template_key,
        template_data,
        status,
        scheduled_at
      ) VALUES (
        NEW.tenant_id,
        'guardian',
        guardian_record.id,
        notification_channel,
        'payment_complete',
        'billing_payment_complete_academy_v1', -- 아키텍처 문서 3039줄 참조
        jsonb_build_object(
          'student_name', payer_record.name,
          'invoice_number', invoice_record.invoice_number,
          'amount', NEW.amount,
          'paid_at', NEW.paid_at,
          'payment_method', NEW.payment_method,
          'note', '영수증은 알림뱅킹에서 자동 발송되었습니다.'
        ),
        'pending',
        NOW()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 트리거가 있으면 제거 후 재생성 (멱등성 보장)
DROP TRIGGER IF EXISTS payment_complete_notification_trigger ON payments;

CREATE TRIGGER payment_complete_notification_trigger
AFTER INSERT OR UPDATE ON payments
FOR EACH ROW
WHEN (NEW.status = 'paid')
EXECUTE FUNCTION send_payment_complete_notification();

-- 청구서 생성 시 알림 자동 발송 트리거
CREATE OR REPLACE FUNCTION send_invoice_created_notification()
RETURNS TRIGGER AS $$
DECLARE
  payer_record RECORD;
  guardian_record RECORD;
  notification_channel TEXT;
  auto_notification_enabled BOOLEAN;
BEGIN
  -- 청구서 생성 시 (status가 draft인 경우)
  IF NEW.status = 'draft' THEN
    -- 납부자(학생) 정보 조회
    SELECT * INTO payer_record
    FROM persons
    WHERE id = NEW.payer_id AND tenant_id = NEW.tenant_id;

    IF payer_record IS NULL THEN
      RETURN NEW;
    END IF;

    -- 학부모 정보 조회
    SELECT * INTO guardian_record
    FROM guardians
    WHERE student_id = payer_record.id
      AND tenant_id = NEW.tenant_id
      AND is_primary = true
    LIMIT 1;

    IF guardian_record IS NULL THEN
      SELECT * INTO guardian_record
      FROM guardians
      WHERE student_id = payer_record.id
        AND tenant_id = NEW.tenant_id
      LIMIT 1;
    END IF;

    -- 자동 알림 설정 확인
    SELECT
      COALESCE(
        (settings->'notification'->'auto_notification'->>'invoice_created')::boolean,
        false
      ),
      COALESCE(
        (settings->'notification'->'auto_notification'->>'channel'),
        'sms'
      )
    INTO auto_notification_enabled, notification_channel
    FROM tenant_settings
    WHERE tenant_id = NEW.tenant_id
    LIMIT 1;

    -- 자동 알림이 활성화되어 있고 학부모 연락처가 있는 경우
    IF auto_notification_enabled AND guardian_record.phone IS NOT NULL THEN
      INSERT INTO notifications (
        tenant_id,
        recipient_type,
        recipient_id,
        channel,
        event_type,
        template_key,
        template_data,
        status,
        scheduled_at
      ) VALUES (
        NEW.tenant_id,
        'guardian',
        guardian_record.id,
        notification_channel,
        'invoice_created',
        'billing_invoice_created_academy_v1',
        jsonb_build_object(
          'student_name', payer_record.name,
          'invoice_number', NEW.invoice_number,
          'amount', NEW.amount,
          'due_date', NEW.due_date,
          'period_start', NEW.period_start,
          'period_end', NEW.period_end
        ),
        'pending',
        NOW()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 트리거가 있으면 제거 후 재생성 (멱등성 보장)
DROP TRIGGER IF EXISTS invoice_created_notification_trigger ON invoices;

CREATE TRIGGER invoice_created_notification_trigger
AFTER INSERT ON invoices
FOR EACH ROW
WHEN (NEW.status = 'draft')
EXECUTE FUNCTION send_invoice_created_notification();

