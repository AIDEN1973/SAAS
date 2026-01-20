-- Fix: Replace sc.status with sc.is_active in automation_triggers
-- [문제] student_classes 테이블에는 status 컬럼이 없고 is_active 컬럼만 존재
-- [해결] 100_automation_triggers.sql의 트리거 함수에서 sc.status를 sc.is_active로 수정

-- 트리거 함수 재생성 (수정된 버전)
CREATE OR REPLACE FUNCTION notify_guardians_on_class_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  event_type text;
  channel text;
  student_record record;
BEGIN
  -- 수업 상태 변화에 따라 이벤트 타입 결정
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status OR OLD.start_time != NEW.start_time OR OLD.end_time != NEW.end_time THEN
      event_type := 'class_schedule_changed';
      channel := 'sms'; -- SMS로 즉시 알림

      -- 학생 조회 및 알림 발송
      FOR student_record IN
        SELECT sc.student_id, g.id as guardian_id, g.phone
        FROM student_classes sc
        LEFT JOIN guardians g ON g.student_id = sc.student_id AND g.is_primary = true
        WHERE sc.class_id = NEW.id
          AND sc.tenant_id = NEW.tenant_id
          AND sc.is_active = true  -- 수정: status → is_active
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
        AND sc.is_active = true  -- 수정: status → is_active
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
          OLD.tenant_id::text || ':class_deleted:class:' || OLD.id::text || ':guardian:' || student_record.guardian_id::text || ':' || timezone('Asia/Seoul', now())::date::text,
          jsonb_build_object(
            'event_type', 'class_deleted',
            'class_id', OLD.id,
            'recipient_id', student_record.guardian_id,
            'channel', 'sms'
          )
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION notify_guardians_on_class_change IS
'[수정됨] student_classes.status → student_classes.is_active로 변경';
