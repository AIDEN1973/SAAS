-- TaskCard 리마인드 기능 필드 추가 마이그레이션
-- StudentTaskCard "나중에" 버튼 기능을 위한 필드 추가
-- snoozed_at: 카드가 숨겨진 시각
-- remind_at: 카드가 다시 표시될 시각

-- snoozed_at 컬럼 추가 (카드 숨김 시각)
ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS snoozed_at TIMESTAMPTZ;

COMMENT ON COLUMN task_cards.snoozed_at IS '카드가 숨겨진 시각 (리마인드 기능)';

-- remind_at 컬럼 추가 (리마인드 시각)
ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS remind_at TIMESTAMPTZ;

COMMENT ON COLUMN task_cards.remind_at IS '카드가 다시 표시될 시각 (리마인드 기능)';

-- remind_at 인덱스 생성 (리마인드 시간 기반 필터링 최적화)
CREATE INDEX IF NOT EXISTS idx_task_cards_remind_at
ON task_cards(tenant_id, remind_at)
WHERE remind_at IS NOT NULL;

COMMENT ON INDEX idx_task_cards_remind_at IS '리마인드 시간 기반 필터링 최적화 인덱스';

