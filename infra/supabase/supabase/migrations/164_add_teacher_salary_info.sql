-- P2-4: 강사 급여 정보 관리 컬럼 추가
-- 목적: 급여 유형, 기본급, 시급, 계좌 정보 등 급여 관리 기능 제공
-- 요구사항: 강사 관리 페이지에서 급여 정보 입력 및 관리

-- 1. academy_teachers 테이블에 급여 관련 컬럼 추가
ALTER TABLE academy_teachers
ADD COLUMN IF NOT EXISTS pay_type text CHECK (pay_type IN ('monthly', 'hourly', 'class_based')),
ADD COLUMN IF NOT EXISTS base_salary numeric(10, 2),
ADD COLUMN IF NOT EXISTS hourly_rate numeric(10, 2),
ADD COLUMN IF NOT EXISTS bank_name text,
ADD COLUMN IF NOT EXISTS bank_account text,
ADD COLUMN IF NOT EXISTS salary_notes text;

-- 2. 컬럼 코멘트
COMMENT ON COLUMN academy_teachers.pay_type IS '급여 유형: monthly(월급제), hourly(시급제), class_based(수업별)';
COMMENT ON COLUMN academy_teachers.base_salary IS '기본급 (월급제 또는 수업별 기본 급여)';
COMMENT ON COLUMN academy_teachers.hourly_rate IS '시급 (시급제 적용 시)';
COMMENT ON COLUMN academy_teachers.bank_name IS '급여 지급 은행명';
COMMENT ON COLUMN academy_teachers.bank_account IS '급여 지급 계좌번호 (암호화 권장)';
COMMENT ON COLUMN academy_teachers.salary_notes IS '급여 관련 메모 (특이사항, 조정 이력 등)';

-- 3. RPC 함수 업데이트: create_teacher에 급여 정보 파라미터 추가
DROP FUNCTION IF EXISTS public.create_teacher(uuid, text, text, text, text, text, text, date, text, text, text, text, uuid);

CREATE OR REPLACE FUNCTION public.create_teacher(
  p_tenant_id uuid,
  p_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_employee_id text DEFAULT NULL,
  p_specialization text DEFAULT NULL,
  p_hire_date date DEFAULT NULL,
  p_status text DEFAULT 'active',
  p_profile_image_url text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_pay_type text DEFAULT NULL,
  p_base_salary numeric DEFAULT NULL,
  p_hourly_rate numeric DEFAULT NULL,
  p_bank_name text DEFAULT NULL,
  p_bank_account text DEFAULT NULL,
  p_salary_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_person_id uuid;
  v_result jsonb;
BEGIN
  -- 입력 검증
  IF p_name IS NULL OR p_name = '' THEN
    RAISE EXCEPTION '강사 이름은 필수입니다.';
  END IF;

  IF p_status NOT IN ('active', 'on_leave', 'resigned') THEN
    RAISE EXCEPTION '유효하지 않은 상태입니다: %', p_status;
  END IF;

  -- P2-1: 중복 검사 (동일 이름 + 전화번호 + 재직중 상태)
  IF p_phone IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.persons p
    JOIN public.academy_teachers at ON at.person_id = p.id
    WHERE p.tenant_id = p_tenant_id
      AND p.name = p_name
      AND p.phone = p_phone
      AND p.person_type = 'teacher'
      AND at.status IN ('active', 'on_leave')
  ) THEN
    RAISE EXCEPTION '동일한 이름과 전화번호를 가진 강사가 이미 존재합니다. (이름: %, 전화: %)', p_name, p_phone;
  END IF;

  -- P2-4: 급여 유형 검증
  IF p_pay_type IS NOT NULL AND p_pay_type NOT IN ('monthly', 'hourly', 'class_based') THEN
    RAISE EXCEPTION '유효하지 않은 급여 유형입니다: %', p_pay_type;
  END IF;

  -- 1. persons 테이블에 생성
  INSERT INTO public.persons (
    tenant_id,
    name,
    email,
    phone,
    address,
    person_type,
    created_by,
    updated_by
  ) VALUES (
    p_tenant_id,
    p_name,
    p_email,
    p_phone,
    p_address,
    'teacher',
    p_created_by,
    p_created_by
  )
  RETURNING id INTO v_person_id;

  -- 2. academy_teachers 테이블에 확장 정보 추가 (P2-4: 급여 정보 포함)
  INSERT INTO public.academy_teachers (
    person_id,
    tenant_id,
    employee_id,
    specialization,
    hire_date,
    status,
    profile_image_url,
    bio,
    notes,
    pay_type,
    base_salary,
    hourly_rate,
    bank_name,
    bank_account,
    salary_notes,
    created_by,
    updated_by
  ) VALUES (
    v_person_id,
    p_tenant_id,
    p_employee_id,
    p_specialization,
    p_hire_date,
    p_status,
    p_profile_image_url,
    p_bio,
    p_notes,
    p_pay_type,
    p_base_salary,
    p_hourly_rate,
    p_bank_name,
    p_bank_account,
    p_salary_notes,
    p_created_by,
    p_created_by
  );

  -- 3. 생성된 강사 정보 반환 (persons + academy_teachers 조인)
  SELECT jsonb_build_object(
    'id', p.id,
    'tenant_id', p.tenant_id,
    'name', p.name,
    'email', p.email,
    'phone', p.phone,
    'address', p.address,
    'employee_id', at.employee_id,
    'specialization', at.specialization,
    'hire_date', at.hire_date,
    'status', at.status,
    'profile_image_url', at.profile_image_url,
    'bio', at.bio,
    'notes', at.notes,
    'pay_type', at.pay_type,
    'base_salary', at.base_salary,
    'hourly_rate', at.hourly_rate,
    'bank_name', at.bank_name,
    'bank_account', at.bank_account,
    'salary_notes', at.salary_notes,
    'created_at', p.created_at,
    'updated_at', p.updated_at,
    'created_by', at.created_by,
    'updated_by', at.updated_by
  )
  INTO v_result
  FROM public.persons p
  JOIN public.academy_teachers at ON at.person_id = p.id
  WHERE p.id = v_person_id;

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    -- 트랜잭션 롤백 (자동)
    RAISE EXCEPTION '강사 생성 실패: %', SQLERRM;
END;
$$;

-- 코멘트
COMMENT ON FUNCTION public.create_teacher IS
'P0-2, P2-1, P2-4: 강사 생성을 트랜잭션으로 처리 (persons + academy_teachers + 급여 정보 포함). 중복 검사 및 입력 검증 포함.';

-- 권한 부여
GRANT EXECUTE ON FUNCTION public.create_teacher TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_teacher FROM anon;
