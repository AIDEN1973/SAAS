-- Migration: 149_backfill_chatops_session_summary
--
-- 목적: summary가 null인 기존 chatops_sessions에 첫 번째 사용자 메시지로 summary 채우기
-- 배경: chatops Edge Function이 세션 생성 시 summary를 null로 설정했고, 메시지 저장 시 업데이트하지 않았음
--       이제 Edge Function이 수정되었으므로, 기존 데이터를 백필해야 함
--
-- 주의: 이 마이그레이션은 한 번만 실행되며, 기존 null summary를 첫 사용자 메시지로 업데이트합니다.

-- summary가 null인 세션에 대해 첫 번째 사용자 메시지의 앞 50자를 summary로 설정
UPDATE chatops_sessions s
SET summary = (
  SELECT
    CASE
      WHEN LENGTH(m.content) > 50 THEN LEFT(m.content, 50) || '...'
      ELSE m.content
    END
  FROM chatops_messages m
  WHERE m.session_id = s.id
    AND m.role = 'user'
  ORDER BY m.created_at ASC
  LIMIT 1
)
WHERE s.summary IS NULL
  AND EXISTS (
    SELECT 1
    FROM chatops_messages m
    WHERE m.session_id = s.id AND m.role = 'user'
  );

-- 결과 확인용 (마이그레이션 로그에 표시됨)
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % chatops_sessions with summary from first user message', updated_count;
END $$;
