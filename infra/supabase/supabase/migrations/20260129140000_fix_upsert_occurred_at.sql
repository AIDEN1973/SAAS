/**
 * Migration: Fix upsert_attendance_log to update occurred_at
 *
 * [문제]
 * upsert_attendance_log 함수의 UPDATE 쿼리에 occurred_at 필드가 누락되어
 * 시간 변경이 DB에 저장되지 않고 기존 시간이 유지됨
 *
 * [해결]
 * UPDATE 쿼리에 occurred_at = p_occurred_at 추가
 */

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
  -- [수정] attendance_type 검증: null 허용 (수업 출석 레코드)
  IF p_attendance_type IS NOT NULL AND p_attendance_type NOT IN ('check_in', 'check_out') THEN
    RAISE EXCEPTION 'Invalid attendance_type: %. Must be check_in, check_out, or null', p_attendance_type;
  END IF;

  -- [수정] status 검증: null 허용 (check_in/check_out 이벤트)
  IF p_status IS NOT NULL AND p_status NOT IN ('present', 'late', 'absent', 'excused', 'scheduled') THEN
    RAISE EXCEPTION 'Invalid status: %. Must be present, late, absent, excused, scheduled, or null', p_status;
  END IF;

  -- KST 날짜 기준으로 기존 레코드 확인
  v_target_date := (p_occurred_at AT TIME ZONE 'Asia/Seoul')::DATE;

  -- [수정] 이중 레코드 패턴에 따른 기존 레코드 검색
  IF p_attendance_type IS NULL AND p_class_id IS NOT NULL THEN
    -- 수업 출석 레코드: student + class_id + date 기준
    SELECT id, occurred_at INTO v_existing_id, v_existing_occurred_at
    FROM public.attendance_logs
    WHERE tenant_id = p_tenant_id
      AND student_id = p_student_id
      AND class_id = p_class_id
      AND (occurred_at AT TIME ZONE 'Asia/Seoul')::DATE = v_target_date
      AND attendance_type IS NULL
    ORDER BY occurred_at DESC
    LIMIT 1;
  ELSE
    -- check_in/check_out 이벤트: student + attendance_type + date 기준
    SELECT id, occurred_at INTO v_existing_id, v_existing_occurred_at
    FROM public.attendance_logs
    WHERE tenant_id = p_tenant_id
      AND student_id = p_student_id
      AND (occurred_at AT TIME ZONE 'Asia/Seoul')::DATE = v_target_date
      AND attendance_type = p_attendance_type
    ORDER BY occurred_at DESC
    LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    -- UPDATE (기존 레코드가 있는 경우)
    -- [수정] occurred_at 필드 추가
    UPDATE public.attendance_logs
    SET
      occurred_at = p_occurred_at,  -- ✨ 시간 변경 반영!
      class_id = p_class_id,
      status = p_status,
      check_in_method = p_check_in_method,
      notes = p_notes
    WHERE id = v_existing_id
      AND occurred_at = v_existing_occurred_at  -- WHERE절의 기존 occurred_at은 유지 (파티션 키)
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

-- 검증
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'upsert_attendance_log'
  ) THEN
    RAISE NOTICE '✅ upsert_attendance_log 함수 업데이트 완료 (occurred_at 업데이트 지원)';
  ELSE
    RAISE WARNING '❌ upsert_attendance_log 함수 업데이트 실패';
  END IF;
END $$;
