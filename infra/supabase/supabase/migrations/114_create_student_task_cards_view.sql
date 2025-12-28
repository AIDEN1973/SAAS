/**
 * student_task_cards VIEW 생성 (하위 호환성)
 *
 * 풀스케일 통합 후 하위 호환성을 위해 student_task_cards VIEW 생성
 * 기본은 읽기용으로 두고, 레거시 쓰기 경로가 남아 있을 때만 INSTEAD OF 트리거 검토
 *
 * [불변 규칙] VIEW는 underlying table RLS에 의해 보호됨 (추가 정책 남발 금지)
 */

-- ============================================================================
-- 1. 기존 VIEW 삭제 (있다면)
-- ============================================================================
DROP VIEW IF EXISTS public.student_task_cards;

-- ============================================================================
-- 2. student_task_cards VIEW 생성 (읽기용)
-- ============================================================================
CREATE OR REPLACE VIEW public.student_task_cards AS
SELECT
  id,
  tenant_id,
  student_id,  -- 레거시 필드
  entity_id,   -- 정본 필드 (entity_type='student'인 경우 student_id와 동일)
  entity_type, -- 정본 필드 (항상 'student')
  task_type,
  source,
  priority,
  title,
  description,
  action_url,
  suggested_action,
  dedup_key,
  status,
  expires_at,
  created_at,
  created_by,
  metadata,
  -- 레거시 필드 (하위 호환성 유지)
  student_name,
  risk_level,
  risk_reason,
  recommended_action,
  absence_days,
  last_attendance_date,
  parent_contact_needed,
  counseling_type,
  urgency,
  signup_date,
  welcome_message_sent,
  initial_setup_needed,
  -- 추가 권장 컬럼
  approved_by,
  approved_at,
  executed_at,
  updated_at,
  rejected_reason,
  severity,
  confidence
FROM public.task_cards
WHERE entity_type = 'student';

-- ============================================================================
-- 3. VIEW COMMENT
-- ============================================================================
COMMENT ON VIEW public.student_task_cards IS
'학생 업무 카드 VIEW (하위 호환성, 레거시). 정본은 task_cards 테이블을 사용하세요.';

-- ============================================================================
-- 4. VIEW 권한 설정
-- ============================================================================
-- VIEW는 underlying table RLS에 의해 보호되므로 추가 정책 불필요
-- 하지만 명시적으로 권한 부여
GRANT SELECT ON public.student_task_cards TO authenticated;

-- ============================================================================
-- 5. PostgREST 노출을 위한 COMMENT
-- ============================================================================
-- PostgREST가 VIEW를 자동으로 노출하도록 COMMENT 추가
COMMENT ON VIEW public.student_task_cards IS
'학생 업무 카드 VIEW (하위 호환성, 레거시). 정본은 task_cards 테이블을 사용하세요.';

-- ============================================================================
-- 주의사항
-- ============================================================================
-- ⚠️ 중요: 이 VIEW는 기본적으로 읽기용입니다.
-- 레거시 쓰기 경로가 남아 있어 제거가 불가능한 경우에만 INSTEAD OF 트리거를 검토하세요.
-- 가능하면 모든 쓰기 경로를 task_cards 테이블로 전환하는 것을 권장합니다.

-- ============================================================================
-- 마이그레이션 완료 로그
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ student_task_cards VIEW가 생성되었습니다.';
  RAISE NOTICE '   - 읽기용 VIEW (하위 호환성)';
  RAISE NOTICE '   - underlying table RLS에 의해 보호됨';
  RAISE NOTICE '   - 레거시 쓰기 경로는 task_cards 테이블로 전환 권장';
END $$;

