-- Schedule Conflict Detection RPC
-- [요구사항] 디어쌤_아키텍처.md 3.2.2: 일정 충돌 감지
-- [충돌 유형]
--   1. Teacher's duplicate time slot assignment (강사 중복 시간 배정)
--   2. Classroom resource conflicts (강의실 중복 예약)
--   3. Partial time overlap (시간대 부분 겹침)

-- 1. 일정 충돌 감지 함수
CREATE OR REPLACE FUNCTION public.check_schedule_conflicts(
  p_tenant_id uuid,
  p_day_of_week text,
  p_start_time time,
  p_end_time time,
  p_class_id uuid DEFAULT NULL,  -- 수정 시 자기 자신 제외용
  p_teacher_ids uuid[] DEFAULT NULL,
  p_room text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conflicts jsonb := '[]'::jsonb;
  v_conflict jsonb;
  v_teacher_id uuid;
  v_overlapping_class record;
BEGIN
  -- 입력 검증
  IF p_day_of_week NOT IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday') THEN
    RAISE EXCEPTION '유효하지 않은 요일입니다: %', p_day_of_week;
  END IF;

  IF p_start_time >= p_end_time THEN
    RAISE EXCEPTION '시작 시간은 종료 시간보다 빨라야 합니다.';
  END IF;

  -- 1. 강사 중복 시간 배정 체크
  IF p_teacher_ids IS NOT NULL AND array_length(p_teacher_ids, 1) > 0 THEN
    FOREACH v_teacher_id IN ARRAY p_teacher_ids
    LOOP
      FOR v_overlapping_class IN
        SELECT
          ac.id,
          ac.name,
          ac.day_of_week,
          ac.start_time,
          ac.end_time,
          p.name as teacher_name
        FROM public.academy_classes ac
        JOIN public.class_teachers ct ON ct.class_id = ac.id AND ct.is_active = true
        JOIN public.persons p ON p.id = ct.teacher_id
        WHERE ac.tenant_id = p_tenant_id
          AND ac.status = 'active'
          AND (p_class_id IS NULL OR ac.id != p_class_id)  -- 자기 자신 제외
          AND ac.day_of_week = p_day_of_week
          AND ct.teacher_id = v_teacher_id
          -- 시간대 겹침 체크: (start1 < end2) AND (start2 < end1)
          AND ac.start_time < p_end_time
          AND p_start_time < ac.end_time
      LOOP
        v_conflict := jsonb_build_object(
          'type', 'teacher_conflict',
          'class_id', v_overlapping_class.id,
          'class_name', v_overlapping_class.name,
          'teacher_name', v_overlapping_class.teacher_name,
          'day_of_week', v_overlapping_class.day_of_week,
          'start_time', v_overlapping_class.start_time::text,
          'end_time', v_overlapping_class.end_time::text,
          'message', format('%s 강사가 이미 %s 반에 배정되어 있습니다 (%s ~ %s)',
            v_overlapping_class.teacher_name,
            v_overlapping_class.name,
            v_overlapping_class.start_time::text,
            v_overlapping_class.end_time::text
          )
        );
        v_conflicts := v_conflicts || v_conflict;
      END LOOP;
    END LOOP;
  END IF;

  -- 2. 강의실 중복 예약 체크
  IF p_room IS NOT NULL AND p_room != '' THEN
    FOR v_overlapping_class IN
      SELECT
        ac.id,
        ac.name,
        ac.day_of_week,
        ac.start_time,
        ac.end_time,
        ac.room
      FROM public.academy_classes ac
      WHERE ac.tenant_id = p_tenant_id
        AND ac.status = 'active'
        AND (p_class_id IS NULL OR ac.id != p_class_id)  -- 자기 자신 제외
        AND ac.day_of_week = p_day_of_week
        AND ac.room = p_room
        -- 시간대 겹침 체크
        AND ac.start_time < p_end_time
        AND p_start_time < ac.end_time
    LOOP
      v_conflict := jsonb_build_object(
        'type', 'room_conflict',
        'class_id', v_overlapping_class.id,
        'class_name', v_overlapping_class.name,
        'room', v_overlapping_class.room,
        'day_of_week', v_overlapping_class.day_of_week,
        'start_time', v_overlapping_class.start_time::text,
        'end_time', v_overlapping_class.end_time::text,
        'message', format('강의실 "%s"가 이미 %s 반에 예약되어 있습니다 (%s ~ %s)',
          v_overlapping_class.room,
          v_overlapping_class.name,
          v_overlapping_class.start_time::text,
          v_overlapping_class.end_time::text
        )
      );
      v_conflicts := v_conflicts || v_conflict;
    END LOOP;
  END IF;

  -- 3. 결과 반환
  RETURN jsonb_build_object(
    'has_conflicts', jsonb_array_length(v_conflicts) > 0,
    'conflict_count', jsonb_array_length(v_conflicts),
    'conflicts', v_conflicts
  );
END;
$$;

-- 권한 부여
GRANT EXECUTE ON FUNCTION public.check_schedule_conflicts TO authenticated;
REVOKE EXECUTE ON FUNCTION public.check_schedule_conflicts FROM anon;

COMMENT ON FUNCTION public.check_schedule_conflicts IS
'일정 충돌 감지: 강사 중복 배정, 강의실 중복 예약 체크. 시간대 부분 겹침도 감지.';
