-- Update create_class_with_teachers RPC to support teacher roles (담임/부담임)
-- [요구사항] 디어쌤_아키텍처.md 3.2.4: Co-teacher Assignment (부담임)

DROP FUNCTION IF EXISTS public.create_class_with_teachers(uuid, text, text, text, text, time, time, integer, text, text, text, uuid[], uuid);

CREATE OR REPLACE FUNCTION public.create_class_with_teachers(
  p_tenant_id uuid,
  p_name text,
  p_subject text DEFAULT NULL,
  p_grade text DEFAULT NULL,
  p_day_of_week text DEFAULT 'monday',
  p_start_time time DEFAULT '14:00:00',
  p_end_time time DEFAULT '15:30:00',
  p_capacity integer DEFAULT 20,
  p_room text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_status text DEFAULT 'active',
  p_color text DEFAULT NULL,  -- 색상 필드 추가
  p_teacher_ids uuid[] DEFAULT NULL,
  p_teacher_roles text[] DEFAULT NULL,  -- 역할 배열 추가 ('teacher' or 'assistant')
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
  v_result jsonb;
  v_idx integer;
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

  -- 1. 반 생성 (색상은 트리거에서 자동 할당되지만, 명시적으로 제공된 경우 우선)
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
    COALESCE(p_color, get_next_class_color(p_tenant_id)),  -- 명시적 색상 또는 자동 할당
    p_room,
    p_notes,
    p_status,
    p_created_by,
    p_created_by
  )
  RETURNING id INTO v_class_id;

  -- 2. 강사 배정 (teacher_ids가 있는 경우)
  IF p_teacher_ids IS NOT NULL AND array_length(p_teacher_ids, 1) > 0 THEN
    FOR v_idx IN 1..array_length(p_teacher_ids, 1)
    LOOP
      v_teacher_id := p_teacher_ids[v_idx];

      -- 역할 결정: p_teacher_roles가 제공되었으면 사용, 아니면 기본값 'teacher'
      IF p_teacher_roles IS NOT NULL AND v_idx <= array_length(p_teacher_roles, 1) THEN
        v_teacher_role := p_teacher_roles[v_idx];
      ELSE
        v_teacher_role := 'teacher';
      END IF;

      -- 역할 검증
      IF v_teacher_role NOT IN ('teacher', 'assistant') THEN
        RAISE EXCEPTION '유효하지 않은 강사 역할입니다: %', v_teacher_role;
      END IF;

      -- 강사 존재 여부 확인
      IF NOT EXISTS (
        SELECT 1 FROM public.academy_teachers
        WHERE person_id = v_teacher_id AND tenant_id = p_tenant_id
      ) THEN
        RAISE EXCEPTION '존재하지 않는 강사입니다: %', v_teacher_id;
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

COMMENT ON FUNCTION public.create_class_with_teachers IS
'P0-2: 반 생성 + 강사 배정 (담임/부담임 역할 지원). 트랜잭션으로 처리하여 부분 성공 방지. 색상 자동 할당 지원.';
