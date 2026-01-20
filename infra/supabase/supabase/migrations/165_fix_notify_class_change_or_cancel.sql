-- Fix: notify_class_change_or_cancel 함수의 sc.status 참조 수정
-- [문제] student_classes 테이블에는 status 컬럼이 없고 is_active 컬럼만 존재
-- [해결] sc.status = 'active' → sc.is_active = true로 수정

-- 1. 기존 트리거 삭제
DROP TRIGGER IF EXISTS class_change_or_cancel_trigger ON public.academy_classes;

-- 2. 수정된 함수 재생성
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
      -- [FIX] sc.status = 'active' → sc.is_active = true
      FOR student_record IN
        SELECT sc.student_id, g.id as guardian_id, g.phone
        FROM student_classes sc
        LEFT JOIN guardians g ON g.student_id = sc.student_id AND g.is_primary = true
        WHERE sc.class_id = NEW.id
          AND sc.tenant_id = NEW.tenant_id
          AND sc.is_active = true  -- 수정: status = 'active' → is_active = true
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
    -- [FIX] sc.status = 'active' → sc.is_active = true
    FOR student_record IN
      SELECT sc.student_id, g.id as guardian_id, g.phone
      FROM student_classes sc
      LEFT JOIN guardians g ON g.student_id = sc.student_id AND g.is_primary = true
      WHERE sc.class_id = OLD.id
        AND sc.tenant_id = OLD.tenant_id
        AND sc.is_active = true  -- 수정: status = 'active' → is_active = true
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

-- 3. 트리거 재생성
CREATE TRIGGER class_change_or_cancel_trigger
AFTER UPDATE OR DELETE ON academy_classes
FOR EACH ROW
EXECUTE FUNCTION notify_class_change_or_cancel();

COMMENT ON FUNCTION notify_class_change_or_cancel IS
'[수정됨] student_classes.status → student_classes.is_active로 변경 (165번 migration)';
