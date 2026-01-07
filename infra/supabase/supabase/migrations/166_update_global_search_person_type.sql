-- global_search 함수 업데이트: person_type에 따라 student/teacher 구분
-- [변경사항] persons 검색 시 person_type을 entity_type으로 반환
-- - student → 학생
-- - teacher → 강사

CREATE OR REPLACE FUNCTION global_search(
  p_tenant_id uuid,
  p_query text,
  p_entity_types text[] DEFAULT ARRAY['student', 'teacher', 'class', 'guardian', 'consultation', 'announcement', 'tag'],
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  entity_type text,
  title text,
  subtitle text,
  relevance real,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tsquery tsquery;
BEGIN
  -- 검색어를 tsquery로 변환 (prefix 매칭 지원)
  v_tsquery := to_tsquery('simple',
    array_to_string(
      array(SELECT word || ':*' FROM unnest(string_to_array(trim(p_query), ' ')) AS word WHERE word != ''),
      ' & '
    )
  );

  -- 빈 검색어 처리
  IF p_query IS NULL OR trim(p_query) = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH all_results AS (
    -- persons - 학생 (person_type = 'student')
    SELECT
      p.id,
      'student'::text AS entity_type,
      p.name AS title,
      COALESCE(p.email, p.phone, '') AS subtitle,
      ts_rank(p.search_vector, v_tsquery) AS relevance,
      p.created_at
    FROM persons p
    WHERE 'student' = ANY(p_entity_types)
      AND p.tenant_id = p_tenant_id
      AND p.person_type = 'student'
      AND p.search_vector @@ v_tsquery

    UNION ALL

    -- persons - 강사 (person_type = 'teacher')
    SELECT
      p.id,
      'teacher'::text AS entity_type,
      p.name AS title,
      COALESCE(p.email, p.phone, '') AS subtitle,
      ts_rank(p.search_vector, v_tsquery) AS relevance,
      p.created_at
    FROM persons p
    WHERE 'teacher' = ANY(p_entity_types)
      AND p.tenant_id = p_tenant_id
      AND p.person_type = 'teacher'
      AND p.search_vector @@ v_tsquery

    UNION ALL

    -- 하위 호환성: 'person' 타입으로 요청 시 student + teacher 모두 반환
    SELECT
      p.id,
      p.person_type::text AS entity_type,
      p.name AS title,
      COALESCE(p.email, p.phone, '') AS subtitle,
      ts_rank(p.search_vector, v_tsquery) AS relevance,
      p.created_at
    FROM persons p
    WHERE 'person' = ANY(p_entity_types)
      AND p.tenant_id = p_tenant_id
      AND p.person_type IN ('student', 'teacher')
      AND p.search_vector @@ v_tsquery

    UNION ALL

    -- academy_classes (반)
    SELECT
      c.id,
      'class'::text AS entity_type,
      c.name AS title,
      COALESCE(c.subject, '') || ' ' || COALESCE(c.grade, '') AS subtitle,
      ts_rank(c.search_vector, v_tsquery) AS relevance,
      c.created_at
    FROM academy_classes c
    WHERE 'class' = ANY(p_entity_types)
      AND c.tenant_id = p_tenant_id
      AND c.search_vector @@ v_tsquery

    UNION ALL

    -- guardians (보호자)
    SELECT
      g.id,
      'guardian'::text AS entity_type,
      g.name AS title,
      COALESCE(g.phone, '') AS subtitle,
      ts_rank(g.search_vector, v_tsquery) AS relevance,
      g.created_at
    FROM guardians g
    WHERE 'guardian' = ANY(p_entity_types)
      AND g.tenant_id = p_tenant_id
      AND g.search_vector @@ v_tsquery

    UNION ALL

    -- student_consultations (상담)
    SELECT
      sc.id,
      'consultation'::text AS entity_type,
      LEFT(sc.content, 50) || '...' AS title,
      to_char(sc.consultation_date, 'YYYY-MM-DD') AS subtitle,
      ts_rank(sc.search_vector, v_tsquery) AS relevance,
      sc.created_at
    FROM student_consultations sc
    WHERE 'consultation' = ANY(p_entity_types)
      AND sc.tenant_id = p_tenant_id
      AND sc.search_vector @@ v_tsquery

    UNION ALL

    -- announcements (공지사항)
    SELECT
      a.id,
      'announcement'::text AS entity_type,
      a.title AS title,
      LEFT(a.content, 50) || '...' AS subtitle,
      ts_rank(a.search_vector, v_tsquery) AS relevance,
      a.created_at
    FROM announcements a
    WHERE 'announcement' = ANY(p_entity_types)
      AND a.tenant_id = p_tenant_id
      AND a.search_vector @@ v_tsquery

    UNION ALL

    -- tags (태그)
    SELECT
      t.id,
      'tag'::text AS entity_type,
      t.name AS title,
      COALESCE(t.color, '') AS subtitle,
      ts_rank(t.search_vector, v_tsquery) AS relevance,
      t.created_at
    FROM tags t
    WHERE 'tag' = ANY(p_entity_types)
      AND t.tenant_id = p_tenant_id
      AND t.search_vector @@ v_tsquery
  )
  SELECT * FROM all_results
  ORDER BY relevance DESC, created_at DESC
  LIMIT p_limit;
END;
$$;
