-- TaskCard v3.3 필드 추가 마이그레이션
-- 프론트 자동화 문서 2.2 섹션 참조
-- TaskCard (task_type: 'ai_suggested', entity_type='student') 통합을 위한 필수 필드 추가
-- ⚠️ 주의: 이 마이그레이션은 113번 마이그레이션(RENAME) 이전에 실행되었을 수 있습니다.
-- 113번 마이그레이션에서 테이블명이 task_cards로 변경되므로, 이 파일은 레거시 참고용으로만 유지됩니다.

-- source 컬럼 (선택적, TaskCard (task_type: 'ai_suggested') 근거)
ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS source TEXT;

COMMENT ON COLUMN task_cards.source IS 'TaskCard (task_type: ''ai_suggested'') 근거: attendance, billing, behavior, weather, proactive_analysis';

-- suggested_action 컬럼 (선택적, 액션 정의)
ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS suggested_action JSONB;

COMMENT ON COLUMN task_cards.suggested_action IS '액션 정의 (메시지 초안, 분석 요청 등, JSON)';

-- status 컬럼 (선택적, 승인 상태, 기본값: 'pending')
ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

ALTER TABLE task_cards
DROP CONSTRAINT IF EXISTS student_task_cards_status_check;
ALTER TABLE task_cards
DROP CONSTRAINT IF EXISTS task_cards_status_check;

ALTER TABLE task_cards
ADD CONSTRAINT task_cards_status_check
CHECK (status IN ('pending', 'approved', 'executed', 'expired'));

COMMENT ON COLUMN task_cards.status IS '승인 상태: pending, approved, executed, expired';

-- dedup_key 컬럼 (선택적, 중복 방지)
ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS dedup_key TEXT;

COMMENT ON COLUMN task_cards.dedup_key IS '중복 방지 키: "{tenantId}:{trigger}:{entityType}:{entityId}:{window}"';

-- dedup_key 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_task_cards_dedup_key
ON task_cards(tenant_id, dedup_key)
WHERE dedup_key IS NOT NULL;

-- 유니크 제약조건 (필수, DB 레벨 중복 방지)
-- ⚠️ 중요: 이 제약조건은 프론트 규칙이 아닌 DB 강제 규칙으로, 중복 카드/레이스 컨디션을 원천 차단합니다.
-- Supabase JS SDK upsert 호환: unique index 생성 (PostgreSQL에서 unique index는 unique constraint와 동일하게 작동)
DROP INDEX IF EXISTS ux_student_task_cards_dedup_key;
DROP INDEX IF EXISTS ux_task_cards_dedup_key;

CREATE UNIQUE INDEX IF NOT EXISTS ux_task_cards_dedup_key
ON task_cards(tenant_id, dedup_key)
WHERE dedup_key IS NOT NULL AND status = 'pending';

-- 추가 권장 컬럼 (감사/추적용)
ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ;

ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS severity TEXT; -- 'low', 'medium', 'high', 'critical'

ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS confidence NUMERIC; -- AI 신뢰도 (0-100)

COMMENT ON COLUMN task_cards.approved_by IS '승인자 ID (Teacher의 request-approval인 경우)';
COMMENT ON COLUMN task_cards.approved_at IS '승인 시각';
COMMENT ON COLUMN task_cards.executed_at IS '실행 시각';
COMMENT ON COLUMN task_cards.updated_at IS '최종 수정 시각';
COMMENT ON COLUMN task_cards.rejected_reason IS '거부 사유';
COMMENT ON COLUMN task_cards.severity IS '심각도: low, medium, high, critical';
COMMENT ON COLUMN task_cards.confidence IS 'AI 신뢰도 (0-100)';

-- task_type에 'ai_suggested' 추가 (CHECK 제약조건이 있다면 업데이트 필요)
-- 기존 CHECK 제약조건 확인 및 업데이트는 별도로 수행

