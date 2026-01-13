-- attendance_logs 테이블에 UPSERT하는 RPC 함수
-- 파티션 테이블에서 Supabase의 upsert()가 동작하지 않는 문제를 우회
--
-- 이 함수는 attendance_logs에 레코드를 UPSERT하고, 결과를 반환합니다.
-- 동일한 (tenant_id, student_id, occurred_at, attendance_type) 조합이 있으면 UPDATE,
-- 없으면 INSERT를 수행합니다.

CREATE OR REPLACE FUNCTION upsert_attendance_log(
  p_tenant_id UUID,
  p_student_id UUID,
  p_class_id UUID,
  p_occurred_at TIMESTAMPTZ,
  p_attendance_type TEXT,
  p_status TEXT,
  p_check_in_method TEXT DEFAULT 'manual',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result RECORD;
  v_existing_id BIGINT;
BEGIN
  -- 입력값 검증
  IF p_attendance_type NOT IN ('check_in', 'check_out', 'absent', 'late') THEN
    RAISE EXCEPTION 'Invalid attendance_type: %', p_attendance_type;
  END IF;

  IF p_status NOT IN ('present', 'late', 'absent', 'excused') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  -- 기존 레코드 확인
  SELECT id INTO v_existing_id
  FROM public.attendance_logs
  WHERE tenant_id = p_tenant_id
    AND student_id = p_student_id
    AND occurred_at = p_occurred_at
    AND attendance_type = p_attendance_type
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- UPDATE (기존 레코드가 있는 경우)
    UPDATE public.attendance_logs
    SET
      class_id = p_class_id,
      status = p_status,
      check_in_method = p_check_in_method,
      notes = p_notes
    WHERE id = v_existing_id
      AND occurred_at = p_occurred_at  -- 파티션 키 포함 필수
    RETURNING * INTO v_result;
  ELSE
    -- INSERT (새 레코드)
    INSERT INTO public.attendance_logs (
      tenant_id,
      student_id,
      class_id,
      occurred_at,
      attendance_type,
      status,
      check_in_method,
      notes,
      created_at
    ) VALUES (
      p_tenant_id,
      p_student_id,
      p_class_id,
      p_occurred_at,
      p_attendance_type,
      p_status,
      p_check_in_method,
      p_notes,
      now()
    )
    RETURNING * INTO v_result;
  END IF;

  -- 결과를 JSONB로 반환
  RETURN to_jsonb(v_result);
END;
$$;

-- RLS 우회를 위해 SECURITY DEFINER 사용
-- 함수 호출자에게 execute 권한 부여
GRANT EXECUTE ON FUNCTION upsert_attendance_log TO authenticated;

-- 검증
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'upsert_attendance_log'
  ) THEN
    RAISE NOTICE '✅ upsert_attendance_log 함수 생성 완료';
  ELSE
    RAISE WARNING '❌ upsert_attendance_log 함수 생성 실패';
  END IF;
END $$;
