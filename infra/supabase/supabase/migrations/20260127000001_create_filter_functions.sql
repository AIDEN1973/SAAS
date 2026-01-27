-- ============================================================================
-- 메시지 필터 태그 PostgreSQL 함수 생성
-- 회원 필터링 로직을 위한 서버 사이드 함수
-- ============================================================================

-- ============================================================================
-- 1. 연속 지각 학생 필터링
-- ============================================================================
CREATE OR REPLACE FUNCTION filter_consecutive_late_students(
  p_tenant_id UUID,
  p_days INTEGER DEFAULT 3,
  p_period TEXT DEFAULT '30days'
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  phone TEXT,
  late_days INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_interval INTERVAL;
BEGIN
  v_interval := CASE p_period
    WHEN '7days' THEN INTERVAL '7 days'
    WHEN '30days' THEN INTERVAL '30 days'
    WHEN '90days' THEN INTERVAL '90 days'
    ELSE INTERVAL '30 days'
  END;

  RETURN QUERY
  WITH late_dates AS (
    SELECT
      al.student_id,
      DATE(al.occurred_at AT TIME ZONE 'Asia/Seoul') AS late_date
    FROM attendance_logs al
    WHERE al.tenant_id = p_tenant_id
      AND al.status = 'late'
      AND al.occurred_at >= NOW() - v_interval
    GROUP BY al.student_id, DATE(al.occurred_at AT TIME ZONE 'Asia/Seoul')
  ),
  late_counts AS (
    SELECT
      ld.student_id,
      COUNT(*)::INTEGER AS total_late_days
    FROM late_dates ld
    GROUP BY ld.student_id
    HAVING COUNT(*) >= p_days
  )
  SELECT
    s.id AS student_id,
    s.name AS student_name,
    COALESCE(s.phone, s.mother_phone, s.father_phone) AS phone,
    lc.total_late_days AS late_days
  FROM late_counts lc
  JOIN students s ON s.id = lc.student_id
  WHERE s.tenant_id = p_tenant_id
    AND s.status = 'active'
  ORDER BY lc.total_late_days DESC;
END;
$$;

-- ============================================================================
-- 2. 결석 회원 필터링
-- ============================================================================
CREATE OR REPLACE FUNCTION filter_absent_students(
  p_tenant_id UUID,
  p_count INTEGER DEFAULT 3,
  p_period TEXT DEFAULT '7days'
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  phone TEXT,
  absent_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_interval INTERVAL;
BEGIN
  v_interval := CASE p_period
    WHEN '7days' THEN INTERVAL '7 days'
    WHEN '30days' THEN INTERVAL '30 days'
    WHEN '90days' THEN INTERVAL '90 days'
    ELSE INTERVAL '7 days'
  END;

  RETURN QUERY
  SELECT
    s.id AS student_id,
    s.name AS student_name,
    COALESCE(s.phone, s.mother_phone, s.father_phone) AS phone,
    COUNT(al.id)::INTEGER AS absent_count
  FROM students s
  INNER JOIN attendance_logs al ON al.student_id = s.id AND al.tenant_id = s.tenant_id
  WHERE s.tenant_id = p_tenant_id
    AND al.status = 'absent'
    AND al.occurred_at >= NOW() - v_interval
    AND s.status = 'active'
  GROUP BY s.id, s.name, s.phone, s.mother_phone, s.father_phone
  HAVING COUNT(al.id) >= p_count
  ORDER BY absent_count DESC;
END;
$$;

-- ============================================================================
-- 3. 출석률 기반 필터링
-- ============================================================================
CREATE OR REPLACE FUNCTION filter_low_attendance_rate_students(
  p_tenant_id UUID,
  p_rate NUMERIC DEFAULT 0.7,
  p_period TEXT DEFAULT '30days'
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  phone TEXT,
  attendance_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_interval INTERVAL;
BEGIN
  v_interval := CASE p_period
    WHEN '7days' THEN INTERVAL '7 days'
    WHEN '30days' THEN INTERVAL '30 days'
    WHEN '90days' THEN INTERVAL '90 days'
    ELSE INTERVAL '30 days'
  END;

  RETURN QUERY
  WITH attendance_stats AS (
    SELECT
      al.student_id,
      COUNT(*) AS total_records,
      SUM(CASE WHEN al.status IN ('present', 'late') THEN 1 ELSE 0 END) AS attended
    FROM attendance_logs al
    WHERE al.tenant_id = p_tenant_id
      AND al.occurred_at >= NOW() - v_interval
    GROUP BY al.student_id
  )
  SELECT
    s.id AS student_id,
    s.name AS student_name,
    COALESCE(s.phone, s.mother_phone, s.father_phone) AS phone,
    ROUND((ast.attended::NUMERIC / NULLIF(ast.total_records, 0))::NUMERIC, 2) AS attendance_rate
  FROM attendance_stats ast
  JOIN students s ON s.id = ast.student_id
  WHERE s.tenant_id = p_tenant_id
    AND s.status = 'active'
    AND (ast.attended::NUMERIC / NULLIF(ast.total_records, 0)) < p_rate
  ORDER BY attendance_rate ASC;
END;
$$;

-- ============================================================================
-- 4. 개근 회원 필터링
-- ============================================================================
CREATE OR REPLACE FUNCTION filter_perfect_attendance_students(
  p_tenant_id UUID,
  p_period TEXT DEFAULT '30days'
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  phone TEXT,
  attendance_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_interval INTERVAL;
BEGIN
  v_interval := CASE p_period
    WHEN '7days' THEN INTERVAL '7 days'
    WHEN '30days' THEN INTERVAL '30 days'
    WHEN '90days' THEN INTERVAL '90 days'
    ELSE INTERVAL '30 days'
  END;

  RETURN QUERY
  WITH attendance_stats AS (
    SELECT
      al.student_id,
      COUNT(*) AS total_records,
      SUM(CASE WHEN al.status IN ('present', 'late') THEN 1 ELSE 0 END) AS attended,
      SUM(CASE WHEN al.status = 'absent' THEN 1 ELSE 0 END) AS absent_count
    FROM attendance_logs al
    WHERE al.tenant_id = p_tenant_id
      AND al.occurred_at >= NOW() - v_interval
    GROUP BY al.student_id
    HAVING COUNT(*) >= 5  -- 최소 5회 이상 출석 기록 필요
  )
  SELECT
    s.id AS student_id,
    s.name AS student_name,
    COALESCE(s.phone, s.mother_phone, s.father_phone) AS phone,
    ast.attended::INTEGER AS attendance_count
  FROM attendance_stats ast
  JOIN students s ON s.id = ast.student_id
  WHERE s.tenant_id = p_tenant_id
    AND s.status = 'active'
    AND ast.absent_count = 0
  ORDER BY ast.attended DESC;
END;
$$;

-- ============================================================================
-- 5. 미방문 회원 필터링
-- ============================================================================
CREATE OR REPLACE FUNCTION filter_no_visit_students(
  p_tenant_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  phone TEXT,
  last_visit_date DATE
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
    COALESCE(s.phone, s.mother_phone, s.father_phone) AS phone,
    DATE(MAX(al.occurred_at) AT TIME ZONE 'Asia/Seoul') AS last_visit_date
  FROM students s
  LEFT JOIN attendance_logs al ON al.student_id = s.id AND al.tenant_id = s.tenant_id
    AND al.status IN ('present', 'late')
  WHERE s.tenant_id = p_tenant_id
    AND s.status = 'active'
  GROUP BY s.id, s.name, s.phone, s.mother_phone, s.father_phone
  HAVING MAX(al.occurred_at) IS NULL
    OR MAX(al.occurred_at) < NOW() - (p_days || ' days')::INTERVAL
  ORDER BY last_visit_date ASC NULLS FIRST;
END;
$$;

-- ============================================================================
-- 6. 미납 회원 필터링
-- ============================================================================
CREATE OR REPLACE FUNCTION filter_overdue_students(
  p_tenant_id UUID
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  phone TEXT,
  overdue_amount NUMERIC,
  overdue_count INTEGER
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
    COALESCE(s.phone, s.mother_phone, s.father_phone) AS phone,
    SUM(i.amount_due) AS overdue_amount,
    COUNT(i.id)::INTEGER AS overdue_count
  FROM students s
  INNER JOIN invoices i ON i.student_id = s.id AND i.tenant_id = s.tenant_id
  WHERE s.tenant_id = p_tenant_id
    AND i.status = 'overdue'
    AND s.status = 'active'
  GROUP BY s.id, s.name, s.phone, s.mother_phone, s.father_phone
  ORDER BY overdue_amount DESC;
END;
$$;

-- ============================================================================
-- 7. 장기 미납 회원 필터링
-- ============================================================================
CREATE OR REPLACE FUNCTION filter_overdue_long_term_students(
  p_tenant_id UUID,
  p_months INTEGER DEFAULT 2
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  phone TEXT,
  overdue_amount NUMERIC,
  oldest_overdue_date DATE
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
    COALESCE(s.phone, s.mother_phone, s.father_phone) AS phone,
    SUM(i.amount_due) AS overdue_amount,
    MIN(i.due_date) AS oldest_overdue_date
  FROM students s
  INNER JOIN invoices i ON i.student_id = s.id AND i.tenant_id = s.tenant_id
  WHERE s.tenant_id = p_tenant_id
    AND i.status = 'overdue'
    AND i.due_date < NOW() - (p_months || ' months')::INTERVAL
    AND s.status = 'active'
  GROUP BY s.id, s.name, s.phone, s.mother_phone, s.father_phone
  ORDER BY oldest_overdue_date ASC;
END;
$$;

-- ============================================================================
-- 8. 결제 예정 회원 필터링
-- ============================================================================
CREATE OR REPLACE FUNCTION filter_payment_due_soon_students(
  p_tenant_id UUID,
  p_days INTEGER DEFAULT 3
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  phone TEXT,
  due_date DATE,
  amount_due NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (s.id)
    s.id AS student_id,
    s.name AS student_name,
    COALESCE(s.phone, s.mother_phone, s.father_phone) AS phone,
    i.due_date,
    i.amount_due
  FROM students s
  INNER JOIN invoices i ON i.student_id = s.id AND i.tenant_id = s.tenant_id
  WHERE s.tenant_id = p_tenant_id
    AND i.status = 'pending'
    AND i.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (p_days || ' days')::INTERVAL
    AND s.status = 'active'
  ORDER BY s.id, i.due_date ASC;
END;
$$;

-- ============================================================================
-- 9. 신규 회원 필터링
-- ============================================================================
CREATE OR REPLACE FUNCTION filter_new_students(
  p_tenant_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  phone TEXT,
  created_date DATE
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
    COALESCE(s.phone, s.mother_phone, s.father_phone) AS phone,
    DATE(s.created_at AT TIME ZONE 'Asia/Seoul') AS created_date
  FROM students s
  WHERE s.tenant_id = p_tenant_id
    AND s.created_at >= NOW() - (p_days || ' days')::INTERVAL
    AND s.status = 'active'
  ORDER BY s.created_at DESC;
END;
$$;

-- ============================================================================
-- 10. 학년별 회원 필터링
-- ============================================================================
CREATE OR REPLACE FUNCTION filter_students_by_grade(
  p_tenant_id UUID,
  p_grades TEXT[]
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  phone TEXT,
  grade TEXT
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
    COALESCE(s.phone, s.mother_phone, s.father_phone) AS phone,
    s.grade
  FROM students s
  WHERE s.tenant_id = p_tenant_id
    AND s.grade = ANY(p_grades)
    AND s.status = 'active'
  ORDER BY s.grade, s.name;
END;
$$;

-- ============================================================================
-- 11. 연령대별 회원 필터링
-- ============================================================================
CREATE OR REPLACE FUNCTION filter_students_by_age_range(
  p_tenant_id UUID,
  p_min_age INTEGER,
  p_max_age INTEGER
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  phone TEXT,
  age INTEGER
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
    COALESCE(s.phone, s.mother_phone, s.father_phone) AS phone,
    EXTRACT(YEAR FROM age(CURRENT_DATE, s.birth_date))::INTEGER AS age
  FROM students s
  WHERE s.tenant_id = p_tenant_id
    AND s.birth_date IS NOT NULL
    AND EXTRACT(YEAR FROM age(CURRENT_DATE, s.birth_date)) BETWEEN p_min_age AND p_max_age
    AND s.status = 'active'
  ORDER BY age, s.name;
END;
$$;

-- ============================================================================
-- 12. 이번 달 생일 회원 필터링
-- ============================================================================
CREATE OR REPLACE FUNCTION filter_birthday_this_month_students(
  p_tenant_id UUID
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  phone TEXT,
  birth_date DATE
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
    COALESCE(s.phone, s.mother_phone, s.father_phone) AS phone,
    s.birth_date
  FROM students s
  WHERE s.tenant_id = p_tenant_id
    AND s.birth_date IS NOT NULL
    AND EXTRACT(MONTH FROM s.birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND s.status = 'active'
  ORDER BY EXTRACT(DAY FROM s.birth_date), s.name;
END;
$$;

-- ============================================================================
-- 13. 성별 필터링
-- ============================================================================
CREATE OR REPLACE FUNCTION filter_students_by_gender(
  p_tenant_id UUID,
  p_gender TEXT
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  phone TEXT,
  gender TEXT
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
    COALESCE(s.phone, s.mother_phone, s.father_phone) AS phone,
    s.gender
  FROM students s
  WHERE s.tenant_id = p_tenant_id
    AND s.gender = p_gender
    AND s.status = 'active'
  ORDER BY s.name;
END;
$$;

-- ============================================================================
-- 14. 학교별 필터링
-- ============================================================================
CREATE OR REPLACE FUNCTION filter_students_by_school(
  p_tenant_id UUID,
  p_school_name TEXT
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  phone TEXT,
  school_name TEXT
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
    COALESCE(s.phone, s.mother_phone, s.father_phone) AS phone,
    s.school_name
  FROM students s
  WHERE s.tenant_id = p_tenant_id
    AND s.school_name ILIKE '%' || p_school_name || '%'
    AND s.status = 'active'
  ORDER BY s.school_name, s.name;
END;
$$;

-- ============================================================================
-- 15. 퇴원 회원 필터링
-- ============================================================================
CREATE OR REPLACE FUNCTION filter_withdrawn_students(
  p_tenant_id UUID
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  phone TEXT,
  updated_at TIMESTAMPTZ
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
    COALESCE(s.phone, s.mother_phone, s.father_phone) AS phone,
    s.updated_at
  FROM students s
  WHERE s.tenant_id = p_tenant_id
    AND s.status = 'withdrawn'
  ORDER BY s.updated_at DESC;
END;
$$;

-- ============================================================================
-- 16. 특정 수업 수강생 필터링
-- ============================================================================
CREATE OR REPLACE FUNCTION filter_students_by_class(
  p_tenant_id UUID,
  p_class_id UUID
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  phone TEXT,
  enrolled_at DATE
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
    COALESCE(s.phone, s.mother_phone, s.father_phone) AS phone,
    sc.enrolled_at
  FROM students s
  INNER JOIN student_classes sc ON sc.student_id = s.id AND sc.tenant_id = s.tenant_id
  WHERE s.tenant_id = p_tenant_id
    AND sc.class_id = p_class_id
    AND sc.is_active = true
    AND s.status = 'active'
  ORDER BY sc.enrolled_at DESC, s.name;
END;
$$;

-- ============================================================================
-- 17. 특정 과목 수강생 필터링
-- ============================================================================
CREATE OR REPLACE FUNCTION filter_students_by_subject(
  p_tenant_id UUID,
  p_subject TEXT
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  phone TEXT,
  class_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    s.id AS student_id,
    s.name AS student_name,
    COALESCE(s.phone, s.mother_phone, s.father_phone) AS phone,
    ac.name AS class_name
  FROM students s
  INNER JOIN student_classes sc ON sc.student_id = s.id AND sc.tenant_id = s.tenant_id
  INNER JOIN academy_classes ac ON ac.id = sc.class_id AND ac.tenant_id = s.tenant_id
  WHERE s.tenant_id = p_tenant_id
    AND ac.subject ILIKE '%' || p_subject || '%'
    AND sc.is_active = true
    AND s.status = 'active'
  ORDER BY s.name;
END;
$$;

-- ============================================================================
-- 18. 활성 수업 없는 회원 필터링
-- ============================================================================
CREATE OR REPLACE FUNCTION filter_students_no_active_class(
  p_tenant_id UUID
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ
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
    COALESCE(s.phone, s.mother_phone, s.father_phone) AS phone,
    s.created_at
  FROM students s
  LEFT JOIN student_classes sc ON sc.student_id = s.id AND sc.tenant_id = s.tenant_id AND sc.is_active = true
  WHERE s.tenant_id = p_tenant_id
    AND s.status = 'active'
    AND sc.id IS NULL
  ORDER BY s.created_at DESC;
END;
$$;

-- ============================================================================
-- 19. 최근 등록 회원 필터링 (수업 등록 기준)
-- ============================================================================
CREATE OR REPLACE FUNCTION filter_recently_enrolled_students(
  p_tenant_id UUID,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  phone TEXT,
  enrolled_at DATE,
  class_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (s.id)
    s.id AS student_id,
    s.name AS student_name,
    COALESCE(s.phone, s.mother_phone, s.father_phone) AS phone,
    sc.enrolled_at,
    ac.name AS class_name
  FROM students s
  INNER JOIN student_classes sc ON sc.student_id = s.id AND sc.tenant_id = s.tenant_id
  INNER JOIN academy_classes ac ON ac.id = sc.class_id AND ac.tenant_id = s.tenant_id
  WHERE s.tenant_id = p_tenant_id
    AND sc.enrolled_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    AND sc.is_active = true
    AND s.status = 'active'
  ORDER BY s.id, sc.enrolled_at DESC;
END;
$$;

-- ============================================================================
-- 20. 결제 여러 번 실패 회원 필터링
-- ============================================================================
CREATE OR REPLACE FUNCTION filter_payment_failed_multiple_students(
  p_tenant_id UUID,
  p_min_failures INTEGER DEFAULT 3
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  phone TEXT,
  failure_count INTEGER
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
    COALESCE(s.phone, s.mother_phone, s.father_phone) AS phone,
    COUNT(p.id)::INTEGER AS failure_count
  FROM students s
  INNER JOIN invoices i ON i.student_id = s.id AND i.tenant_id = s.tenant_id
  INNER JOIN payments p ON p.invoice_id = i.id AND p.tenant_id = s.tenant_id
  WHERE s.tenant_id = p_tenant_id
    AND p.status = 'failed'
    AND s.status = 'active'
  GROUP BY s.id, s.name, s.phone, s.mother_phone, s.father_phone
  HAVING COUNT(p.id) >= p_min_failures
  ORDER BY failure_count DESC;
END;
$$;

-- ============================================================================
-- 21. 통합 필터 태그 적용 함수
-- ============================================================================
CREATE OR REPLACE FUNCTION apply_filter_tag(
  p_tenant_id UUID,
  p_tag_id UUID
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
  v_condition_type TEXT;
  v_condition_params JSONB;
BEGIN
  -- 태그 정보 조회
  SELECT
    condition_type,
    condition_params
  INTO v_condition_type, v_condition_params
  FROM message_filter_tags
  WHERE id = p_tag_id
    AND tenant_id = p_tenant_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tag not found or inactive: %', p_tag_id;
  END IF;

  -- 조건별 함수 호출
  CASE v_condition_type
    -- 출석 기반
    WHEN 'attendance.consecutive_late_3days' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('late_days', f.late_days) AS metadata
      FROM filter_consecutive_late_students(
        p_tenant_id,
        COALESCE((v_condition_params->>'days')::INTEGER, 3),
        COALESCE(v_condition_params->>'period', '30days')
      ) f;

    WHEN 'attendance.absent_3times_in_week' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('absent_count', f.absent_count) AS metadata
      FROM filter_absent_students(
        p_tenant_id,
        COALESCE((v_condition_params->>'count')::INTEGER, 3),
        COALESCE(v_condition_params->>'period', '7days')
      ) f;

    WHEN 'attendance.low_attendance_rate' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('attendance_rate', f.attendance_rate) AS metadata
      FROM filter_low_attendance_rate_students(
        p_tenant_id,
        COALESCE((v_condition_params->>'rate')::NUMERIC, 0.7),
        COALESCE(v_condition_params->>'period', '30days')
      ) f;

    WHEN 'attendance.perfect_attendance' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('attendance_count', f.attendance_count) AS metadata
      FROM filter_perfect_attendance_students(
        p_tenant_id,
        COALESCE(v_condition_params->>'period', '30days')
      ) f;

    WHEN 'attendance.no_visit' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('last_visit_date', f.last_visit_date) AS metadata
      FROM filter_no_visit_students(
        p_tenant_id,
        COALESCE((v_condition_params->>'days')::INTEGER, 30)
      ) f;

    WHEN 'attendance.frequent_late' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('late_days', f.late_days) AS metadata
      FROM filter_consecutive_late_students(
        p_tenant_id,
        COALESCE((v_condition_params->>'count')::INTEGER, 3),
        COALESCE(v_condition_params->>'period', '7days')
      ) f;

    -- 결제/청구 기반
    WHEN 'billing.has_overdue_invoices' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('overdue_amount', f.overdue_amount, 'overdue_count', f.overdue_count) AS metadata
      FROM filter_overdue_students(p_tenant_id) f;

    WHEN 'billing.overdue_long_term' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('overdue_amount', f.overdue_amount, 'oldest_overdue_date', f.oldest_overdue_date) AS metadata
      FROM filter_overdue_long_term_students(
        p_tenant_id,
        COALESCE((v_condition_params->>'months')::INTEGER, 2)
      ) f;

    WHEN 'billing.payment_due_soon' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('due_date', f.due_date, 'amount_due', f.amount_due) AS metadata
      FROM filter_payment_due_soon_students(
        p_tenant_id,
        COALESCE((v_condition_params->>'days')::INTEGER, 3)
      ) f;

    WHEN 'billing.payment_failed_multiple' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('failure_count', f.failure_count) AS metadata
      FROM filter_payment_failed_multiple_students(
        p_tenant_id,
        COALESCE((v_condition_params->>'min_failures')::INTEGER, 3)
      ) f;

    -- 등록/회원 상태
    WHEN 'enrollment.new_student_30days' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('created_date', f.created_date) AS metadata
      FROM filter_new_students(
        p_tenant_id,
        COALESCE((v_condition_params->>'days')::INTEGER, 30)
      ) f;

    WHEN 'status.withdrawn' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('updated_at', f.updated_at) AS metadata
      FROM filter_withdrawn_students(p_tenant_id) f;

    -- 학적 정보
    WHEN 'academic.grade_filter' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('grade', f.grade) AS metadata
      FROM filter_students_by_grade(
        p_tenant_id,
        ARRAY(SELECT jsonb_array_elements_text(v_condition_params->'grades'))
      ) f;

    WHEN 'academic.age_range' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('age', f.age) AS metadata
      FROM filter_students_by_age_range(
        p_tenant_id,
        COALESCE((v_condition_params->>'min')::INTEGER, 0),
        COALESCE((v_condition_params->>'max')::INTEGER, 100)
      ) f;

    WHEN 'academic.birthday_this_month' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('birth_date', f.birth_date) AS metadata
      FROM filter_birthday_this_month_students(p_tenant_id) f;

    -- 성별/학교
    WHEN 'status.gender_filter' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('gender', f.gender) AS metadata
      FROM filter_students_by_gender(
        p_tenant_id,
        v_condition_params->>'gender'
      ) f;

    WHEN 'status.school_filter' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('school_name', f.school_name) AS metadata
      FROM filter_students_by_school(
        p_tenant_id,
        v_condition_params->>'school_name'
      ) f;

    -- 수업 기반
    WHEN 'class.specific_class' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('enrolled_at', f.enrolled_at) AS metadata
      FROM filter_students_by_class(
        p_tenant_id,
        (v_condition_params->>'class_id')::UUID
      ) f;

    WHEN 'class.specific_subject' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('class_name', f.class_name) AS metadata
      FROM filter_students_by_subject(
        p_tenant_id,
        v_condition_params->>'subject'
      ) f;

    WHEN 'class.no_active_class' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('created_at', f.created_at) AS metadata
      FROM filter_students_no_active_class(p_tenant_id) f;

    WHEN 'class.recently_enrolled' THEN
      RETURN QUERY
      SELECT f.student_id, f.student_name, f.phone,
        jsonb_build_object('enrolled_at', f.enrolled_at, 'class_name', f.class_name) AS metadata
      FROM filter_recently_enrolled_students(
        p_tenant_id,
        COALESCE((v_condition_params->>'days')::INTEGER, 7)
      ) f;

    ELSE
      RAISE EXCEPTION 'Unknown condition type: %', v_condition_type;
  END CASE;

  -- 사용 횟수 증가
  UPDATE message_filter_tags
  SET usage_count = usage_count + 1
  WHERE id = p_tag_id;
END;
$$;

-- ============================================================================
-- 함수 권한 부여
-- ============================================================================
GRANT EXECUTE ON FUNCTION filter_consecutive_late_students(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION filter_absent_students(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION filter_low_attendance_rate_students(UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION filter_perfect_attendance_students(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION filter_no_visit_students(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION filter_overdue_students(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION filter_overdue_long_term_students(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION filter_payment_due_soon_students(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION filter_new_students(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION filter_students_by_grade(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION filter_students_by_age_range(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION filter_birthday_this_month_students(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION filter_students_by_gender(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION filter_students_by_school(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION filter_withdrawn_students(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION filter_students_by_class(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION filter_students_by_subject(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION filter_students_no_active_class(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION filter_recently_enrolled_students(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION filter_payment_failed_multiple_students(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_filter_tag(UUID, UUID) TO authenticated;
