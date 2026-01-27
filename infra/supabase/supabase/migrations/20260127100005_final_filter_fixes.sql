-- ============================================================================
-- 필터 시스템 최종 수정 (모든 38개 필터 테스트 완료)
-- 날짜: 2026-01-27
-- 수정 내역:
-- 1. filter_no_payment_history_students - payments.student_id 조인 수정
-- 2. filter_inactive_30days_students - payments.student_id 조인 수정
-- 3. apply_filter_tag - 컬럼명 불일치 3건 수정
-- ============================================================================

-- 1. filter_no_payment_history_students 수정
CREATE OR REPLACE FUNCTION filter_no_payment_history_students(
  p_tenant_id UUID
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS student_id,
    s.name AS student_name,
    COALESCE(s.phone, s.mother_phone, s.father_phone) AS phone
  FROM students s
  WHERE s.tenant_id = p_tenant_id
    AND s.status = 'active'
    AND NOT EXISTS (
      SELECT 1
      FROM invoices i
      INNER JOIN payments p ON p.invoice_id = i.id AND p.tenant_id = i.tenant_id
      WHERE i.student_id = s.id
        AND i.tenant_id = s.tenant_id
        AND p.status = 'paid'
    )
  ORDER BY s.name;
END;
$$;

-- 2. filter_inactive_30days_students 수정
CREATE OR REPLACE FUNCTION filter_inactive_30days_students(
  p_tenant_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  phone TEXT,
  last_activity_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH last_attendance AS (
    SELECT
      al.student_id,
      MAX(DATE(al.occurred_at AT TIME ZONE 'Asia/Seoul')) AS last_visit
    FROM attendance_logs al
    WHERE al.tenant_id = p_tenant_id
    GROUP BY al.student_id
  ),
  last_payment AS (
    SELECT
      i.student_id,
      MAX(DATE(p.paid_at AT TIME ZONE 'Asia/Seoul')) AS last_paid
    FROM invoices i
    INNER JOIN payments p ON p.invoice_id = i.id AND p.tenant_id = i.tenant_id
    WHERE i.tenant_id = p_tenant_id
      AND p.status = 'paid'
    GROUP BY i.student_id
  )
  SELECT
    s.id AS student_id,
    s.name AS student_name,
    COALESCE(s.phone, s.mother_phone, s.father_phone) AS phone,
    GREATEST(
      COALESCE(la.last_visit, DATE('1900-01-01')),
      COALESCE(lp.last_paid, DATE('1900-01-01'))
    ) AS last_activity_date
  FROM students s
  LEFT JOIN last_attendance la ON la.student_id = s.id
  LEFT JOIN last_payment lp ON lp.student_id = s.id
  WHERE s.tenant_id = p_tenant_id
    AND s.status = 'active'
    AND (
      (la.last_visit IS NULL AND lp.last_paid IS NULL)
      OR GREATEST(
        COALESCE(la.last_visit, DATE('1900-01-01')),
        COALESCE(lp.last_paid, DATE('1900-01-01'))
      ) < CURRENT_DATE - (p_days || ' days')::INTERVAL
    )
  ORDER BY last_activity_date ASC;
END;
$$;

-- 3. apply_filter_tag 함수 최종 수정 (컬럼명 불일치 수정)
CREATE OR REPLACE FUNCTION apply_filter_tag(
  p_tenant_id TEXT,
  p_tag_id TEXT
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  phone TEXT,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_uuid UUID;
  v_tag_uuid UUID;
  v_condition_type TEXT;
  v_condition_params JSONB;
BEGIN
  BEGIN
    v_tenant_uuid := p_tenant_id::uuid;
    v_tag_uuid := p_tag_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;

  SELECT condition_type, condition_params
  INTO v_condition_type, v_condition_params
  FROM message_filter_tags
  WHERE id = v_tag_uuid
    AND tenant_id = v_tenant_uuid
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  CASE v_condition_type
    WHEN 'attendance.consecutive_late_3days' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('late_days', f.late_days) AS metadata
      FROM filter_consecutive_late_students(v_tenant_uuid, COALESCE((v_condition_params->>'days')::INTEGER, 3), COALESCE(v_condition_params->>'period', '30days')) f;

    WHEN 'attendance.absent_3times_in_week' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('absent_count', f.absent_count) AS metadata
      FROM filter_absent_students(v_tenant_uuid, COALESCE((v_condition_params->>'count')::INTEGER, 3), COALESCE(v_condition_params->>'period', '7days')) f;

    WHEN 'attendance.low_attendance_rate' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('attendance_rate', f.attendance_rate) AS metadata
      FROM filter_low_attendance_rate_students(v_tenant_uuid, COALESCE((v_condition_params->>'rate')::NUMERIC, 0.7), COALESCE(v_condition_params->>'period', '30days')) f;

    WHEN 'attendance.missing_checkin_today' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone, '{}'::jsonb AS metadata
      FROM filter_missing_checkin_today_students(v_tenant_uuid) f;

    WHEN 'attendance.perfect_attendance' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('attendance_count', f.attendance_count) AS metadata
      FROM filter_perfect_attendance_students(v_tenant_uuid, COALESCE(v_condition_params->>'period', '30days')) f;

    WHEN 'attendance.frequent_late' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('late_count', f.late_count) AS metadata
      FROM filter_frequent_late_students(v_tenant_uuid, COALESCE((v_condition_params->>'count')::INTEGER, 3), COALESCE(v_condition_params->>'period', '7days')) f;

    WHEN 'attendance.unexcused_absent' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('absent_count', f.absent_count) AS metadata
      FROM filter_unexcused_absent_students(v_tenant_uuid, COALESCE(v_condition_params->>'period', '7days')) f;

    WHEN 'attendance.no_visit' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('last_visit_date', f.last_visit_date) AS metadata
      FROM filter_no_visit_students(v_tenant_uuid, COALESCE((v_condition_params->>'days')::INTEGER, 30)) f;

    WHEN 'billing.has_overdue_invoices' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('overdue_amount', f.overdue_amount, 'overdue_count', f.overdue_count) AS metadata
      FROM filter_overdue_students(v_tenant_uuid) f;

    WHEN 'billing.overdue_long_term' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('overdue_amount', f.overdue_amount, 'oldest_due_date', f.oldest_due_date) AS metadata
      FROM filter_overdue_long_term_students(v_tenant_uuid, COALESCE((v_condition_params->>'months')::INTEGER, 2)) f;

    WHEN 'billing.payment_due_soon' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('due_date', f.due_date, 'amount_due', f.amount_due) AS metadata
      FROM filter_payment_due_soon_students(v_tenant_uuid, COALESCE((v_condition_params->>'days')::INTEGER, 3)) f;

    WHEN 'billing.overdue_amount_threshold' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('overdue_amount', f.overdue_amount) AS metadata
      FROM filter_overdue_amount_threshold_students(v_tenant_uuid, COALESCE((v_condition_params->>'amount')::NUMERIC, 100000)) f;

    WHEN 'billing.no_payment_history' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone, '{}'::jsonb AS metadata
      FROM filter_no_payment_history_students(v_tenant_uuid) f;

    WHEN 'billing.autopay_failed' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('failed_count', f.failed_count) AS metadata
      FROM filter_autopay_failed_students(v_tenant_uuid, COALESCE(v_condition_params->>'period', '7days')) f;

    WHEN 'billing.paid_this_month' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('paid_amount', f.paid_amount) AS metadata
      FROM filter_paid_this_month_students(v_tenant_uuid) f;

    WHEN 'billing.payment_failed_multiple' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('failed_count', f.failed_count) AS metadata
      FROM filter_payment_failed_multiple_students(v_tenant_uuid, COALESCE((v_condition_params->>'min_failures')::INTEGER, 3)) f;

    WHEN 'billing.recent_payment' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('last_payment_date', f.last_payment_date) AS metadata
      FROM filter_recent_payment_students(v_tenant_uuid, COALESCE((v_condition_params->>'days')::INTEGER, 7)) f;

    WHEN 'billing.high_value_customer' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('total_paid', f.total_paid) AS metadata
      FROM filter_high_value_customer_students(v_tenant_uuid, COALESCE((v_condition_params->>'min_amount')::NUMERIC, 500000), COALESCE(v_condition_params->>'period', '90days')) f;

    WHEN 'enrollment.new_student_30days' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('enrolled_at', f.enrolled_at) AS metadata
      FROM filter_new_students(v_tenant_uuid, COALESCE((v_condition_params->>'days')::INTEGER, 30)) f;

    WHEN 'enrollment.no_active_classes' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone, '{}'::jsonb AS metadata
      FROM filter_students_no_active_class(v_tenant_uuid) f;

    WHEN 'enrollment.on_leave' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone, '{}'::jsonb AS metadata
      FROM filter_on_leave_students(v_tenant_uuid) f;

    WHEN 'enrollment.renewal_due_1year' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('enrolled_years', f.enrolled_years) AS metadata
      FROM filter_renewal_due_1year_students(v_tenant_uuid) f;

    WHEN 'enrollment.multiple_classes' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('class_count', f.class_count) AS metadata
      FROM filter_multiple_classes_students(v_tenant_uuid, COALESCE((v_condition_params->>'count')::INTEGER, 2)) f;

    WHEN 'enrollment.single_class_only' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('class_name', f.class_name) AS metadata
      FROM filter_single_class_only_students(v_tenant_uuid) f;

    WHEN 'academic.grade_filter' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('grade', f.grade) AS metadata
      FROM filter_students_by_grade(v_tenant_uuid, ARRAY(SELECT jsonb_array_elements_text(v_condition_params->'grades'))) f;

    WHEN 'academic.birthday_this_month' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('birthday', f.birthday) AS metadata
      FROM filter_birthday_this_month_students(v_tenant_uuid) f;

    WHEN 'academic.age_range' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('age', f.age) AS metadata
      FROM filter_students_by_age_range(v_tenant_uuid, COALESCE((v_condition_params->>'min')::INTEGER, 0), COALESCE((v_condition_params->>'max')::INTEGER, 100)) f;

    WHEN 'combined.churn_risk_high' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('attendance_rate', f.attendance_rate, 'has_overdue', f.has_overdue) AS metadata
      FROM filter_churn_risk_high_students(v_tenant_uuid, COALESCE((v_condition_params->>'attendance_rate')::NUMERIC, 0.7), COALESCE((v_condition_params->>'overdue')::BOOLEAN, true)) f;

    WHEN 'combined.vip_students' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('attendance_rate', f.attendance_rate, 'is_payment_good', f.is_payment_good) AS metadata
      FROM filter_vip_students(v_tenant_uuid, COALESCE((v_condition_params->>'attendance_rate')::NUMERIC, 0.9), COALESCE((v_condition_params->>'payment_on_time')::BOOLEAN, true)) f;

    WHEN 'combined.needs_attention' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('late_count', f.late_count, 'absent_count', f.absent_count) AS metadata
      FROM filter_needs_attention_students(v_tenant_uuid, COALESCE((v_condition_params->>'late_count')::INTEGER, 3), COALESCE((v_condition_params->>'absent_count')::INTEGER, 2)) f;

    WHEN 'combined.inactive_30days' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('last_activity_date', f.last_activity_date) AS metadata
      FROM filter_inactive_30days_students(v_tenant_uuid, COALESCE((v_condition_params->>'days')::INTEGER, 30)) f;

    WHEN 'class.specific_class' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('class_name', f.class_name) AS metadata
      FROM filter_students_by_class(v_tenant_uuid, (v_condition_params->>'class_id')::UUID) f;

    WHEN 'class.specific_subject' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('subject', f.subject) AS metadata
      FROM filter_students_by_subject(v_tenant_uuid, v_condition_params->>'subject') f;

    WHEN 'class.recently_enrolled' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('enrolled_at', f.enrolled_at) AS metadata
      FROM filter_recently_enrolled_students(v_tenant_uuid, COALESCE((v_condition_params->>'days')::INTEGER, 7)) f;

    WHEN 'class.about_to_leave' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('end_date', f.end_date) AS metadata
      FROM filter_about_to_leave_students(v_tenant_uuid, COALESCE((v_condition_params->>'days')::INTEGER, 7)) f;

    WHEN 'class.no_active_class' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone, '{}'::jsonb AS metadata
      FROM filter_students_no_active_class(v_tenant_uuid) f;

    WHEN 'status.withdrawn' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('withdrawn_at', f.withdrawn_at) AS metadata
      FROM filter_withdrawn_students(v_tenant_uuid) f;

    WHEN 'status.gender_filter' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('gender', f.gender) AS metadata
      FROM filter_students_by_gender(v_tenant_uuid, v_condition_params->>'gender') f;

    WHEN 'status.school_filter' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('school_name', f.school_name) AS metadata
      FROM filter_students_by_school(v_tenant_uuid, v_condition_params->>'school_name') f;

    ELSE
      RAISE NOTICE 'Unknown condition type: %', v_condition_type;
      RETURN;
  END CASE;

  UPDATE message_filter_tags
  SET usage_count = usage_count + 1
  WHERE id = v_tag_uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION apply_filter_tag(TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 검증 완료: 38개 모든 필터 테스트 통과 ✅
-- ============================================================================
