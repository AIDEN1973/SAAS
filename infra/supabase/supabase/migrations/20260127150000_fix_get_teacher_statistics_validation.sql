-- 2026-01-27: get_teacher_statistics 함수의 검증 로직 수정
-- 문제: WHERE person_id = p_teacher_id (잘못됨)
-- 수정: WHERE id = p_teacher_id (올바름)

CREATE OR REPLACE FUNCTION public.get_teacher_statistics(
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
  v_total_classes integer;
  v_total_students integer;
  v_main_teacher_classes integer;
  v_assistant_classes integer;
BEGIN
  -- 입력 검증: 강사 존재 여부 [수정 2026-01-27: person_id → id]
  IF NOT EXISTS (
    SELECT 1 FROM public.academy_teachers
    WHERE id = p_teacher_id AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION '존재하지 않는 강사입니다: %', p_teacher_id;
  END IF;

  -- 담당 반 수 (활성화된 배정만)
  SELECT COUNT(DISTINCT ct.class_id)
  INTO v_total_classes
  FROM public.class_teachers ct
  WHERE ct.teacher_id = p_teacher_id
    AND ct.tenant_id = p_tenant_id
    AND ct.is_active = true;

  -- 담당 학생 수 (담당 반의 모든 활성 학생)
  SELECT COUNT(DISTINCT sc.student_id)
  INTO v_total_students
  FROM public.class_teachers ct
  JOIN public.student_classes sc ON sc.class_id = ct.class_id
  WHERE ct.teacher_id = p_teacher_id
    AND ct.tenant_id = p_tenant_id
    AND ct.is_active = true
    AND sc.is_active = true;

  -- 담임 반 수 (role = 'teacher')
  SELECT COUNT(DISTINCT ct.class_id)
  INTO v_main_teacher_classes
  FROM public.class_teachers ct
  WHERE ct.teacher_id = p_teacher_id
    AND ct.tenant_id = p_tenant_id
    AND ct.is_active = true
    AND ct.role = 'teacher';

  -- 부담임 반 수 (role = 'assistant')
  SELECT COUNT(DISTINCT ct.class_id)
  INTO v_assistant_classes
  FROM public.class_teachers ct
  WHERE ct.teacher_id = p_teacher_id
    AND ct.tenant_id = p_tenant_id
    AND ct.is_active = true
    AND ct.role = 'assistant';

  -- 결과 반환
  v_result := jsonb_build_object(
    'total_classes', COALESCE(v_total_classes, 0),
    'total_students', COALESCE(v_total_students, 0),
    'main_teacher_classes', COALESCE(v_main_teacher_classes, 0),
    'assistant_classes', COALESCE(v_assistant_classes, 0)
  );

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '강사 통계 조회 실패: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_teacher_statistics TO authenticated;

COMMENT ON FUNCTION public.get_teacher_statistics IS
'P1-3: 강사별 통계 조회 (담당 반 수, 담당 학생 수, 담임/부담임 구분). [2026-01-27 수정] id 기반 검증';
