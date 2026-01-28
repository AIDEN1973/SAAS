-- RPC 함수: update_class_teachers
-- 강사 배정 업데이트를 트랜잭션으로 처리 (N+1 쿼리 문제 해결)

CREATE OR REPLACE FUNCTION update_class_teachers(
  p_class_id UUID,
  p_teacher_ids UUID[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
  v_result JSON;
  v_current_date DATE := CURRENT_DATE;
  v_teacher_id UUID;
BEGIN
  -- 1. JWT에서 tenant_id 추출
  v_tenant_id := auth.jwt() ->> 'tenant_id';

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id not found in JWT';
  END IF;

  -- 2. 클래스 소유권 확인 (academy_classes 테이블 사용)
  IF NOT EXISTS (
    SELECT 1 FROM academy_classes
    WHERE id = p_class_id
    AND tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'Class not found or access denied';
  END IF;

  -- 3. 강사 ID 검증 추가 (2026-01-27)
  IF p_teacher_ids IS NOT NULL AND array_length(p_teacher_ids, 1) > 0 THEN
    FOREACH v_teacher_id IN ARRAY p_teacher_ids
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.academy_teachers
        WHERE id = v_teacher_id AND tenant_id = v_tenant_id
      ) THEN
        RAISE EXCEPTION '존재하지 않는 강사입니다: %', v_teacher_id;
      END IF;
    END LOOP;
  END IF;

  -- 4. 기존 활성 배정 모두 비활성화 (Bulk Update)
  UPDATE class_teachers
  SET
    is_active = FALSE,
    unassigned_at = v_current_date
  WHERE
    class_id = p_class_id
    AND tenant_id = v_tenant_id
    AND is_active = TRUE;

  -- 5. 신규 배정 처리 (중복 제거 + UPSERT 방식)
  -- UNIQUE 제약: (class_id, teacher_id, assigned_at)
  -- 같은 날짜에 이미 레코드가 있으면 재활성화
  IF array_length(p_teacher_ids, 1) > 0 THEN
    INSERT INTO class_teachers (
      class_id,
      teacher_id,
      tenant_id,
      role,
      assigned_at,
      is_active,
      created_at
    )
    SELECT DISTINCT
      p_class_id,
      teacher_id,
      v_tenant_id,
      'teacher',
      v_current_date,
      TRUE,
      NOW()
    FROM unnest(p_teacher_ids) AS teacher_id
    ON CONFLICT (class_id, teacher_id, assigned_at)
    DO UPDATE SET
      is_active = TRUE,
      unassigned_at = NULL;
  END IF;

  -- 6. 결과 반환
  v_result := json_build_object(
    'success', TRUE,
    'message', 'Class teachers updated successfully',
    'deactivated_count', (
      SELECT COUNT(*) FROM class_teachers
      WHERE class_id = p_class_id
      AND tenant_id = v_tenant_id
      AND is_active = FALSE
      AND unassigned_at = v_current_date
    ),
    'activated_count', array_length(p_teacher_ids, 1)
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to update class teachers: %', SQLERRM;
END;
$$;

-- RLS 정책은 함수 내부에서 처리하므로 별도 정책 불필요
-- SECURITY DEFINER로 실행되므로 함수 권한만 부여

-- 함수 사용 권한 부여 (인증된 사용자만)
GRANT EXECUTE ON FUNCTION update_class_teachers(UUID, UUID[]) TO authenticated;

COMMENT ON FUNCTION update_class_teachers IS 'Bulk update class teacher assignments with transaction support and UPSERT logic';
