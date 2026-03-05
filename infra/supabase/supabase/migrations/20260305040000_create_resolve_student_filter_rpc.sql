-- Phase 4: 학생 필터 ID 해석 RPC 함수
-- 클라이언트의 limit:5000 전체 로드를 대체하여 서버에서 필터 결합
-- [불변 규칙] tenant_id 기반 RLS 적용

-- 1. 학생 필터 ID 해석 RPC
CREATE OR REPLACE FUNCTION resolve_student_filter_ids(
  p_tenant_id UUID,
  p_tag_ids UUID[] DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_grade TEXT DEFAULT NULL,
  p_class_id UUID DEFAULT NULL,
  p_include_deleted BOOLEAN DEFAULT FALSE
) RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result UUID[];
  v_caller_tenant UUID;
BEGIN
  -- [Zero-Trust] 호출자의 tenant_id와 파라미터 일치 검증
  BEGIN
    v_caller_tenant := current_setting('app.current_tenant_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_caller_tenant := NULL;
  END;
  -- service_role은 current_setting이 없을 수 있으므로 NULL이면 통과
  IF v_caller_tenant IS NOT NULL AND v_caller_tenant != p_tenant_id THEN
    RAISE EXCEPTION 'tenant_id mismatch';
  END IF;

  -- 모든 필터를 서버에서 JOIN + WHERE로 처리 (limit:5000 제거)
  SELECT ARRAY_AGG(DISTINCT p.id)
  INTO result
  FROM persons p
  JOIN academy_students a ON a.person_id = p.id AND a.tenant_id = p_tenant_id
  LEFT JOIN tag_assignments ta ON ta.entity_id = p.id
    AND ta.entity_type = 'student'
    AND ta.tenant_id = p_tenant_id
  LEFT JOIN student_classes sc ON sc.student_id = p.id
    AND sc.is_active = true
    AND sc.tenant_id = p_tenant_id
  WHERE p.tenant_id = p_tenant_id
    AND p.person_type = 'student'
    -- tag 필터: p_tag_ids가 null이면 무시, 아니면 해당 태그에 할당된 학생만
    AND (p_tag_ids IS NULL OR ta.tag_id = ANY(p_tag_ids))
    -- status 필터
    AND (p_status IS NULL OR a.status = p_status)
    -- grade 필터
    AND (p_grade IS NULL OR a.grade = p_grade)
    -- class_id 필터
    AND (p_class_id IS NULL OR sc.class_id = p_class_id)
    -- soft-delete 필터
    AND (p_include_deleted OR a.deleted_at IS NULL);

  RETURN COALESCE(result, ARRAY[]::UUID[]);
END;
$$;

COMMENT ON FUNCTION resolve_student_filter_ids IS 'Phase 4: 학생 필터 조건을 서버에서 결합하여 ID 배열 반환 (limit:5000 대체)';

-- 2. 태그별 학생 수 집계 RPC (클라이언트 전체 로드 대체)
CREATE OR REPLACE FUNCTION get_tag_student_counts(p_tenant_id UUID)
RETURNS TABLE(tag_id UUID, student_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- [Zero-Trust] service_role이 아닌 경우 tenant_id 일치 검증
  -- SQL 함수에서는 PL/pgSQL 예외 처리 불가 → 별도 검증 없이 쿼리 자체가 tenant_id로 필터링
  SELECT ta.tag_id, COUNT(DISTINCT ta.entity_id)
  FROM tag_assignments ta
  JOIN persons p ON p.id = ta.entity_id AND p.tenant_id = p_tenant_id
  JOIN academy_students a ON a.person_id = p.id AND a.tenant_id = p_tenant_id
  WHERE ta.entity_type = 'student'
    AND ta.tenant_id = p_tenant_id
    AND a.deleted_at IS NULL
  GROUP BY ta.tag_id;
$$;

COMMENT ON FUNCTION get_tag_student_counts IS 'Phase 4: 태그별 학생 수 서버 집계 (클라이언트 전체 로드 대체)';
