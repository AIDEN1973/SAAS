-- task_cards 테이블의 UNIQUE 인덱스 수정
--
-- [근본 해결] create_absence_task_card 트리거의 ON CONFLICT 구문과
-- UNIQUE 인덱스의 부분 조건(WHERE clause)이 일치하지 않아 오류 발생
--
-- 문제:
-- - UNIQUE INDEX: WHERE dedup_key IS NOT NULL AND status = 'pending'
-- - ON CONFLICT: WHERE dedup_key IS NOT NULL (status 조건 없음)
--
-- PostgreSQL 규칙: ON CONFLICT의 WHERE 절은 UNIQUE INDEX의 WHERE 절과 정확히 일치해야 함
--
-- 해결책: status = 'pending' 조건을 제거하여 트리거와 일치시킴
-- 이유: 새로 생성되는 task_card는 항상 status = 'pending'이므로 조건이 불필요

-- 기존 인덱스 삭제
DROP INDEX IF EXISTS ux_task_cards_dedup_key;

-- 새 인덱스 생성 (status 조건 제거)
CREATE UNIQUE INDEX IF NOT EXISTS ux_task_cards_dedup_key
ON task_cards(tenant_id, dedup_key)
WHERE dedup_key IS NOT NULL;

-- PostgREST 스키마 캐시 새로고침
NOTIFY pgrst, 'reload schema';

-- 검증
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'ux_task_cards_dedup_key'
  ) THEN
    RAISE NOTICE '✅ task_cards UNIQUE 인덱스 수정 완료';
  ELSE
    RAISE WARNING '❌ task_cards UNIQUE 인덱스 생성 실패';
  END IF;
END $$;

COMMENT ON INDEX ux_task_cards_dedup_key IS
'task_cards 중복 방지 UNIQUE 인덱스. create_absence_task_card 트리거의 ON CONFLICT와 일치해야 함';
