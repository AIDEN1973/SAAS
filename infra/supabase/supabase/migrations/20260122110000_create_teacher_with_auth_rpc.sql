-- create_teacher_with_auth RPC: 강사 + auth.users 계정 동시 생성
-- Phase 7: 관리자가 강사를 직접 등록할 때 사용

CREATE OR REPLACE FUNCTION public.create_teacher_with_auth(
  p_name text,
  p_phone text,
  p_position text,
  p_login_id text,
  p_password text,
  p_email text DEFAULT NULL,
  p_specialization text DEFAULT NULL,
  p_hire_date date DEFAULT NULL,
  p_employee_id text DEFAULT NULL,
  p_profile_image_url text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_pay_type text DEFAULT NULL,
  p_base_salary numeric DEFAULT NULL,
  p_hourly_rate numeric DEFAULT NULL,
  p_bank_name text DEFAULT NULL,
  p_bank_account text DEFAULT NULL,
  p_salary_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
  v_person_id uuid;
  v_teacher_id uuid;
  v_role text;
  v_result jsonb;
  v_auth_email text;
BEGIN
  -- 현재 사용자의 tenant_id 가져오기
  v_tenant_id := (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id를 확인할 수 없습니다.';
  END IF;

  -- 입력 검증
  IF p_name IS NULL OR p_name = '' THEN
    RAISE EXCEPTION '강사 이름은 필수입니다.';
  END IF;

  IF p_phone IS NULL OR p_phone = '' THEN
    RAISE EXCEPTION '휴대폰 번호는 필수입니다.';
  END IF;

  IF p_login_id IS NULL OR p_login_id = '' THEN
    RAISE EXCEPTION '로그인 아이디는 필수입니다.';
  END IF;

  IF p_password IS NULL OR p_password = '' OR length(p_password) < 8 THEN
    RAISE EXCEPTION '비밀번호는 8자 이상이어야 합니다.';
  END IF;

  IF p_position NOT IN ('vice_principal', 'manager', 'teacher', 'assistant', 'other') THEN
    RAISE EXCEPTION '유효하지 않은 직급입니다: %', p_position;
  END IF;

  -- 중복 검사: login_id
  IF EXISTS (
    SELECT 1 FROM public.academy_teachers
    WHERE tenant_id = v_tenant_id
      AND login_id = p_login_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION '이미 사용 중인 아이디입니다: %', p_login_id;
  END IF;

  -- 중복 검사: 동일 이름 + 전화번호
  IF EXISTS (
    SELECT 1 FROM public.persons p
    JOIN public.academy_teachers at ON at.person_id = p.id
    WHERE p.tenant_id = v_tenant_id
      AND p.name = p_name
      AND p.phone = p_phone
      AND p.person_type = 'teacher'
      AND at.status IN ('active', 'on_leave')
      AND at.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION '동일한 이름과 전화번호를 가진 강사가 이미 존재합니다.';
  END IF;

  -- Position -> Role 매핑
  v_role := CASE p_position
    WHEN 'vice_principal' THEN 'sub_admin'
    WHEN 'manager' THEN 'manager'
    WHEN 'teacher' THEN 'teacher'
    WHEN 'assistant' THEN 'staff'
    WHEN 'other' THEN 'staff'
    ELSE 'teacher'
  END;

  -- auth.users email 결정 (email 또는 login_id@tenant.local)
  IF p_email IS NOT NULL AND p_email != '' THEN
    v_auth_email := p_email;
  ELSE
    v_auth_email := p_login_id || '@' || v_tenant_id || '.local';
  END IF;

  -- NOTE: auth.users 생성은 SERVICE_ROLE_KEY가 필요하므로
  -- Edge Function을 호출하거나, 클라이언트에서 처리해야 함
  -- 여기서는 user_id를 NULL로 두고 나중에 업데이트하는 방식 사용

  -- 1. persons 테이블에 생성
  INSERT INTO public.persons (
    tenant_id,
    name,
    email,
    phone,
    person_type,
    created_by,
    updated_by
  ) VALUES (
    v_tenant_id,
    p_name,
    p_email,
    p_phone,
    'teacher',
    auth.uid(),
    auth.uid()
  )
  RETURNING id INTO v_person_id;

  -- 2. academy_teachers 테이블에 생성
  INSERT INTO public.academy_teachers (
    person_id,
    tenant_id,
    position,
    login_id,
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
    v_tenant_id,
    p_position,
    p_login_id,
    p_employee_id,
    p_specialization,
    p_hire_date,
    'active',
    p_profile_image_url,
    p_bio,
    p_notes,
    p_pay_type,
    p_base_salary,
    p_hourly_rate,
    p_bank_name,
    p_bank_account,
    p_salary_notes,
    auth.uid(),
    auth.uid()
  )
  RETURNING id INTO v_teacher_id;

  -- 3. 생성된 강사 정보 반환
  SELECT jsonb_build_object(
    'id', p.id,
    'teacher_id', at.id,
    'tenant_id', p.tenant_id,
    'name', p.name,
    'email', p.email,
    'phone', p.phone,
    'position', at.position,
    'login_id', at.login_id,
    'employee_id', at.employee_id,
    'specialization', at.specialization,
    'hire_date', at.hire_date,
    'status', at.status,
    'profile_image_url', at.profile_image_url,
    'bio', at.bio,
    'notes', at.notes,
    'auth_email', v_auth_email,
    'password_length', length(p_password),
    'role', v_role,
    'created_at', p.created_at
  )
  INTO v_result
  FROM public.persons p
  JOIN public.academy_teachers at ON at.person_id = p.id
  WHERE p.id = v_person_id;

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '강사 생성 실패: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.create_teacher_with_auth IS
'Phase 7: 관리자가 강사를 직접 등록할 때 사용. persons + academy_teachers를 트랜잭션으로 생성. auth.users는 별도로 처리 필요.';

GRANT EXECUTE ON FUNCTION public.create_teacher_with_auth TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_teacher_with_auth FROM anon;
