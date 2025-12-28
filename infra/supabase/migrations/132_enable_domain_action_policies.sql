-- Migration: Enable Domain Action Policies
-- Description: 모든 Domain Action에 대한 기본 정책 경로를 tenant_settings에 활성화
-- Date: 2024-01-XX

-- Domain Action Catalog의 모든 action_key에 대해 기본 정책 경로 생성
-- 정책 경로 형식: domain_action.<action_key>.enabled
-- 저장 위치: tenant_settings(key='config').value(JSONB) 내부 경로

-- ⚠️ 주의: 이 마이그레이션은 모든 테넌트에 기본값(true)을 설정합니다.
-- 개별 테넌트별로 정책을 조정하려면 이후에 tenant_settings를 직접 수정하세요.

DO $$
DECLARE
  action_key text;
  action_keys text[] := ARRAY[
    -- attendance (4)
    'attendance.correct_record',
    'attendance.mark_excused',
    'attendance.bulk_update',
    'attendance.schedule_recheck',
    -- billing (9)
    'billing.issue_invoices',
    'billing.reissue_invoice',
    'billing.record_manual_payment',
    'billing.apply_discount',
    'billing.apply_refund',
    'billing.create_installment_plan',
    'billing.fix_duplicate_invoices',
    'billing.sync_gateway',
    'billing.close_month',
    -- message (3)
    'message.cancel_scheduled',
    'message.create_template',
    'message.update_template',
    -- student (12)
    'student.register',
    'student.update_profile',
    'student.change_class',
    'student.pause',
    'student.resume',
    'student.discharge',
    'student.merge_duplicates',
    'student.update_guardian_contact',
    'student.assign_tags',
    'student.bulk_register',
    'student.bulk_update',
    'student.data_quality_apply_fix',
    'student.reactivate_from_discharged',
    -- class (4)
    'class.create',
    'class.update',
    'class.close',
    'class.bulk_reassign_teacher',
    -- schedule (4)
    'schedule.add_session',
    'schedule.move_session',
    'schedule.cancel_session',
    'schedule.bulk_shift',
    -- note (2)
    'note.create',
    'note.update',
    -- report (2)
    'report.generate_monthly_report',
    'report.generate_daily_brief',
    -- policy (3)
    'policy.enable_automation',
    'policy.update_threshold',
    'rbac.assign_role',
    -- system (4)
    'system.run_healthcheck',
    'system.rebuild_search_index',
    'system.backfill_reports',
    'system.retry_failed_actions'
  ];
  v_config jsonb;
  v_tenant_id uuid;
BEGIN
  -- 모든 테넌트에 대해 Domain Action 정책 경로 설정
  FOR v_tenant_id IN SELECT id FROM public.tenants
  LOOP
    -- key='config'인 row의 value(JSONB) 가져오기
    SELECT COALESCE(value, '{}'::jsonb) INTO v_config
    FROM public.tenant_settings
    WHERE tenant_id = v_tenant_id AND key = 'config';

    -- config row가 없으면 생성
    IF v_config IS NULL THEN
      v_config := '{}'::jsonb;
      INSERT INTO public.tenant_settings (tenant_id, key, value)
      VALUES (v_tenant_id, 'config', v_config)
      ON CONFLICT (tenant_id, key) DO NOTHING;
    END IF;

    -- 각 action_key에 대해 정책 경로 설정
    FOREACH action_key IN ARRAY action_keys
    LOOP
      -- domain_action.<action_key>.enabled 경로에 true 설정
      v_config := jsonb_set(
        v_config,
        ARRAY['domain_action', action_key, 'enabled'],
        'true'::jsonb,
        true  -- create_missing = true
      );
    END LOOP;

    -- 업데이트된 config 저장
    UPDATE public.tenant_settings
    SET value = v_config,
        updated_at = NOW()
    WHERE tenant_id = v_tenant_id AND key = 'config';

    RAISE NOTICE '테넌트 %에 Domain Action 정책 경로 설정 완료', v_tenant_id;
  END LOOP;

  RAISE NOTICE '총 %개의 Domain Action 정책 경로가 모든 테넌트에 설정되었습니다.', array_length(action_keys, 1);
END $$;

