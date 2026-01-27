-- global_search 함수 수정
-- 문제 1: academy_classes.grade가 ARRAY 타입인데 COALESCE(c.grade, '')로 문자열과 병합 시도
-- 문제 2: PostgREST 배열 파라미터 전달 시 호환성 이슈
-- 해결: array_to_string으로 배열 변환 + 파라미터를 쉼표 구분 문자열로 변경

DROP FUNCTION IF EXISTS global_search(uuid, text, text[], int);
DROP FUNCTION IF EXISTS global_search(uuid, text, text, int);

CREATE OR REPLACE FUNCTION global_search(
  p_tenant_id uuid,
  p_query text,
  p_entity_types text DEFAULT 'student,teacher,class,guardian,consultation,announcement,tag',
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
  v_query_words text[];
  v_tsquery_text text;
BEGIN
  -- 빈 검색어 처리
  IF p_query IS NULL OR trim(p_query) = '' THEN
    RETURN;
  END IF;

  -- 검색어 단어 배열 생성
  v_query_words := array(
    SELECT word || ':*'
    FROM unnest(string_to_array(trim(p_query), ' ')) AS word
    WHERE word != '' AND word IS NOT NULL
  );

  -- 단어가 없으면 종료
  IF array_length(v_query_words, 1) IS NULL OR array_length(v_query_words, 1) = 0 THEN
    RETURN;
  END IF;

  -- tsquery 문자열 생성
  v_tsquery_text := array_to_string(v_query_words, ' & ');

  -- tsquery 변환
  v_tsquery := to_tsquery('simple', v_tsquery_text);

  RETURN QUERY
  WITH all_results AS (
    -- persons - 학생
    SELECT
      p.id,
      'student'::text AS entity_type,
      p.name AS title,
      COALESCE(p.email, p.phone, '') AS subtitle,
      ts_rank(p.search_vector, v_tsquery) AS relevance,
      p.created_at
    FROM persons p
    WHERE p_entity_types LIKE '%student%'
      AND p.tenant_id = p_tenant_id
      AND p.person_type = 'student'
      AND p.search_vector @@ v_tsquery

    UNION ALL

    -- persons - 강사
    SELECT
      p.id,
      'teacher'::text AS entity_type,
      p.name AS title,
      COALESCE(p.email, p.phone, '') AS subtitle,
      ts_rank(p.search_vector, v_tsquery) AS relevance,
      p.created_at
    FROM persons p
    WHERE p_entity_types LIKE '%teacher%'
      AND p.tenant_id = p_tenant_id
      AND p.person_type = 'teacher'
      AND p.search_vector @@ v_tsquery

    UNION ALL

    -- 하위 호환성: 'person' 타입
    SELECT
      p.id,
      p.person_type::text AS entity_type,
      p.name AS title,
      COALESCE(p.email, p.phone, '') AS subtitle,
      ts_rank(p.search_vector, v_tsquery) AS relevance,
      p.created_at
    FROM persons p
    WHERE p_entity_types LIKE '%person%'
      AND p.tenant_id = p_tenant_id
      AND p.person_type IN ('student', 'teacher')
      AND p.search_vector @@ v_tsquery

    UNION ALL

    -- academy_classes (반) - grade는 ARRAY 타입이므로 array_to_string으로 변환
    SELECT
      c.id,
      'class'::text AS entity_type,
      c.name AS title,
      COALESCE(c.subject, '') || ' ' || COALESCE(array_to_string(c.grade, ', '), '') AS subtitle,
      ts_rank(c.search_vector, v_tsquery) AS relevance,
      c.created_at
    FROM academy_classes c
    WHERE p_entity_types LIKE '%class%'
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
    WHERE p_entity_types LIKE '%guardian%'
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
    WHERE p_entity_types LIKE '%consultation%'
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
    WHERE p_entity_types LIKE '%announcement%'
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
    WHERE p_entity_types LIKE '%tag%'
      AND t.tenant_id = p_tenant_id
      AND t.search_vector @@ v_tsquery
  )
  SELECT * FROM all_results
  ORDER BY relevance DESC, created_at DESC
  LIMIT p_limit;
END;
$$;

-- RPC 함수 권한 부여
GRANT EXECUTE ON FUNCTION global_search(uuid, text, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION global_search(uuid, text, text, int) TO anon;

COMMENT ON FUNCTION global_search IS '글로벌 검색 RPC - grade 배열 타입 처리 수정 (2026-01-26)';
