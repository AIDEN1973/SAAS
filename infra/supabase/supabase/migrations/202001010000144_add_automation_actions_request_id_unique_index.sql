-- automation_actions.request_id 멱등 유니크 인덱스 추가
-- 챗봇.md v1.2: request_id 멱등 강제
--
-- 목적: request_id 기반 멱등성 보장을 위한 유니크 인덱스 추가
-- 포맷: {task_id}:{action}:{attempt_window}

-- ============================================================================
-- 1. 기존 중복 데이터 확인 (주석)
-- ============================================================================
-- 마이그레이션 적용 전에 중복 존재 여부를 점검하는 쿼리
-- 실행하여 중복이 있다면 사전에 정리 필요
/*
SELECT
  tenant_id,
  request_id,
  COUNT(*) as duplicate_count
FROM automation_actions
WHERE request_id IS NOT NULL
GROUP BY tenant_id, request_id
HAVING COUNT(*) > 1;
*/

-- ============================================================================
-- 2. request_id 유니크 인덱스 추가 (멀티테넌트 안전)
-- ============================================================================
-- 옵션 A (권장): (tenant_id, request_id) UNIQUE
-- 멀티테넌트 안전하며, request_id 포맷에 tenant_id가 포함되지 않아도 됨
CREATE UNIQUE INDEX IF NOT EXISTS ux_automation_actions_request_id
ON automation_actions(tenant_id, request_id)
WHERE request_id IS NOT NULL;

-- ============================================================================
-- 3. COMMENT 추가
-- ============================================================================
COMMENT ON INDEX ux_automation_actions_request_id IS
'request_id 멱등성 보장을 위한 유니크 인덱스 (멀티테넌트 안전). 포맷: {task_id}:{action}:{attempt_window}';

-- ============================================================================
-- 마이그레이션 완료 로그
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ automation_actions.request_id 유니크 인덱스가 추가되었습니다.';
  RAISE NOTICE '   - (tenant_id, request_id) UNIQUE 인덱스 생성';
  RAISE NOTICE '   - 멱등성 보장: 동일 request_id는 한 번만 처리';
END $$;

