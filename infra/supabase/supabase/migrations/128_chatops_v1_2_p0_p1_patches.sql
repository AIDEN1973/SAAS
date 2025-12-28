-- 챗봇.md v1.2 P0/P1 패치 마이그레이션
-- 목적: ChatOps/TaskCard/execute 흐름을 v1.2 스펙에 맞게 수정
-- 작성일: 2025-12-26

-- ============================================================================
-- P0-2: task_cards.status 전이 규칙 고정
-- ============================================================================
-- v1.2 스펙: open | approval_requested | executed_success | executed_failed

-- 기존 CHECK 제약 제거
ALTER TABLE task_cards
DROP CONSTRAINT IF EXISTS task_cards_status_check;

-- v1.2 스펙에 맞는 CHECK 제약 추가
ALTER TABLE task_cards
ADD CONSTRAINT task_cards_status_check
CHECK (status IN ('open', 'approval_requested', 'executed_success', 'executed_failed', 'pending', 'approved', 'executed', 'expired'));

-- ⚠️ 하위 호환성: 기존 값(pending, approved, executed, expired)도 허용
-- 신규 코드는 v1.2 스펙(open, approval_requested, executed_success, executed_failed) 사용 권장

COMMENT ON COLUMN task_cards.status IS
'상태: v1.2 스펙(open|approval_requested|executed_success|executed_failed) 또는 레거시(pending|approved|executed|expired)';

-- ============================================================================
-- P0-2: task_cards에 last_action_at_utc, last_action_id 추가
-- ============================================================================
ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS last_action_at_utc TIMESTAMPTZ;

ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS last_action_id UUID REFERENCES automation_actions(id);

COMMENT ON COLUMN task_cards.last_action_at_utc IS '마지막 automation_actions 기록 시각 (감사 추적용)';
COMMENT ON COLUMN task_cards.last_action_id IS '마지막 automation_actions ID (FK, 감사 추적용)';

-- 인덱스 추가 (조회 성능)
CREATE INDEX IF NOT EXISTS idx_task_cards_last_action
ON task_cards(last_action_at_utc DESC)
WHERE last_action_at_utc IS NOT NULL;

-- ============================================================================
-- P0-1: automation_actions에 requested_by_user_id, requested_at_utc 필드 추가
-- ============================================================================
-- ⚠️ 참고: approved_by, approved_at은 이미 존재 (084번 마이그레이션)
-- request-approval 경로에서 사용할 requested_by_user_id, requested_at_utc 추가

ALTER TABLE automation_actions
ADD COLUMN IF NOT EXISTS requested_by_user_id UUID REFERENCES auth.users(id);

ALTER TABLE automation_actions
ADD COLUMN IF NOT EXISTS requested_at_utc TIMESTAMPTZ;

COMMENT ON COLUMN automation_actions.requested_by_user_id IS '승인 요청자 ID (request-approval 경로에서 사용)';
COMMENT ON COLUMN automation_actions.requested_at_utc IS '승인 요청 시각 (request-approval 경로에서 사용)';

-- ⚠️ 참고: approved_by_user_id는 approved_by 컬럼으로 이미 존재
-- v1.2 스펙: approved_by_user_id = approved_by (기존 컬럼 재사용)

-- ============================================================================
-- 마이그레이션 완료 로그
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ 챗봇.md v1.2 P0/P1 패치 마이그레이션이 완료되었습니다.';
  RAISE NOTICE '   - task_cards.status CHECK 제약 수정 (v1.2 스펙 + 레거시 호환)';
  RAISE NOTICE '   - task_cards.last_action_at_utc, last_action_id 컬럼 추가';
  RAISE NOTICE '   - automation_actions.requested_by_user_id, requested_at_utc 컬럼 추가';
END $$;

