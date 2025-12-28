-- RPC 함수: academy_students INSERT (id 컬럼 문제 해결)
--
-- 문제: academy_students 테이블은 person_id를 PRIMARY KEY로 사용하며 id 컬럼이 없음
--       PostgREST가 INSERT 시 자동으로 id 컬럼을 RETURNING 하려고 시도하여 오류 발생
-- 해결: PostgreSQL RPC 함수를 사용하여 직접 INSERT 수행
--       PostgREST의 자동 RETURNING 동작을 완전히 우회

CREATE OR REPLACE FUNCTION insert_academy_student(
  p_person_id uuid,
  p_tenant_id uuid,
  p_birth_date date DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_school_name text DEFAULT NULL,
  p_grade text DEFAULT NULL,
  p_status text DEFAULT 'active',
  p_notes text DEFAULT NULL,
  p_profile_image_url text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_updated_by uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  -- INSERT 실행
  INSERT INTO academy_students (
    person_id,
    tenant_id,
    birth_date,
    gender,
    school_name,
    grade,
    status,
    notes,
    profile_image_url,
    created_by,
    updated_by
  ) VALUES (
    p_person_id,
    p_tenant_id,
    p_birth_date,
    p_gender,
    p_school_name,
    p_grade,
    p_status,
    p_notes,
    p_profile_image_url,
    p_created_by,
    p_updated_by
  );

  -- 성공 응답 반환 (person_id만 반환)
  v_result := json_build_object(
    'success', true,
    'person_id', p_person_id
  );

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    -- 오류 발생 시 상세 정보 반환
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$;

-- 권한 부여
GRANT EXECUTE ON FUNCTION insert_academy_student TO authenticated;
GRANT EXECUTE ON FUNCTION insert_academy_student TO service_role;

-- 함수 설명 추가
COMMENT ON FUNCTION insert_academy_student IS
'academy_students 테이블에 INSERT하는 RPC 함수. PostgREST의 자동 RETURNING id 동작을 우회하기 위해 사용.';

