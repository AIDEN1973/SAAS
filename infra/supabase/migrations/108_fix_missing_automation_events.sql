-- 누락된 자동화 이벤트 타입 추가 마이그레이션
-- [목적] 기존 테넌트의 config에 consultation_summary_ready와 attendance_pattern_anomaly 추가
-- [문제] 일부 테넌트의 config에 이 두 이벤트 타입이 누락되어 경로 조회 시 오류 발생

DO $$
DECLARE
  v_tenant_record RECORD;
  v_current_config jsonb;
  v_updated_config jsonb;
  v_consultation_summary_ready_default jsonb;
  v_attendance_pattern_anomaly_default jsonb;
BEGIN
  -- 기본값 정의
  v_consultation_summary_ready_default := jsonb_build_object(
    'enabled', false,
    'channel', 'sms',
    'min_length', 50,
    'require_approval', true
  );

  v_attendance_pattern_anomaly_default := jsonb_build_object(
    'enabled', false,
    'channel', 'sms',
    'threshold', 3,
    'priority', 75,
    'ttl_days', 7,
    'throttle', jsonb_build_object(
      'daily_limit', 20,
      'student_limit', 5
    ),
    'require_approval', true
  );

  -- 모든 테넌트에 대해 처리
  FOR v_tenant_record IN SELECT id FROM public.tenants LOOP
    -- 현재 config 조회
    SELECT value INTO v_current_config
    FROM public.tenant_settings
    WHERE tenant_id = v_tenant_record.id AND key = 'config';

    -- config가 없으면 건너뛰기 (다른 마이그레이션에서 처리)
    IF v_current_config IS NULL THEN
      CONTINUE;
    END IF;

    -- auto_notification이 없으면 건너뛰기
    IF v_current_config->'auto_notification' IS NULL THEN
      CONTINUE;
    END IF;

    -- 업데이트가 필요한지 확인
    v_updated_config := v_current_config;
    v_updated_config := COALESCE(v_updated_config, '{}'::jsonb);

    -- consultation_summary_ready 추가 또는 업데이트
    IF v_updated_config->'auto_notification'->'consultation_summary_ready' IS NULL THEN
      -- 이벤트 타입이 없으면 기본값 추가
      v_updated_config := jsonb_set(
        v_updated_config,
        ARRAY['auto_notification', 'consultation_summary_ready'],
        v_consultation_summary_ready_default
      );
    ELSE
      -- 이벤트 타입이 있으면, 누락된 필드만 기본값으로 병합
      v_updated_config := jsonb_set(
        v_updated_config,
        ARRAY['auto_notification', 'consultation_summary_ready'],
        (v_updated_config->'auto_notification'->'consultation_summary_ready') || v_consultation_summary_ready_default
      );
    END IF;

    -- attendance_pattern_anomaly 추가 또는 업데이트
    IF v_updated_config->'auto_notification'->'attendance_pattern_anomaly' IS NULL THEN
      -- 이벤트 타입이 없으면 기본값 추가
      v_updated_config := jsonb_set(
        v_updated_config,
        ARRAY['auto_notification', 'attendance_pattern_anomaly'],
        v_attendance_pattern_anomaly_default
      );
    ELSE
      -- 이벤트 타입이 있으면, 누락된 필드만 기본값으로 병합
      -- throttle 객체도 병합 처리
      DECLARE
        v_existing_anomaly jsonb;
        v_existing_throttle jsonb;
        v_merged_throttle jsonb;
        v_merged_anomaly jsonb;
      BEGIN
        v_existing_anomaly := v_updated_config->'auto_notification'->'attendance_pattern_anomaly';
        v_existing_throttle := v_existing_anomaly->'throttle';

        -- throttle 병합
        IF v_existing_throttle IS NULL THEN
          v_merged_throttle := v_attendance_pattern_anomaly_default->'throttle';
        ELSE
          v_merged_throttle := v_existing_throttle || (v_attendance_pattern_anomaly_default->'throttle');
        END IF;

        -- 전체 객체 병합 (throttle 제외)
        v_merged_anomaly := (v_existing_anomaly || v_attendance_pattern_anomaly_default) - 'throttle';
        -- throttle 추가
        v_merged_anomaly := jsonb_set(v_merged_anomaly, ARRAY['throttle'], v_merged_throttle);

        v_updated_config := jsonb_set(
          v_updated_config,
          ARRAY['auto_notification', 'attendance_pattern_anomaly'],
          v_merged_anomaly
        );
      END;
    END IF;

    -- 업데이트 (변경사항이 있는 경우만)
    IF v_updated_config IS DISTINCT FROM v_current_config THEN
      UPDATE public.tenant_settings
      SET value = v_updated_config
      WHERE tenant_id = v_tenant_record.id AND key = 'config';

      RAISE NOTICE '테넌트 %의 config 업데이트 완료', v_tenant_record.id;
    END IF;
  END LOOP;
END $$;










