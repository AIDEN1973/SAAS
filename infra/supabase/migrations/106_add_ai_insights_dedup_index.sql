-- ai_insights 테이블 중복 방지 인덱스 추가
-- 동일한 날짜/타입/제목의 insight 중복 방지를 위한 인덱스
-- AI_자동화_기능_정리.md Section 10.5 (멱등성/중복 방지) 참조

-- ⚠️ 참고: ai_insights 테이블에는 dedup_key 컬럼이 없으므로,
-- title과 created_at 날짜를 조합하여 중복을 방지합니다.
-- ai-briefing-generation이 매일 07:00에 오늘 날짜의 daily_briefing 레코드를 삭제하므로,
-- 이후 실행되는 함수들은 중복이 발생하지 않을 수 있지만, 명시적 중복 방지를 위해 인덱스를 추가합니다.

-- 인덱스 생성 (tenant_id, insight_type, title, created_at 날짜 기준)
-- 동일한 날짜에 동일한 title의 insight가 중복 생성되지 않도록 합니다.
-- ⚠️ 중요: timestamptz는 타임존에 따라 결과가 달라질 수 있으므로, UTC로 고정하여 IMMUTABLE 보장
CREATE INDEX IF NOT EXISTS idx_ai_insights_tenant_type_title_date
ON public.ai_insights(tenant_id, insight_type, title, date_trunc('day', created_at AT TIME ZONE 'UTC'));

-- ⚠️ 참고: unique constraint는 추가하지 않습니다.
-- 이유: 동일한 날짜에 여러 개의 insight가 생성될 수 있기 때문입니다.
-- 대신, 각 Edge Function에서 insert 전에 기존 레코드를 삭제하거나,
-- title과 날짜를 조합하여 중복을 방지하는 로직을 구현해야 합니다.

COMMENT ON INDEX idx_ai_insights_tenant_type_title_date IS 'ai_insights 중복 방지 인덱스 (tenant_id, insight_type, title, created_at 날짜 기준)';

