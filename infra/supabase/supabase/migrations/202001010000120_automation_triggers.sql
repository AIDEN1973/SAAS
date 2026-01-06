/**
 * 자동화 트리거 생성
 *
 * AI_자동화_기능_정리.md Section 11 참조
 * 트리거 기반 자동화 구현
 *
 * [불변 규칙] Automation Config First: 모든 자동화는 Policy 기반으로만 동작
 * [불변 규칙] Fail Closed: Policy가 없으면 실행하지 않음
 */

-- ============================================================================
-- 1. 수업 변경/취소 알림 트리거 (class_change_or_cancel)
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_class_change_or_cancel()
RETURNS TRIGGER AS $$
DECLARE
  event_type TEXT := 'class_change_or_cancel';
  enabled BOOLEAN;
  channel TEXT;
  config_json JSONB;
  student_record RECORD;
BEGIN
  -- Policy 확인 (tenant_settings KV 구조에서 key='config' row의 value(JSONB) 조회)
  SELECT value INTO config_json
  FROM tenant_settings
  WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id)
    AND key = 'config';

  IF config_json IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- auto_notification.class_change_or_cancel.enabled 확인
  enabled := COALESCE(
    (config_json->'auto_notification'->event_type->>'enabled')::boolean,
    false
  );

  IF NOT enabled THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- 채널 Policy 조회 (Fail Closed: Policy가 없으면 실행하지 않음)
  channel := (config_json->'auto_notification'->event_type->>'channel')::text;
  IF channel IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- 수업에 등록된 학생들의 보호자에게 알림
  IF TG_OP = 'UPDATE' THEN
    -- 수업 시간 변경 또는 취소 상태 변경
    IF (OLD.start_time IS DISTINCT FROM NEW.start_time) OR
       (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled') THEN
      -- 학생 조회 및 알림 발송
      FOR student_record IN
        SELECT sc.student_id, g.id as guardian_id, g.phone
        FROM student_classes sc
        LEFT JOIN guardians g ON g.student_id = sc.student_id AND g.is_primary = true
        WHERE sc.class_id = NEW.id
          AND sc.tenant_id = NEW.tenant_id
          AND sc.status = 'active'
      LOOP
        IF student_record.guardian_id IS NOT NULL THEN
          INSERT INTO automation_actions (
            tenant_id,
            action_type,
            executor_role,
            dedup_key,
            execution_context
          ) VALUES (
            NEW.tenant_id,
            'send_notification',
            'system',
            NEW.tenant_id::text || ':' || event_type || ':class:' || NEW.id::text || ':guardian:' || student_record.guardian_id::text || ':' || timezone('Asia/Seoul', now())::date::text,
            jsonb_build_object(
              'event_type', event_type,
              'class_id', NEW.id,
              'recipient_id', student_record.guardian_id,
              'channel', channel,
              'change_type', CASE
                WHEN OLD.start_time IS DISTINCT FROM NEW.start_time THEN 'time_changed'
                WHEN NEW.status = 'cancelled' THEN 'cancelled'
                ELSE 'updated'
              END
            )
          );
        END IF;
      END LOOP;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    -- 수업 삭제
    FOR student_record IN
      SELECT sc.student_id, g.id as guardian_id, g.phone
      FROM student_classes sc
      LEFT JOIN guardians g ON g.student_id = sc.student_id AND g.is_primary = true
      WHERE sc.class_id = OLD.id
        AND sc.tenant_id = OLD.tenant_id
        AND sc.status = 'active'
    LOOP
      IF student_record.guardian_id IS NOT NULL THEN
        INSERT INTO automation_actions (
          tenant_id,
          action_type,
          executor_role,
          dedup_key,
          execution_context
        ) VALUES (
          OLD.tenant_id,
          'send_notification',
          'system',
            OLD.tenant_id::text || ':' || event_type || ':class:' || OLD.id::text || ':guardian:' || student_record.guardian_id::text || ':' || timezone('Asia/Seoul', now())::date::text,
          jsonb_build_object(
            'event_type', event_type,
            'class_id', OLD.id,
            'recipient_id', student_record.guardian_id,
            'channel', channel,
            'change_type', 'deleted'
          )
        );
      END IF;
    END LOOP;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS class_change_or_cancel_trigger ON academy_classes;
CREATE TRIGGER class_change_or_cancel_trigger
AFTER UPDATE OR DELETE ON academy_classes
FOR EACH ROW
EXECUTE FUNCTION notify_class_change_or_cancel();

-- ============================================================================
-- 2. 부분 결제 알림 트리거 (invoice_partial_balance)
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_invoice_partial_balance()
RETURNS TRIGGER AS $$
DECLARE
  event_type TEXT := 'invoice_partial_balance';
  enabled BOOLEAN;
  channel TEXT;
  config_json JSONB;
  guardian_record RECORD;
  balance NUMERIC;
BEGIN
  -- invoices 테이블의 amount_paid가 업데이트되었고, 부분 결제 상태인 경우
  -- amount_paid가 0보다 크고 amount보다 작은 경우
  IF NEW.amount_paid > 0 AND NEW.amount_paid < NEW.amount AND
     (OLD.amount_paid IS NULL OR OLD.amount_paid != NEW.amount_paid) THEN
    -- Policy 확인
    SELECT value INTO config_json
    FROM tenant_settings
    WHERE tenant_id = NEW.tenant_id
      AND key = 'config';

    IF config_json IS NULL THEN
      RETURN NEW;
    END IF;

    enabled := COALESCE(
      (config_json->'auto_notification'->event_type->>'enabled')::boolean,
      false
    );

    IF NOT enabled THEN
      RETURN NEW;
    END IF;

    -- 채널 Policy 조회 (Fail Closed: Policy가 없으면 실행하지 않음)
    channel := (config_json->'auto_notification'->event_type->>'channel')::text;
    IF channel IS NULL THEN
      RETURN NEW;
    END IF;

    -- 보호자 정보 조회
    SELECT * INTO guardian_record
    FROM guardians
    WHERE student_id = NEW.payer_id
      AND tenant_id = NEW.tenant_id
      AND is_primary = true
    LIMIT 1;

    IF guardian_record IS NULL THEN
      RETURN NEW;
    END IF;

    balance := NEW.amount - NEW.amount_paid;

    -- 부분 결제 알림 발송
    INSERT INTO automation_actions (
      tenant_id,
      action_type,
      executor_role,
      dedup_key,
      execution_context
    ) VALUES (
      NEW.tenant_id,
      'send_notification',
      'system',
      NEW.tenant_id::text || ':' || event_type || ':invoice:' || NEW.id::text || ':guardian:' || guardian_record.id::text || ':' || timezone('Asia/Seoul', now())::date::text,
      jsonb_build_object(
        'event_type', event_type,
        'invoice_id', NEW.id,
        'recipient_id', guardian_record.id,
        'channel', channel,
        'balance', balance
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS invoice_partial_balance_trigger ON invoices;
CREATE TRIGGER invoice_partial_balance_trigger
AFTER UPDATE ON invoices
FOR EACH ROW
WHEN (NEW.amount_paid > 0 AND NEW.amount_paid < NEW.amount)
EXECUTE FUNCTION notify_invoice_partial_balance();

-- ============================================================================
-- 3. 정기 결제 실패 알림 (recurring_payment_failed)
-- ============================================================================
-- 주의: 이 기능은 webhook 기반이므로 별도 Edge Function에서 처리
-- 여기서는 트리거만 제공 (webhook 호출 시 사용)

-- 주의: recurring_payment_failed는 webhook 기반이므로
-- payment-webhook-handler Edge Function에서 처리합니다.
-- 트리거는 제공하지 않습니다 (webhook 호출 시 Edge Function이 처리).

-- ============================================================================
-- 4. 긴급 공지 알림 트리거 (announcement_urgent)
-- ============================================================================
-- ⚠️ 참고: announcements 테이블이 없을 수 있으므로, 테이블 생성 후 활성화 필요

-- CREATE OR REPLACE FUNCTION notify_announcement_urgent()
-- RETURNS TRIGGER AS $$
-- DECLARE
--   event_type TEXT := 'announcement_urgent';
--   enabled BOOLEAN;
--   channel TEXT;
--   config_json JSONB;
--   guardian_record RECORD;
-- BEGIN
--   -- urgent 공지만 처리
--   IF NOT NEW.urgent THEN
--     RETURN NEW;
--   END IF;

--   -- Policy 확인
--   SELECT value INTO config_json
--   FROM tenant_settings
--   WHERE tenant_id = NEW.tenant_id
--     AND key = 'config';

--   IF config_json IS NULL THEN
--     RETURN NEW;
--   END IF;

--   enabled := COALESCE(
--     (config_json->'auto_notification'->event_type->>'enabled')::boolean,
--     false
--   );

--   IF NOT enabled THEN
--     RETURN NEW;
--   END IF;

--   channel := COALESCE(
--     (config_json->'auto_notification'->event_type->>'channel')::text,
--     'sms'
--   );

--   -- 대상자에게 알림 발송 (예: 모든 보호자)
--   FOR guardian_record IN
--     SELECT id, phone
--     FROM guardians
--     WHERE tenant_id = NEW.tenant_id
--       AND is_primary = true
--   LOOP
--     INSERT INTO automation_actions (
--       tenant_id,
--       action_type,
--       executor_role,
--       execution_context
--     ) VALUES (
--       NEW.tenant_id,
--       'send_notification',
--       'system',
--       jsonb_build_object(
--         'event_type', event_type,
--         'announcement_id', NEW.id,
--         'recipient_id', guardian_record.id,
--         'channel', channel
--       )
--     );
--   END LOOP;

--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- DROP TRIGGER IF EXISTS announcement_urgent_trigger ON announcements;
-- CREATE TRIGGER announcement_urgent_trigger
-- AFTER INSERT ON announcements
-- FOR EACH ROW
-- WHEN (NEW.urgent = true)
-- EXECUTE FUNCTION notify_announcement_urgent();

