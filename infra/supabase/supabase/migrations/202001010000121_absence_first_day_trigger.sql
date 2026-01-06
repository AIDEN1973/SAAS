/**
 * 결석 1일차 경고 알림 트리거
 *
 * AI_자동화_기능_정리.md Section 11 참조
 * customer_retention 카테고리: absence_first_day
 * 트리거 기반 자동화
 *
 * [불변 규칙] Automation Config First: 모든 자동화는 Policy 기반으로만 동작
 * [불변 규칙] Fail Closed: Policy가 없으면 실행하지 않음
 */

-- 결석 1일차 경고 알림 트리거
CREATE OR REPLACE FUNCTION notify_absence_first_day()
RETURNS TRIGGER AS $$
DECLARE
  event_type TEXT := 'absence_first_day';
  enabled BOOLEAN;
  channel TEXT;
  config_json JSONB;
  student_record RECORD;
  guardian_record RECORD;
  today_absence_count INTEGER;
BEGIN
  -- 결석 상태인 경우에만 처리
  IF NEW.status = 'absent' THEN
    -- 오늘 첫 결석인지 확인 (같은 날 다른 결석 로그가 없는지)
    SELECT COUNT(*) INTO today_absence_count
    FROM attendance_logs
    WHERE student_id = NEW.student_id
      AND tenant_id = NEW.tenant_id
      AND status = 'absent'
      AND occurred_at::date = NEW.occurred_at::date
      AND id != NEW.id;

    -- 오늘 첫 결석인 경우에만 처리
    IF today_absence_count = 0 THEN
      -- ⚠️ SSOT 위반: 트리거 함수에서 직접 JSONB 접근 (정본은 getTenantSettingByPath 사용)
      -- ⚠️ 권장: 이 트리거를 Edge Function으로 이동하여 getTenantSettingByPath 사용
      -- Policy 확인
      SELECT value INTO config_json
      FROM tenant_settings
      WHERE tenant_id = NEW.tenant_id
        AND key = 'config';

      IF config_json IS NULL THEN
        RETURN NEW;
      END IF;

      -- ⚠️ 정본 규칙: FAIL-CLOSED - Policy가 없으면 실행하지 않음 (기본값 사용 금지)
      -- ⚠️ SSOT 위반: 직접 JSONB 접근 (정본은 getTenantSettingByPath 사용, event_type 카탈로그 검증 포함)
      enabled := (config_json->'auto_notification'->event_type->>'enabled')::boolean;

      IF enabled IS NULL OR enabled = false THEN
        RETURN NEW;
      END IF;

      -- 채널 Policy 조회 (Fail Closed: Policy가 없으면 실행하지 않음)
      -- ⚠️ SSOT 위반: 직접 JSONB 접근 (정본은 getTenantSettingByPath 사용)
      channel := (config_json->'auto_notification'->event_type->>'channel')::text;
      IF channel IS NULL THEN
        RETURN NEW;
      END IF;

      -- 학생 정보 조회
      SELECT * INTO student_record
      FROM persons
      WHERE id = NEW.student_id
        AND tenant_id = NEW.tenant_id;

      IF student_record IS NULL THEN
        RETURN NEW;
      END IF;

      -- 보호자 정보 조회
      SELECT * INTO guardian_record
      FROM guardians
      WHERE student_id = NEW.student_id
        AND tenant_id = NEW.tenant_id
        AND is_primary = true
      LIMIT 1;

      IF guardian_record IS NULL THEN
        RETURN NEW;
      END IF;

      -- 결석 1일차 경고 알림 발송
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
        NEW.tenant_id::text || ':' || event_type || ':student:' || NEW.student_id::text || ':guardian:' || guardian_record.id::text || ':' || NEW.occurred_at::date::text,
        jsonb_build_object(
          'event_type', event_type,
          'student_id', NEW.student_id,
          'recipient_id', guardian_record.id,
          'channel', channel,
          'absence_date', NEW.occurred_at::date
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS absence_first_day_trigger ON attendance_logs;
CREATE TRIGGER absence_first_day_trigger
AFTER INSERT ON attendance_logs
FOR EACH ROW
WHEN (NEW.status = 'absent')
EXECUTE FUNCTION notify_absence_first_day();

