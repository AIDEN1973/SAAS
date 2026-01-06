-- P1-2: AI 인사이트 스키마 수정 - archived_at 필드 추가
-- 목적: 30일 이상 된 AI 인사이트 자동 아카이빙 지원
-- 아키텍처 문서 3.7.1: AI 인사이트는 30일 후 자동 아카이브

-- archived_at 컬럼 추가
ALTER TABLE ai_insights
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- 인덱스 추가 (archived_at 기반 쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_ai_insights_archived_at
  ON ai_insights(tenant_id, archived_at)
  WHERE archived_at IS NOT NULL;

-- 인덱스 추가 (활성 인사이트 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_ai_insights_active
  ON ai_insights(tenant_id, status, created_at DESC)
  WHERE status = 'active' AND archived_at IS NULL;

-- 코멘트 추가
COMMENT ON COLUMN ai_insights.archived_at IS '아카이브 시간 (30일 이상 된 인사이트는 자동 아카이브)';
