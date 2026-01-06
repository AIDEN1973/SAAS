-- 자동화 기본 정책(Default Policy) 설정 마이그레이션
-- [목적] 테넌트 생성 시 자동화 기본값을 설정값으로 저장
-- [불변 규칙] Automation Config First: 모든 자동화는 Policy 기반으로만 동작
-- [불변 규칙] 기본값(Default)은 코드 상수가 아니라 Default Policy이며, 테넌트 생성 시 설정값으로 저장됨

-- create_tenant_with_onboarding 함수 수정: 자동화 기본 정책 추가
CREATE OR REPLACE FUNCTION create_tenant_with_onboarding(
  p_name text,
  p_industry_type text,
  p_plan text DEFAULT 'basic',
  p_owner_user_id uuid DEFAULT auth.uid(),
  p_referral_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- 서버 권한으로 실행
SET search_path = public -- 스키마 경로 명시 (PostgREST 스키마 캐시 문제 해결)
AS $$
DECLARE
  v_tenant_id uuid;
  v_tenant jsonb;
  v_user_tenant_role jsonb;
  v_config jsonb;
BEGIN
  -- 1. 테넌트 생성
  INSERT INTO public.tenants (name, industry_type, plan, status)
  VALUES (p_name, p_industry_type, p_plan, 'active')
  RETURNING id INTO v_tenant_id;

  -- 2. 테넌트 기본 설정 초기화
  -- ⚠️ SSOT-2: industry_type은 tenants 테이블이 1차 소스이며, tenant_settings에 저장하지 않음
  -- 아래 'industry' 키는 하위 호환성을 위한 것이며, 실제 industry_type 결정은 tenants 테이블에서 수행
  INSERT INTO public.tenant_settings (tenant_id, key, value)
  VALUES
    (v_tenant_id, 'timezone', '{"timezone": "Asia/Seoul"}'),
    (v_tenant_id, 'locale', '{"locale": "ko-KR"}'),
    (v_tenant_id, 'industry', jsonb_build_object('industry_type', p_industry_type));  -- ⚠️ 하위 호환성용, SSOT는 tenants.industry_type

  -- 3. 자동화 기본 정책(Default Policy) 설정
  -- ⚠️ 개선: Low-Risk 자동화(조회/분석/리포트)는 enabled: true로 설정하여 즉시 사용 가능
  -- ⚠️ Medium/High-Risk 자동화(메시지 발송, 금전 관련)는 enabled: false로 설정하여 사용자 활성화 필요
  -- ⚠️ 중요: 기준값(threshold, limit, time 등)은 기본값을 설정하여 사용자가 바로 사용할 수 있도록 함
  v_config := jsonb_build_object(
    -- AI 승인 자동화 설정 (Phase 2)
    'automation_approval', jsonb_build_object(
      'auto_approve_enabled', true,  -- 자동 승인 활성화
      'auto_approve_threshold', 'medium'  -- medium 이하는 자동 승인 (low, medium 자동 실행)
    ),
    -- 키오스크 출석 체크 설정 (Phase 4)
    'kiosk', jsonb_build_object(
      'enabled', true,  -- 키오스크 모드 활성화
      'check_in_method', 'phone_only',  -- phone_only (휴대폰 번호만), phone_auth (SMS 인증), qr_scan
      'auto_notify_guardian', true,  -- 출석 완료 시 보호자 자동 알림
      'notification_channel', 'kakao_at',  -- 알림 채널
      'notification_template', '${student_name} 학생이 ${time}에 출석했습니다.'
    ),
    'auto_notification', jsonb_build_object(
      -- financial_health (10개: Low-Risk 6개, Medium-Risk 3개, High-Risk 1개)
      'payment_due_reminder', jsonb_build_object(
        'enabled', false,  -- Medium-Risk: 메시지 발송
        'channel', 'sms',
        'days_before_first', 3,
        'days_before_second', 1
      ),
      'invoice_partial_balance', jsonb_build_object(
        'enabled', false,  -- Medium-Risk: 메시지 발송
        'channel', 'sms'
      ),
      'recurring_payment_failed', jsonb_build_object(
        'enabled', false,  -- High-Risk: 결제 관련
        'channel', 'sms'
      ),
      'revenue_target_under', jsonb_build_object(
        'enabled', true,  -- Low-Risk: 내부 알림만
        'monthly_target', 5000000
      ),
      'collection_rate_drop', jsonb_build_object(
        'enabled', true,  -- Low-Risk: 내부 알림만
        'threshold', 0.7
      ),
      'overdue_outstanding_over_limit', jsonb_build_object(
        'enabled', false,  -- Medium-Risk: 메시지 발송
        'channel', 'sms',
        'limit_amount', 1000000
      ),
      'revenue_required_per_day', jsonb_build_object(
        'enabled', true,  -- Low-Risk: 내부 알림만
        'monthly_target', 5000000
      ),
      'top_overdue_customers_digest', jsonb_build_object(
        'enabled', true  -- Low-Risk: 리포트 조회만
      ),
      'refund_spike', jsonb_build_object(
        'enabled', true,  -- Low-Risk: 내부 알림만
        'threshold', 3
      ),
      'monthly_business_report', jsonb_build_object(
        'enabled', true,  -- Low-Risk: 리포트 조회만
        'report_day', 1
      ),
      -- capacity_optimization (6개: 모두 Low-Risk)
      'class_fill_rate_low_persistent', jsonb_build_object(
        'enabled', true,  -- Low-Risk: 내부 알림만
        'threshold', 0.5,
        'persistent_days', 7
      ),
      'ai_suggest_class_merge', jsonb_build_object(
        'enabled', true  -- Low-Risk: AI 제안만
      ),
      'time_slot_fill_rate_low', jsonb_build_object(
        'enabled', true,  -- Low-Risk: 내부 알림만
        'threshold', 0.4
      ),
      'high_fill_rate_expand_candidate', jsonb_build_object(
        'enabled', true,  -- Low-Risk: AI 제안만
        'threshold', 0.9
      ),
      'unused_class_persistent', jsonb_build_object(
        'enabled', true,  -- Low-Risk: 내부 알림만
        'persistent_days', 14
      ),
      'weekly_ops_summary', jsonb_build_object(
        'enabled', true,  -- Low-Risk: 리포트 조회만
        'report_day_of_week', 1  -- 월요일
      ),
      -- customer_retention (8개: Low-Risk 4개, Medium-Risk 4개)
      'class_reminder_today', jsonb_build_object(
        'enabled', false,  -- Medium-Risk: 메시지 발송
        'channel', 'kakao_at',
        'send_time', '08:00'
      ),
      'class_schedule_tomorrow', jsonb_build_object(
        'enabled', false,  -- Medium-Risk: 메시지 발송
        'channel', 'kakao_at',
        'send_time', '19:00'
      ),
      'consultation_reminder', jsonb_build_object(
        'enabled', false,  -- Medium-Risk: 메시지 발송
        'channel', 'sms',
        'hours_before', 24
      ),
      'absence_first_day', jsonb_build_object(
        'enabled', false,  -- Medium-Risk: 메시지 발송
        'channel', 'sms'
      ),
      'churn_increase', jsonb_build_object(
        'enabled', true,  -- Low-Risk: 내부 알림만
        'threshold', 0.15
      ),
      'ai_suggest_churn_focus', jsonb_build_object(
        'enabled', true  -- Low-Risk: AI 제안만
      ),
      'attendance_rate_drop_weekly', jsonb_build_object(
        'enabled', true,  -- Low-Risk: 내부 알림만
        'threshold', 0.7
      ),
      'risk_students_weekly_kpi', jsonb_build_object(
        'enabled', true  -- Low-Risk: 리포트 조회만
      ),
      -- growth_marketing (6개: Low-Risk 5개, Medium-Risk 1개)
      'new_member_drop', jsonb_build_object(
        'enabled', true,  -- Low-Risk: 내부 알림만
        'threshold', 0.3
      ),
      'inquiry_conversion_drop', jsonb_build_object(
        'enabled', false,  -- Medium-Risk + planned: 구현 예정
        'threshold', 0.3
      ),
      'birthday_greeting', jsonb_build_object(
        'enabled', true,  -- Low-Risk: 축하 메시지 (planned)
        'channel', 'kakao_at'
      ),
      'enrollment_anniversary', jsonb_build_object(
        'enabled', true,  -- Low-Risk: 기념 메시지 (planned)
        'channel', 'kakao_at'
      ),
      'regional_underperformance', jsonb_build_object(
        'enabled', true,  -- Low-Risk: 내부 알림만
        'threshold', 0.3
      ),
      'regional_rank_drop', jsonb_build_object(
        'enabled', true,  -- Low-Risk: 내부 알림만
        'threshold', 3
      ),
      -- safety_compliance (7개: Low-Risk 2개, Medium-Risk 4개, High-Risk 1개)
      'class_change_or_cancel', jsonb_build_object(
        'enabled', false,  -- Medium-Risk: 메시지 발송
        'channel', 'kakao_at'
      ),
      'checkin_reminder', jsonb_build_object(
        'enabled', false,  -- Medium-Risk: 메시지 발송
        'channel', 'sms',
        'minutes_before', 30
      ),
      'checkout_missing_alert', jsonb_build_object(
        'enabled', false,  -- Medium-Risk: 메시지 발송
        'channel', 'sms',
        'hours_after', 2
      ),
      'announcement_urgent', jsonb_build_object(
        'enabled', false,  -- High-Risk: 긴급 대량 발송 (planned)
        'channel', 'sms'
      ),
      'announcement_digest', jsonb_build_object(
        'enabled', true,  -- Low-Risk: 리포트 조회만 (planned)
        'digest_period', 'weekly'
      ),
      'consultation_summary_ready', jsonb_build_object(
        'enabled', true,  -- Low-Risk: 내부 알림만
        'min_length', 50
      ),
      'attendance_pattern_anomaly', jsonb_build_object(
        'enabled', false,  -- Medium-Risk: 메시지 발송
        'channel', 'sms',
        'threshold', 3,
        'priority', 90,
        'ttl_days', 7,
        'throttle', jsonb_build_object(
          'daily_limit', 20
        )
      ),
      -- workforce_ops (2개: Low-Risk 1개, Medium-Risk 1개)
      'teacher_workload_imbalance', jsonb_build_object(
        'enabled', true,  -- Low-Risk: 내부 알림만
        'threshold', 1.5
      ),
      'staff_absence_schedule_risk', jsonb_build_object(
        'enabled', false  -- Medium-Risk + planned: 구현 예정
      )
    )
  );

  -- config 키에 자동화 기본 정책 저장
  INSERT INTO public.tenant_settings (tenant_id, key, value)
  VALUES (v_tenant_id, 'config', v_config);

  -- 4. 테넌트 기능 설정 초기화
  INSERT INTO public.tenant_features (tenant_id, feature_key, enabled, quota)
  VALUES
    (v_tenant_id, 'attendance', true, NULL),
    (v_tenant_id, 'billing', true, NULL),
    (v_tenant_id, 'messaging', p_plan != 'basic', CASE WHEN p_plan = 'basic' THEN 100 ELSE NULL END),
    (v_tenant_id, 'analytics', p_plan != 'basic', NULL);

  -- 5. 기본 매장(Store) 생성 (선택적)
  -- ⚠️ 주의: core_regions에 기본 region이 없으면 생성하지 않음
  -- 기본 region은 별도 마이그레이션으로 관리하거나, 사용자가 매장 생성 시 입력하도록 함
  -- 현재는 매장 생성 로직을 제외 (사용자가 필요 시 수동 생성)
  -- TODO: 기본 region 마이그레이션 추가 후 기본 매장 자동 생성 로직 구현

  -- 6. 소유자 역할 할당
  INSERT INTO public.user_tenant_roles (user_id, tenant_id, role)
  VALUES (p_owner_user_id, v_tenant_id, 'owner')
  RETURNING jsonb_build_object(
    'id', id,
    'user_id', user_id,
    'tenant_id', tenant_id,
    'role', role,
    'created_at', created_at,
    'updated_at', updated_at
  ) INTO v_user_tenant_role;

  -- 6. 테넌트 정보 조회
  SELECT jsonb_build_object(
    'id', id,
    'name', name,
    'industry_type', industry_type,
    'plan', plan,
    'status', status,
    'created_at', created_at,
    'updated_at', updated_at
  ) INTO v_tenant
  FROM public.tenants
  WHERE id = v_tenant_id;

  -- 결과 반환
  RETURN jsonb_build_object(
    'tenant', v_tenant,
    'user_tenant_role', v_user_tenant_role
  );
END;
$$;

-- RPC 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION create_tenant_with_onboarding TO authenticated;

-- 기존 테넌트에 기본 정책 추가 (config가 없거나 auto_notification이 없는 경우만)
-- ⚠️ 주의: 기존 설정을 덮어쓰지 않도록 jsonb_set을 사용하여 병합
DO $$
DECLARE
  v_tenant_record RECORD;
  v_default_config jsonb;
  v_current_config jsonb;
  v_updated_config jsonb;
  v_event_type text;
BEGIN
  -- 기본 자동화 정책 구조 (Low-Risk는 enabled: true, Medium/High-Risk는 enabled: false)
  -- ⚠️ 주의: 기존 테넌트의 설정값은 보존하며, 누락된 필드만 기본값으로 추가됩니다
  v_default_config := jsonb_build_object(
    -- AI 승인 자동화 설정 (Phase 2)
    'automation_approval', jsonb_build_object(
      'auto_approve_enabled', true,
      'auto_approve_threshold', 'medium'
    ),
    -- 키오스크 출석 체크 설정 (Phase 4)
    'kiosk', jsonb_build_object(
      'enabled', true,
      'check_in_method', 'phone_only',
      'auto_notify_guardian', true,
      'notification_channel', 'kakao_at',
      'notification_template', '${student_name} 학생이 ${time}에 출석했습니다.'
    ),
    'auto_notification', jsonb_build_object(
      'payment_due_reminder', jsonb_build_object('enabled', false, 'channel', 'sms', 'days_before_first', 3, 'days_before_second', 1),
      'invoice_partial_balance', jsonb_build_object('enabled', false, 'channel', 'sms'),
      'recurring_payment_failed', jsonb_build_object('enabled', false, 'channel', 'sms'),
      'revenue_target_under', jsonb_build_object('enabled', true, 'monthly_target', 5000000),
      'collection_rate_drop', jsonb_build_object('enabled', true, 'threshold', 0.7),
      'overdue_outstanding_over_limit', jsonb_build_object('enabled', false, 'channel', 'sms', 'limit_amount', 1000000),
      'revenue_required_per_day', jsonb_build_object('enabled', true, 'monthly_target', 5000000),
      'top_overdue_customers_digest', jsonb_build_object('enabled', true),
      'refund_spike', jsonb_build_object('enabled', true, 'threshold', 3),
      'monthly_business_report', jsonb_build_object('enabled', true, 'report_day', 1),
      'class_fill_rate_low_persistent', jsonb_build_object('enabled', true, 'threshold', 0.5, 'persistent_days', 7),
      'ai_suggest_class_merge', jsonb_build_object('enabled', true),
      'time_slot_fill_rate_low', jsonb_build_object('enabled', true, 'threshold', 0.4),
      'high_fill_rate_expand_candidate', jsonb_build_object('enabled', true, 'threshold', 0.9),
      'unused_class_persistent', jsonb_build_object('enabled', true, 'persistent_days', 14),
      'weekly_ops_summary', jsonb_build_object('enabled', true, 'report_day_of_week', 1),
      'class_reminder_today', jsonb_build_object('enabled', false, 'channel', 'kakao_at', 'send_time', '08:00'),
      'class_schedule_tomorrow', jsonb_build_object('enabled', false, 'channel', 'kakao_at', 'send_time', '19:00'),
      'consultation_reminder', jsonb_build_object('enabled', false, 'channel', 'sms', 'hours_before', 24),
      'absence_first_day', jsonb_build_object('enabled', false, 'channel', 'sms'),
      'churn_increase', jsonb_build_object('enabled', true, 'threshold', 0.15),
      'ai_suggest_churn_focus', jsonb_build_object('enabled', true),
      'attendance_rate_drop_weekly', jsonb_build_object('enabled', true, 'threshold', 0.7),
      'risk_students_weekly_kpi', jsonb_build_object('enabled', true),
      'new_member_drop', jsonb_build_object('enabled', true, 'threshold', 0.3),
      'inquiry_conversion_drop', jsonb_build_object('enabled', false, 'threshold', 0.3),
      'birthday_greeting', jsonb_build_object('enabled', true, 'channel', 'kakao_at'),
      'enrollment_anniversary', jsonb_build_object('enabled', true, 'channel', 'kakao_at'),
      'regional_underperformance', jsonb_build_object('enabled', true, 'threshold', 0.3),
      'regional_rank_drop', jsonb_build_object('enabled', true, 'threshold', 3),
      'class_change_or_cancel', jsonb_build_object('enabled', false, 'channel', 'kakao_at'),
      'checkin_reminder', jsonb_build_object('enabled', false, 'channel', 'sms', 'minutes_before', 30),
      'checkout_missing_alert', jsonb_build_object('enabled', false, 'channel', 'sms', 'hours_after', 2),
      'announcement_urgent', jsonb_build_object('enabled', false, 'channel', 'sms'),
      'announcement_digest', jsonb_build_object('enabled', true, 'digest_period', 'weekly'),
      'consultation_summary_ready', jsonb_build_object('enabled', true, 'min_length', 50),
      'attendance_pattern_anomaly', jsonb_build_object('enabled', false, 'channel', 'sms', 'threshold', 3, 'priority', 90, 'ttl_days', 7, 'throttle', jsonb_build_object('daily_limit', 20)),
      'teacher_workload_imbalance', jsonb_build_object('enabled', true, 'threshold', 1.5),
      'staff_absence_schedule_risk', jsonb_build_object('enabled', false)
    )
  );

  -- 모든 테넌트에 대해 처리
  FOR v_tenant_record IN SELECT id FROM public.tenants LOOP
    -- 현재 config 조회
    SELECT value INTO v_current_config
    FROM public.tenant_settings
    WHERE tenant_id = v_tenant_record.id AND key = 'config';

    -- config가 없거나 auto_notification이 없는 경우
    IF v_current_config IS NULL OR v_current_config->'auto_notification' IS NULL THEN
      -- 기본 config가 없으면 생성, 있으면 auto_notification만 병합
      IF v_current_config IS NULL THEN
        v_updated_config := v_default_config;
      ELSE
        v_updated_config := v_current_config || v_default_config;
      END IF;

      -- 업데이트 또는 삽입
      INSERT INTO public.tenant_settings (tenant_id, key, value)
      VALUES (v_tenant_record.id, 'config', v_updated_config)
      ON CONFLICT (tenant_id, key) DO UPDATE
      SET value = v_updated_config;
    ELSE
      -- 기존 auto_notification이 있는 경우, 각 이벤트 타입별로 기본값 병합
      v_updated_config := v_current_config;
      -- 각 이벤트 타입에 대해 기본값 병합 (기존 값이 있으면 유지, 없으면 기본값 추가)
      FOR v_event_type IN SELECT jsonb_object_keys(v_default_config->'auto_notification')::text LOOP
        IF v_updated_config->'auto_notification'->v_event_type IS NULL THEN
          -- 이벤트 타입이 없으면 기본값 추가
          v_updated_config := jsonb_set(
            v_updated_config,
            ARRAY['auto_notification', v_event_type],
            v_default_config->'auto_notification'->v_event_type
          );
        ELSE
          -- 이벤트 타입이 있으면, 누락된 필드만 기본값으로 병합
          -- JSONB 병합 연산자 ||: 오른쪽 값이 왼쪽 값을 덮어씁니다
          -- 기본값을 왼쪽에 두고 기존 값을 오른쪽에 두면, 기존 값이 있으면 유지되고 없으면 기본값이 사용됩니다
          v_updated_config := jsonb_set(
            v_updated_config,
            ARRAY['auto_notification', v_event_type],
            (v_default_config->'auto_notification'->v_event_type) || (v_updated_config->'auto_notification'->v_event_type),
            true
          );
        END IF;
      END LOOP;

      -- 업데이트
      UPDATE public.tenant_settings
      SET value = v_updated_config
      WHERE tenant_id = v_tenant_record.id AND key = 'config';
    END IF;
  END LOOP;
END $$;

