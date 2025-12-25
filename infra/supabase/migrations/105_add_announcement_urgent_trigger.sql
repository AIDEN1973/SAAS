-- announcement_urgent 트리거 활성화
-- announcements 테이블 생성 후 이 마이그레이션을 실행하여 트리거를 활성화합니다.
-- AI_자동화_기능_정리.md Section 11: announcement_urgent 참조

-- ⚠️ 참고: 100_automation_triggers.sql에 주석 처리된 트리거가 있으므로, 여기서 활성화합니다.

-- ============================================================================
-- 1. 긴급 공지 알림 트리거 (announcement_urgent)
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_announcement_urgent()
RETURNS TRIGGER AS $$
DECLARE
  event_type TEXT := 'announcement_urgent';
  enabled BOOLEAN;
  channel TEXT;
  config_json JSONB;
  guardian_record RECORD;
  dedup_key TEXT;
BEGIN
  IF NEW.urgent = TRUE AND NEW.status = 'published' THEN
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

    channel := COALESCE(
      (config_json->'auto_notification'->event_type->>'channel')::text,
      NULL -- Fail Closed if not found
    );
    IF channel IS NULL THEN
      RETURN NEW;
    END IF;

    -- 대상자에 따라 알림 발송
    -- target_audience가 'all' 또는 'guardians'인 경우 모든 보호자에게 알림
    FOR guardian_record IN
      SELECT id, phone
      FROM guardians
      WHERE tenant_id = NEW.tenant_id
        AND is_primary = true
        AND (
          NEW.target_audience IS NULL
          OR NEW.target_audience = 'all'
          OR NEW.target_audience = 'guardians'
        )
    LOOP
      -- [불변 규칙] 기술문서 19-1-2: KST 기준 날짜 처리 (timezone('Asia/Seoul', now())::date 사용)
      dedup_key := NEW.tenant_id || ':' || event_type || ':announcement:' || NEW.id || ':guardian:' || guardian_record.id || ':' || timezone('Asia/Seoul', now())::date::text;
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
        dedup_key,
        jsonb_build_object(
          'event_type', event_type,
          'announcement_id', NEW.id,
          'recipient_id', guardian_record.id,
          'channel', channel,
          'title', NEW.title
        )
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS announcement_urgent_trigger ON public.announcements;
CREATE TRIGGER announcement_urgent_trigger
AFTER INSERT OR UPDATE ON public.announcements
FOR EACH ROW
WHEN (NEW.urgent = TRUE AND NEW.status = 'published')
EXECUTE FUNCTION notify_announcement_urgent();

COMMENT ON FUNCTION notify_announcement_urgent() IS '긴급 공지 알림 트리거 (announcement_urgent 자동화 기능)';

