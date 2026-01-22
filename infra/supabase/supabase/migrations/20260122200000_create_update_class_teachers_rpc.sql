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
BEGIN
  -- 1. JWT에서 tenant_id 추출
  v_tenant_id := auth.jwt() ->> 'tenant_id';

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id not found in JWT';
  END IF;

  -- 2. 클래스 소유권 확인
  IF NOT EXISTS (
    SELECT 1 FROM classes
    WHERE id = p_class_id
    AND tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'Class not found or access denied';
  END IF;

  -- 3. 기존 활성 배정 모두 비활성화 (Bulk Update)
  UPDATE class_teachers
  SET
    is_active = FALSE,
    unassigned_at = CURRENT_DATE,
    updated_at = NOW(),
    updated_by = auth.uid()
  WHERE
    class_id = p_class_id
    AND tenant_id = v_tenant_id
    AND is_active = TRUE;

  -- 4. 신규 배정 일괄 삽입 (Bulk Insert)
  IF array_length(p_teacher_ids, 1) > 0 THEN
    INSERT INTO class_teachers (
      class_id,
      teacher_id,
      tenant_id,
      role,
      assigned_at,
      is_active,
      created_at,
      created_by,
      updated_at,
      updated_by
    )
    SELECT
      p_class_id,
      unnest(p_teacher_ids),
      v_tenant_id,
      'teacher',
      CURRENT_DATE,
      TRUE,
      NOW(),
      auth.uid(),
      NOW(),
      auth.uid();
  END IF;

  -- 5. 결과 반환
  v_result := json_build_object(
    'success', TRUE,
    'message', 'Class teachers updated successfully',
    'deactivated_count', (
      SELECT COUNT(*) FROM class_teachers
      WHERE class_id = p_class_id
      AND tenant_id = v_tenant_id
      AND is_active = FALSE
      AND unassigned_at = CURRENT_DATE
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

COMMENT ON FUNCTION update_class_teachers IS 'Bulk update class teacher assignments with transaction support';
