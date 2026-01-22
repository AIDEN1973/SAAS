-- RPC 함수: get_teachers_with_stats
-- 강사 목록과 통계를 한 번에 조회 (N+1 쿼리 문제 해결)
-- [최적화] 기존: useTeachers + 각 카드에서 useTeacherStatistics 개별 호출 (N+1)
--          변경: 단일 쿼리로 모든 강사 + 통계 조회 (1 query)

-- 기존 함수 삭제 (중복 방지)
DROP FUNCTION IF EXISTS get_teachers_with_stats(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_teachers_with_stats(TEXT, TEXT);
DROP FUNCTION IF EXISTS get_teachers_with_stats();

CREATE OR REPLACE FUNCTION get_teachers_with_stats(
  p_status TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  person_id UUID,
  name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  teacher_position TEXT,
  specialization TEXT,
  employee_id TEXT,
  hire_date DATE,
  status TEXT,
  login_id TEXT,
  user_id UUID,
  profile_image_url TEXT,
  bio TEXT,
  notes TEXT,
  pay_type TEXT,
  base_salary NUMERIC,
  hourly_rate NUMERIC,
  bank_name TEXT,
  bank_account TEXT,
  salary_notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID,
  total_classes BIGINT,
  total_students BIGINT,
  main_teacher_classes BIGINT,
  assistant_classes BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- JWT에서 tenant_id 추출
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::UUID;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id not found in JWT';
  END IF;

  RETURN QUERY
  SELECT
    at.id,
    at.tenant_id,
    p.id AS person_id,
    p.name::TEXT,
    p.phone::TEXT,
    p.email::TEXT,
    p.address::TEXT,
    at.position::TEXT AS teacher_position,
    at.specialization::TEXT,
    at.employee_id::TEXT,
    at.hire_date,
    at.status::TEXT,
    at.login_id::TEXT,
    at.user_id,
    at.profile_image_url::TEXT,
    at.bio::TEXT,
    at.notes::TEXT,
    at.pay_type::TEXT,
    at.base_salary,
    at.hourly_rate,
    at.bank_name::TEXT,
    at.bank_account::TEXT,
    at.salary_notes::TEXT,
    at.created_at,
    at.updated_at,
    at.created_by,
    at.updated_by,
    -- 통계: 담당 수업 수
    COALESCE(teacher_stats.total_classes, 0)::BIGINT AS total_classes,
    -- 통계: 담당 학생 수
    COALESCE(teacher_stats.total_students, 0)::BIGINT AS total_students,
    -- 통계: 담임 수업 수
    COALESCE(teacher_stats.main_teacher_classes, 0)::BIGINT AS main_teacher_classes,
    -- 통계: 부담임 수업 수
    COALESCE(teacher_stats.assistant_classes, 0)::BIGINT AS assistant_classes
  FROM academy_teachers at
  INNER JOIN persons p ON at.person_id = p.id AND p.tenant_id = v_tenant_id
  LEFT JOIN LATERAL (
    SELECT
      COUNT(DISTINCT ct.class_id) AS total_classes,
      COUNT(DISTINCT ce.student_id) AS total_students,
      COUNT(DISTINCT CASE WHEN ct.role = 'teacher' THEN ct.class_id END) AS main_teacher_classes,
      COUNT(DISTINCT CASE WHEN ct.role = 'assistant' THEN ct.class_id END) AS assistant_classes
    FROM class_teachers ct
    LEFT JOIN class_enrollments ce ON ct.class_id = ce.class_id AND ce.status = 'active'
    WHERE ct.teacher_id = at.id
      AND ct.tenant_id = v_tenant_id
      AND ct.is_active = TRUE
  ) teacher_stats ON TRUE
  WHERE at.tenant_id = v_tenant_id
    AND at.deleted_at IS NULL
    AND (p_status IS NULL OR at.status = p_status)
    AND (p_search IS NULL OR p.name ILIKE '%' || p_search || '%')
  ORDER BY p.name;
END;
$$;

-- 함수 사용 권한 부여 (인증된 사용자만)
GRANT EXECUTE ON FUNCTION get_teachers_with_stats(TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION get_teachers_with_stats IS 'Fetch teachers with statistics in a single query (solves N+1 problem)';
