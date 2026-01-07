/**
 * Global Search - PostgreSQL Full Text Search (Phase 2)
 *
 * [불변 규칙] 글로벌 검색을 위한 FTS 인덱스 생성
 * [불변 규칙] simple 사전 사용 (한글 형태소 분석 없이 공백 기준 토큰화)
 */

-- ============================================
-- 1. persons 테이블 (학생/강사/고객 이름 검색)
-- ============================================
-- 이미 idx_persons_name_pattern 인덱스가 있으므로 추가 tsvector 생성
ALTER TABLE persons ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(email, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(phone, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_persons_fts ON persons USING GIN(search_vector);

-- ============================================
-- 2. academy_students 테이블 (학생 상세 정보 검색)
-- ============================================
ALTER TABLE academy_students ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(school_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(grade, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(notes, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_academy_students_fts ON academy_students USING GIN(search_vector);

-- ============================================
-- 3. academy_classes 테이블 (반/수업 검색)
-- ============================================
ALTER TABLE academy_classes ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(subject, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(grade, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(room, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(notes, '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_academy_classes_fts ON academy_classes USING GIN(search_vector);

-- ============================================
-- 4. guardians 테이블 (보호자 검색)
-- ============================================
ALTER TABLE guardians ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(phone, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(notes, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_guardians_fts ON guardians USING GIN(search_vector);

-- ============================================
-- 5. student_consultations 테이블 (상담 내용 검색)
-- ============================================
ALTER TABLE student_consultations ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(content, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(ai_summary, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_student_consultations_fts ON student_consultations USING GIN(search_vector);

-- ============================================
-- 6. announcements 테이블 (공지사항 검색)
-- ============================================
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(content, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_announcements_fts ON announcements USING GIN(search_vector);

-- ============================================
-- 7. tags 테이블 (태그 검색)
-- ============================================
ALTER TABLE tags ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_tags_fts ON tags USING GIN(search_vector);

-- ============================================
-- 8. 글로벌 검색 RPC 함수
-- ============================================
CREATE OR REPLACE FUNCTION global_search(
  p_tenant_id uuid,
  p_query text,
  p_entity_types text[] DEFAULT ARRAY['person', 'class', 'guardian', 'consultation', 'announcement', 'tag'],
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
    -- persons (학생/강사)
    SELECT
      p.id,
      'person'::text AS entity_type,
      p.name AS title,
      COALESCE(p.email, p.phone, '') AS subtitle,
      ts_rank(p.search_vector, v_tsquery) AS relevance,
      p.created_at
    FROM persons p
    WHERE 'person' = ANY(p_entity_types)
      AND p.tenant_id = p_tenant_id
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
      to_char(a.published_at, 'YYYY-MM-DD') AS subtitle,
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
      COALESCE(t.description, '') AS subtitle,
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

-- RPC 함수 권한 부여
GRANT EXECUTE ON FUNCTION global_search(uuid, text, text[], int) TO authenticated;

COMMENT ON FUNCTION global_search IS 'Phase 2 글로벌 검색 RPC - PostgreSQL Full Text Search 기반';
