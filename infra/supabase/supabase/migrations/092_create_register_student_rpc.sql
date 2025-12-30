-- P0-14: 학생 등록 트랜잭션 RPC 함수
-- [불변 규칙] persons + academy_students 원자적 삽입 보장
-- [Zero-Trust] 모든 파라미터 검증 + tenant_id 일관성 보장

CREATE OR REPLACE FUNCTION register_student(
  p_tenant_id UUID,
  p_name TEXT,
  p_phone TEXT,
  p_birth_date DATE,
  p_email TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_class_name TEXT DEFAULT NULL,
  p_grade TEXT DEFAULT NULL,
  p_school_name TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS TABLE(
  person_id UUID,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_person_id UUID;
  v_student_table TEXT;
BEGIN
  -- P0-25: 필수 파라미터 검증 (Fail-Closed)
  IF p_tenant_id IS NULL OR p_name IS NULL OR p_phone IS NULL OR p_birth_date IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'tenant_id, name, phone, birth_date는 필수입니다.'::TEXT;
    RETURN;
  END IF;

  -- P0-24: 중복 체크 (이름 + 전화번호 + 생년월일)
  -- academy_students 테이블에서 중복 확인
  IF EXISTS (
    SELECT 1
    FROM academy_students s
    INNER JOIN persons p ON p.id = s.person_id
    WHERE s.tenant_id = p_tenant_id
      AND p.name = p_name
      AND p.phone = p_phone
      AND s.birth_date = p_birth_date
  ) THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, '동일한 이름, 전화번호, 생년월일을 가진 학생이 이미 등록되어 있습니다.'::TEXT;
    RETURN;
  END IF;

  -- [트랜잭션 시작] 암묵적 BEGIN (함수 내부는 자동 트랜잭션)

  -- 1. persons 테이블 삽입
  INSERT INTO persons (
    tenant_id,
    name,
    phone,
    email,
    address,
    person_type
  ) VALUES (
    p_tenant_id,
    p_name,
    p_phone,
    p_email,
    p_address,
    'student'
  )
  RETURNING id INTO v_person_id;

  -- 2. academy_students 테이블 삽입
  INSERT INTO academy_students (
    person_id,
    tenant_id,
    birth_date,
    class_name,
    grade,
    school_name,
    status,
    created_by
  ) VALUES (
    v_person_id,
    p_tenant_id,
    p_birth_date,
    p_class_name,
    p_grade,
    p_school_name,
    'active',
    p_created_by
  );

  -- [트랜잭션 성공] 자동 COMMIT
  RETURN QUERY SELECT v_person_id, TRUE, NULL::TEXT;

EXCEPTION
  WHEN OTHERS THEN
    -- [트랜잭션 실패] 자동 ROLLBACK
    RETURN QUERY SELECT NULL::UUID, FALSE, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS 우회를 위한 SECURITY DEFINER 사용
-- (함수 소유자 권한으로 실행됨)

COMMENT ON FUNCTION register_student IS 'P0-14: 학생 등록 트랜잭션 RPC (persons + academy_students 원자적 삽입)';
