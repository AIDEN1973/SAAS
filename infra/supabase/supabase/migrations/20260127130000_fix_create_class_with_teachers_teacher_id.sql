-- 2026-01-27: create_class_with_teachers 함수의 teacher_id 검증 오류 수정
-- 문제: WHERE person_id = v_teacher_id (잘못됨)
-- 수정: WHERE id = v_teacher_id (올바름)
-- 영향: 강사 배정 시 잘못된 ID가 저장되는 문제 해결

-- 기존 함수 삭제
DROP FUNCTION IF EXISTS public.create_class_with_teachers CASCADE;

-- 수정된 함수 재생성
CREATE OR REPLACE FUNCTION public.create_class_with_teachers(
  p_tenant_id uuid,
  p_name text,
  p_subject text DEFAULT NULL,
  p_grade text DEFAULT NULL,
  p_day_of_week text DEFAULT 'monday',
  p_start_time time DEFAULT '14:00:00',
  p_end_time time DEFAULT '15:30:00',
  p_capacity integer DEFAULT 20,
  p_color text DEFAULT NULL,
  p_room text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_status text DEFAULT 'active',
  p_teacher_ids uuid[] DEFAULT NULL,
  p_teacher_roles text[] DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id uuid;
  v_teacher_id uuid;
  v_teacher_role text;
  v_role_index integer := 1;
  v_result jsonb;
BEGIN
  -- 입력 검증
  IF p_name IS NULL OR p_name = '' THEN
    RAISE EXCEPTION '반 이름은 필수입니다.';
  END IF;

  IF p_day_of_week NOT IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday') THEN
    RAISE EXCEPTION '유효하지 않은 요일입니다: %', p_day_of_week;
  END IF;

  IF p_status NOT IN ('active', 'inactive', 'archived') THEN
    RAISE EXCEPTION '유효하지 않은 상태입니다: %', p_status;
  END IF;

  -- 1. 반 생성
  INSERT INTO public.academy_classes (
    tenant_id,
    name,
    subject,
    grade,
    day_of_week,
    start_time,
    end_time,
    capacity,
    color,
    room,
    notes,
    status,
    created_by,
    updated_by
  ) VALUES (
    p_tenant_id,
    p_name,
    p_subject,
    p_grade,
    p_day_of_week,
    p_start_time,
    p_end_time,
    p_capacity,
    p_color,
    p_room,
    p_notes,
    p_status,
    p_created_by,
    p_created_by
  )
  RETURNING id INTO v_class_id;

  -- 2. 강사 배정 (teacher_ids가 있는 경우)
  IF p_teacher_ids IS NOT NULL AND array_length(p_teacher_ids, 1) > 0 THEN
    FOREACH v_teacher_id IN ARRAY p_teacher_ids
    LOOP
      -- [수정됨 2026-01-27] 강사 존재 여부 확인: person_id → id
      -- v_teacher_id는 academy_teachers.id이므로 id 컬럼과 비교해야 함
      IF NOT EXISTS (
        SELECT 1 FROM public.academy_teachers
        WHERE id = v_teacher_id AND tenant_id = p_tenant_id
      ) THEN
        RAISE EXCEPTION '존재하지 않는 강사입니다: %', v_teacher_id;
      END IF;

      -- 역할 결정 (p_teacher_roles 배열이 있으면 사용, 없으면 'teacher')
      IF p_teacher_roles IS NOT NULL AND array_length(p_teacher_roles, 1) >= v_role_index THEN
        v_teacher_role := p_teacher_roles[v_role_index];
      ELSE
        v_teacher_role := 'teacher';
      END IF;

      -- 강사 배정
      INSERT INTO public.class_teachers (
        tenant_id,
        class_id,
        teacher_id,
        role,
        assigned_at,
        is_active
      ) VALUES (
        p_tenant_id,
        v_class_id,
        v_teacher_id,
        v_teacher_role,
        CURRENT_DATE,
        true
      );

      v_role_index := v_role_index + 1;
    END LOOP;
  END IF;

  -- 3. 생성된 반 정보 반환
  SELECT jsonb_build_object(
    'id', ac.id,
    'tenant_id', ac.tenant_id,
    'name', ac.name,
    'subject', ac.subject,
    'grade', ac.grade,
    'day_of_week', ac.day_of_week,
    'start_time', ac.start_time::text,
    'end_time', ac.end_time::text,
    'capacity', ac.capacity,
    'current_count', ac.current_count,
    'color', ac.color,
    'room', ac.room,
    'notes', ac.notes,
    'status', ac.status,
    'created_at', ac.created_at,
    'updated_at', ac.updated_at,
    'created_by', ac.created_by,
    'updated_by', ac.updated_by
  )
  INTO v_result
  FROM public.academy_classes ac
  WHERE ac.id = v_class_id;

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    -- 트랜잭션 롤백 (자동)
    RAISE EXCEPTION '반 생성 실패: %', SQLERRM;
END;
$$;

-- 권한 부여
GRANT EXECUTE ON FUNCTION public.create_class_with_teachers TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_class_with_teachers FROM anon;

-- 코멘트
COMMENT ON FUNCTION public.create_class_with_teachers IS
'P0-2: 반 생성 + 강사 배정을 트랜잭션으로 처리. [2026-01-27 수정] teacher_id 검증 오류 수정 (person_id → id)';
