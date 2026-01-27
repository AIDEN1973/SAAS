-- ============================================================================
-- 기본 필터 태그 시드 함수
-- 신규 테넌트 생성 시 자동으로 기본 태그를 생성하는 함수
-- ============================================================================

-- 기본 태그 시드 함수
CREATE OR REPLACE FUNCTION seed_default_filter_tags_for_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO message_filter_tags (tenant_id, name, display_label, category, condition_type, condition_params, color, sort_order, is_system_default)
  VALUES
    -- ============================================================================
    -- 출석 기반 태그 (8개)
    -- ============================================================================
    (NEW.id, '3일 연속 지각', '#3일 연속 지각', 'attendance', 'attendance.consecutive_late_3days', '{"days": 3, "period": "30days"}'::jsonb, '#FFC107', 1, true),
    (NEW.id, '1주일 내 3회 결석', '#1주일 내 3회 결석', 'attendance', 'attendance.absent_3times_in_week', '{"count": 3, "period": "7days"}'::jsonb, '#FF6B6B', 2, true),
    (NEW.id, '출석률 70% 미만 30일', '#출석률 70% 미만 30일', 'attendance', 'attendance.low_attendance_rate', '{"rate": 0.7, "period": "30days"}'::jsonb, '#FF8787', 3, true),
    (NEW.id, '30일 개근', '#30일 개근', 'attendance', 'attendance.perfect_attendance', '{"period": "30days"}'::jsonb, '#51CF66', 5, true),
    (NEW.id, '지각 잦은 회원 7일', '#지각 잦은 회원 7일', 'attendance', 'attendance.frequent_late', '{"count": 3, "period": "7days"}'::jsonb, '#FFD43B', 6, true),
    (NEW.id, '30일 미방문', '#30일 미방문', 'attendance', 'attendance.no_visit', '{"days": 30}'::jsonb, '#ADB5BD', 8, true),

    -- ============================================================================
    -- 결제/청구 기반 태그 (7개)
    -- ============================================================================
    (NEW.id, '미납 회원', '#미납 회원', 'billing', 'billing.has_overdue_invoices', '{}'::jsonb, '#F03E3E', 10, true),
    (NEW.id, '2개월 이상 미납', '#2개월 이상 미납', 'billing', 'billing.overdue_long_term', '{"months": 2}'::jsonb, '#C92A2A', 11, true),
    (NEW.id, '결제 예정일 3일 이내', '#결제 예정일 3일 이내', 'billing', 'billing.payment_due_soon', '{"days": 3}'::jsonb, '#FAB005', 12, true),
    (NEW.id, '결제 3회 이상 실패', '#결제 3회 이상 실패', 'billing', 'billing.payment_failed_multiple', '{"min_failures": 3}'::jsonb, '#E03131', 15, true),

    -- ============================================================================
    -- 등록 상태 태그 (3개)
    -- ============================================================================
    (NEW.id, '신규 회원 30일', '#신규 회원 30일', 'enrollment', 'enrollment.new_student_30days', '{"days": 30}'::jsonb, '#4DABF7', 20, true),
    (NEW.id, '활성 수업 없음', '#활성 수업 없음', 'enrollment', 'class.no_active_class', '{}'::jsonb, '#CED4DA', 21, true),

    -- ============================================================================
    -- 학적 정보 태그 (5개)
    -- ============================================================================
    (NEW.id, '초등학생', '#초등학생', 'academic', 'academic.grade_filter', '{"grades": ["초등 1학년","초등 2학년","초등 3학년","초등 4학년","초등 5학년","초등 6학년"]}'::jsonb, '#74C0FC', 30, true),
    (NEW.id, '중학생', '#중학생', 'academic', 'academic.grade_filter', '{"grades": ["중 1학년","중 2학년","중 3학년"]}'::jsonb, '#A9E34B', 31, true),
    (NEW.id, '이번 달 생일', '#이번 달 생일', 'academic', 'academic.birthday_this_month', '{}'::jsonb, '#FF6B6B', 32, true),
    (NEW.id, '7-10세', '#7-10세', 'academic', 'academic.age_range', '{"min": 7, "max": 10}'::jsonb, '#FFD43B', 33, true),
    (NEW.id, '11-14세', '#11-14세', 'academic', 'academic.age_range', '{"min": 11, "max": 14}'::jsonb, '#FFA94D', 34, true),

    -- ============================================================================
    -- 회원 상태 기반 태그 (3개)
    -- ============================================================================
    (NEW.id, '퇴원 회원', '#퇴원 회원', 'status', 'status.withdrawn', '{}'::jsonb, '#868E96', 60, true),
    (NEW.id, '남학생', '#남학생', 'status', 'status.gender_filter', '{"gender": "male"}'::jsonb, '#339AF0', 61, true),
    (NEW.id, '여학생', '#여학생', 'status', 'status.gender_filter', '{"gender": "female"}'::jsonb, '#F06595', 62, true),

    -- ============================================================================
    -- 수업 기반 태그 (2개)
    -- ============================================================================
    (NEW.id, '최근 등록 7일', '#최근 등록 7일', 'class', 'class.recently_enrolled', '{"days": 7}'::jsonb, '#66D9E8', 52, true);

  RETURN NEW;
END;
$$;

-- 테넌트 생성 트리거 등록 (기존 트리거가 있다면 교체)
DROP TRIGGER IF EXISTS trigger_seed_default_filter_tags ON tenants;

CREATE TRIGGER trigger_seed_default_filter_tags
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION seed_default_filter_tags_for_tenant();

-- ============================================================================
-- 기존 테넌트에 대한 기본 태그 시드 (일회성 실행)
-- ============================================================================
DO $$
DECLARE
  v_tenant_record RECORD;
BEGIN
  FOR v_tenant_record IN SELECT id FROM tenants WHERE id NOT IN (SELECT DISTINCT tenant_id FROM message_filter_tags)
  LOOP
    INSERT INTO message_filter_tags (tenant_id, name, display_label, category, condition_type, condition_params, color, sort_order, is_system_default)
    VALUES
      -- 출석 기반 태그
      (v_tenant_record.id, '3일 연속 지각', '#3일 연속 지각', 'attendance', 'attendance.consecutive_late_3days', '{"days": 3, "period": "30days"}'::jsonb, '#FFC107', 1, true),
      (v_tenant_record.id, '1주일 내 3회 결석', '#1주일 내 3회 결석', 'attendance', 'attendance.absent_3times_in_week', '{"count": 3, "period": "7days"}'::jsonb, '#FF6B6B', 2, true),
      (v_tenant_record.id, '출석률 70% 미만 30일', '#출석률 70% 미만 30일', 'attendance', 'attendance.low_attendance_rate', '{"rate": 0.7, "period": "30days"}'::jsonb, '#FF8787', 3, true),
      (v_tenant_record.id, '30일 개근', '#30일 개근', 'attendance', 'attendance.perfect_attendance', '{"period": "30days"}'::jsonb, '#51CF66', 5, true),
      (v_tenant_record.id, '지각 잦은 회원 7일', '#지각 잦은 회원 7일', 'attendance', 'attendance.frequent_late', '{"count": 3, "period": "7days"}'::jsonb, '#FFD43B', 6, true),
      (v_tenant_record.id, '30일 미방문', '#30일 미방문', 'attendance', 'attendance.no_visit', '{"days": 30}'::jsonb, '#ADB5BD', 8, true),
      -- 결제/청구 기반 태그
      (v_tenant_record.id, '미납 회원', '#미납 회원', 'billing', 'billing.has_overdue_invoices', '{}'::jsonb, '#F03E3E', 10, true),
      (v_tenant_record.id, '2개월 이상 미납', '#2개월 이상 미납', 'billing', 'billing.overdue_long_term', '{"months": 2}'::jsonb, '#C92A2A', 11, true),
      (v_tenant_record.id, '결제 예정일 3일 이내', '#결제 예정일 3일 이내', 'billing', 'billing.payment_due_soon', '{"days": 3}'::jsonb, '#FAB005', 12, true),
      (v_tenant_record.id, '결제 3회 이상 실패', '#결제 3회 이상 실패', 'billing', 'billing.payment_failed_multiple', '{"min_failures": 3}'::jsonb, '#E03131', 15, true),
      -- 등록 상태 태그
      (v_tenant_record.id, '신규 회원 30일', '#신규 회원 30일', 'enrollment', 'enrollment.new_student_30days', '{"days": 30}'::jsonb, '#4DABF7', 20, true),
      (v_tenant_record.id, '활성 수업 없음', '#활성 수업 없음', 'enrollment', 'class.no_active_class', '{}'::jsonb, '#CED4DA', 21, true),
      -- 학적 정보 태그
      (v_tenant_record.id, '초등학생', '#초등학생', 'academic', 'academic.grade_filter', '{"grades": ["초등 1학년","초등 2학년","초등 3학년","초등 4학년","초등 5학년","초등 6학년"]}'::jsonb, '#74C0FC', 30, true),
      (v_tenant_record.id, '중학생', '#중학생', 'academic', 'academic.grade_filter', '{"grades": ["중 1학년","중 2학년","중 3학년"]}'::jsonb, '#A9E34B', 31, true),
      (v_tenant_record.id, '이번 달 생일', '#이번 달 생일', 'academic', 'academic.birthday_this_month', '{}'::jsonb, '#FF6B6B', 32, true),
      (v_tenant_record.id, '7-10세', '#7-10세', 'academic', 'academic.age_range', '{"min": 7, "max": 10}'::jsonb, '#FFD43B', 33, true),
      (v_tenant_record.id, '11-14세', '#11-14세', 'academic', 'academic.age_range', '{"min": 11, "max": 14}'::jsonb, '#FFA94D', 34, true),
      -- 회원 상태 기반 태그
      (v_tenant_record.id, '퇴원 회원', '#퇴원 회원', 'status', 'status.withdrawn', '{}'::jsonb, '#868E96', 60, true),
      (v_tenant_record.id, '남학생', '#남학생', 'status', 'status.gender_filter', '{"gender": "male"}'::jsonb, '#339AF0', 61, true),
      (v_tenant_record.id, '여학생', '#여학생', 'status', 'status.gender_filter', '{"gender": "female"}'::jsonb, '#F06595', 62, true),
      -- 수업 기반 태그
      (v_tenant_record.id, '최근 등록 7일', '#최근 등록 7일', 'class', 'class.recently_enrolled', '{"days": 7}'::jsonb, '#66D9E8', 52, true)
    ON CONFLICT (tenant_id, name) DO NOTHING;
  END LOOP;
END;
$$;
