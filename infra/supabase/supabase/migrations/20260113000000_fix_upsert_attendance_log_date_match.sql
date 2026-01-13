-- attendance_logs UPSERT RPC 함수 수정
-- 문제: 정확한 occurred_at 매칭으로 인해 같은 날짜에 여러 레코드 생성됨
-- 해결: 같은 날짜(KST 기준)의 같은 student + attendance_type 조합이면 UPDATE
--
-- 근본 원인:
-- - 기존 함수는 `occurred_at = p_occurred_at`으로 정확한 시간 매칭
-- - 사용자가 09:00에 출석 체크 후, 09:05에 다시 체크하면 새 레코드 생성됨
-- - 결과적으로 같은 학생의 같은 날 출석 데이터가 중복됨

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
  v_existing_occurred_at TIMESTAMPTZ;
  v_target_date DATE;
BEGIN
  -- 입력값 검증
  IF p_attendance_type NOT IN ('check_in', 'check_out', 'absent', 'late') THEN
    RAISE EXCEPTION 'Invalid attendance_type: %', p_attendance_type;
  END IF;

  IF p_status NOT IN ('present', 'late', 'absent', 'excused') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  -- [근본 수정] KST 날짜 기준으로 기존 레코드 확인
  -- 같은 날짜(KST)의 같은 student + attendance_type이면 UPDATE
  v_target_date := (p_occurred_at AT TIME ZONE 'Asia/Seoul')::DATE;

  SELECT id, occurred_at INTO v_existing_id, v_existing_occurred_at
  FROM public.attendance_logs
  WHERE tenant_id = p_tenant_id
    AND student_id = p_student_id
    AND (occurred_at AT TIME ZONE 'Asia/Seoul')::DATE = v_target_date
    AND attendance_type = p_attendance_type
  ORDER BY occurred_at DESC  -- 가장 최신 레코드 선택
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- UPDATE (기존 레코드가 있는 경우)
    -- [수정] 최초 등원 시간 보존: occurred_at은 업데이트하지 않음
    -- 상태(status), 메모(notes), 체크인 방법(check_in_method)만 업데이트
    UPDATE public.attendance_logs
    SET
      class_id = p_class_id,
      -- occurred_at은 유지 (최초 등원 시간 보존)
      status = p_status,
      check_in_method = p_check_in_method,
      notes = p_notes
    WHERE id = v_existing_id
      AND occurred_at = v_existing_occurred_at  -- 파티션 키 포함 필수
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
    RAISE NOTICE '✅ upsert_attendance_log 함수 업데이트 완료 (KST 날짜 기준 UPSERT)';
  ELSE
    RAISE WARNING '❌ upsert_attendance_log 함수 업데이트 실패';
  END IF;
END $$;
