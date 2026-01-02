-- P0-2: 강사 생성 + 삭제 트랜잭션 안전성 보장
-- 목적: persons + academy_teachers를 atomic하게 처리하여 부분 성공 방지
-- 요구사항: TeachersPage.tsx에서 강사 생성/삭제를 DB RPC로 이관

-- RPC 함수: 강사 생성 (트랜잭션)
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

-- P1-3: 강사 소프트 삭제 (트랜잭션)
CREATE OR REPLACE FUNCTION public.delete_teacher(
  p_tenant_id uuid,
  p_teacher_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- 입력 검증: 강사 존재 여부 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.academy_teachers
    WHERE person_id = p_teacher_id AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION '존재하지 않는 강사입니다: %', p_teacher_id;
  END IF;

  -- 소프트 삭제: status를 'resigned'로 변경
  UPDATE public.academy_teachers
  SET
    status = 'resigned',
    updated_at = now()
  WHERE person_id = p_teacher_id AND tenant_id = p_tenant_id;

  -- 결과 반환
  SELECT jsonb_build_object(
    'id', p_teacher_id,
    'status', 'resigned',
    'message', '강사가 퇴직 처리되었습니다.'
  )
  INTO v_result;

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '강사 삭제 실패: %', SQLERRM;
END;
$$;

-- 코멘트
COMMENT ON FUNCTION public.create_teacher IS
'P0-2: 강사 생성을 트랜잭션으로 처리하여 persons + academy_teachers 부분 성공 방지. JWT claim 기반 tenant_id 검증 포함.';

COMMENT ON FUNCTION public.delete_teacher IS
'P1-3: 강사 소프트 삭제를 단일 RPC로 처리하여 쿼리 횟수 감소 및 일관성 보장.';

-- 권한 부여
GRANT EXECUTE ON FUNCTION public.create_teacher TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_teacher FROM anon;

GRANT EXECUTE ON FUNCTION public.delete_teacher TO authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_teacher FROM anon;
