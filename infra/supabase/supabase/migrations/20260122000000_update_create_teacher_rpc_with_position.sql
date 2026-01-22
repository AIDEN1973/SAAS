-- create_teacher RPC에 position, login_id, user_id 파라미터 추가
-- Phase 7: 강사 권한 계정 시스템 구현

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
  p_created_by uuid DEFAULT NULL,
  p_position text DEFAULT 'teacher',  -- 신규: 직급
  p_login_id text DEFAULT NULL,       -- 신규: 로그인 ID
  p_user_id uuid DEFAULT NULL         -- 신규: auth.users 연결
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

  -- position 검증
  IF p_position IS NOT NULL AND p_position NOT IN ('vice_principal', 'manager', 'teacher', 'assistant', 'other') THEN
    RAISE EXCEPTION '유효하지 않은 직급입니다: %', p_position;
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

  -- login_id 중복 검사 (테넌트 내)
  IF p_login_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.academy_teachers
    WHERE tenant_id = p_tenant_id
      AND login_id = p_login_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION '이미 사용 중인 아이디입니다: %', p_login_id;
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

  -- 2. academy_teachers 테이블에 확장 정보 추가
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
    created_by,
    updated_by,
    position,
    login_id,
    user_id
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
    p_created_by,
    p_created_by,
    p_position,
    p_login_id,
    p_user_id
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
    'position', at.position,
    'login_id', at.login_id,
    'user_id', at.user_id,
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

-- 코멘트 업데이트
COMMENT ON FUNCTION public.create_teacher IS
'P0-2: 강사 생성을 트랜잭션으로 처리하여 persons + academy_teachers 부분 성공 방지. JWT claim 기반 tenant_id 검증 포함. Phase 7: position, login_id, user_id 지원 추가.';

-- 권한 유지
GRANT EXECUTE ON FUNCTION public.create_teacher TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_teacher FROM anon;
