-- ============================================================================
-- 학생 통계 집계 RPC 함수들
-- [목적] 서버 측에서 통계 집계하여 클라이언트 부하 감소
-- [성능 개선 2026-01-27] 대량 데이터 로딩 대신 DB 레벨 집계
-- ============================================================================

-- ============================================================================
-- 1. 태그별 학생 수 집계
-- ============================================================================
CREATE OR REPLACE FUNCTION aggregate_student_tag_stats(p_tenant_id UUID)
RETURNS TABLE (
  tag_id UUID,
  tag_name TEXT,
  tag_color TEXT,
  student_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- RLS 컨텍스트 설정
  PERFORM set_config('app.current_tenant_id', p_tenant_id::text, true);

  RETURN QUERY
  SELECT
    t.id AS tag_id,
    t.name AS tag_name,
    t.color AS tag_color,
    COUNT(DISTINCT ta.entity_id) AS student_count
  FROM tags t
  LEFT JOIN tag_assignments ta ON ta.tag_id = t.id AND ta.entity_type = 'student'
  WHERE t.tenant_id = p_tenant_id
    AND t.entity_type = 'student'
  GROUP BY t.id, t.name, t.color
  ORDER BY student_count DESC, t.created_at DESC;
END;
$$;

COMMENT ON FUNCTION aggregate_student_tag_stats IS '태그별 학생 수 집계 (서버 측 집계)';

-- ============================================================================
-- 2. 수업별 학생 수 집계
-- ============================================================================
CREATE OR REPLACE FUNCTION aggregate_student_class_stats(
  p_tenant_id UUID,
  p_is_active BOOLEAN DEFAULT true
)
RETURNS TABLE (
  class_id UUID,
  class_name TEXT,
  student_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- RLS 컨텍스트 설정
  PERFORM set_config('app.current_tenant_id', p_tenant_id::text, true);

  RETURN QUERY
  SELECT
    c.id AS class_id,
    c.name AS class_name,
    COUNT(DISTINCT sc.student_id) AS student_count
  FROM academy_classes c
  LEFT JOIN student_classes sc ON sc.class_id = c.id AND sc.is_active = p_is_active
  WHERE c.tenant_id = p_tenant_id
  GROUP BY c.id, c.name
  ORDER BY student_count DESC, c.created_at DESC;
END;
$$;

COMMENT ON FUNCTION aggregate_student_class_stats IS '수업별 학생 수 집계 (서버 측 집계)';

-- ============================================================================
-- 3. 상태별 학생 수 집계 (기간 필터 지원)
-- ============================================================================
CREATE OR REPLACE FUNCTION aggregate_student_status_stats(
  p_tenant_id UUID,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  status TEXT,
  count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- RLS 컨텍스트 설정
  PERFORM set_config('app.current_tenant_id', p_tenant_id::text, true);

  RETURN QUERY
  SELECT
    COALESCE(s.status, 'active') AS status,
    COUNT(*) AS count
  FROM students s
  WHERE s.tenant_id = p_tenant_id
    AND (p_date_from IS NULL OR s.created_at >= p_date_from)
    AND (p_date_to IS NULL OR s.created_at <= p_date_to)
  GROUP BY s.status
  ORDER BY count DESC;
END;
$$;

COMMENT ON FUNCTION aggregate_student_status_stats IS '상태별 학생 수 집계 (기간 필터 지원)';

-- ============================================================================
-- 4. 상담 유형별 통계 집계 (기간 필터 지원)
-- ============================================================================
CREATE OR REPLACE FUNCTION aggregate_consultation_stats(
  p_tenant_id UUID,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  consultation_type TEXT,
  count BIGINT,
  date_histogram JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- RLS 컨텍스트 설정
  PERFORM set_config('app.current_tenant_id', p_tenant_id::text, true);

  RETURN QUERY
  SELECT
    COALESCE(sc.consultation_type, 'counseling') AS consultation_type,
    COUNT(*) AS count,
    jsonb_object_agg(
      to_char(sc.consultation_date, 'YYYY-MM-DD'),
      COUNT(*)
    ) AS date_histogram
  FROM student_consultations sc
  WHERE sc.tenant_id = p_tenant_id
    AND (p_date_from IS NULL OR sc.consultation_date >= p_date_from::DATE)
    AND (p_date_to IS NULL OR sc.consultation_date <= p_date_to::DATE)
  GROUP BY sc.consultation_type, to_char(sc.consultation_date, 'YYYY-MM-DD')
  ORDER BY count DESC;
END;
$$;

COMMENT ON FUNCTION aggregate_consultation_stats IS '상담 유형별 통계 집계 (기간 필터 및 날짜별 히스토그램 지원)';

-- ============================================================================
-- 권한 부여
-- ============================================================================
GRANT EXECUTE ON FUNCTION aggregate_student_tag_stats TO authenticated;
GRANT EXECUTE ON FUNCTION aggregate_student_class_stats TO authenticated;
GRANT EXECUTE ON FUNCTION aggregate_student_status_stats TO authenticated;
GRANT EXECUTE ON FUNCTION aggregate_consultation_stats TO authenticated;
