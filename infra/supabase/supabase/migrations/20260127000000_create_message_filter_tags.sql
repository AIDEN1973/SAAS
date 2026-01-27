-- ============================================================================
-- 메시지 필터 태그 테이블 생성
-- 태그 기반 회원 필터링 + 수동 메시지 발송 시스템
-- ============================================================================

-- 1. 메시지 필터 태그 테이블 생성
CREATE TABLE IF NOT EXISTS message_filter_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 태그 기본 정보
  name TEXT NOT NULL,
  display_label TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('popular', 'attendance', 'billing', 'enrollment', 'academic', 'combined', 'class', 'status')),
  color TEXT DEFAULT '#E5E7EB',
  icon TEXT,

  -- 필터링 조건
  condition_type TEXT NOT NULL,
  condition_params JSONB DEFAULT '{}'::jsonb,

  -- 메타데이터
  is_active BOOLEAN DEFAULT true,
  is_system_default BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,

  -- 감사 로그
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),

  -- 제약 조건
  CONSTRAINT message_filter_tags_unique_name_per_tenant UNIQUE (tenant_id, name)
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_message_filter_tags_tenant_category
  ON message_filter_tags(tenant_id, category, is_active);

CREATE INDEX IF NOT EXISTS idx_message_filter_tags_tenant_active
  ON message_filter_tags(tenant_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_message_filter_tags_usage
  ON message_filter_tags(tenant_id, usage_count DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_message_filter_tags_condition_type
  ON message_filter_tags(tenant_id, condition_type);

-- 3. RLS 활성화 및 정책 생성
ALTER TABLE message_filter_tags ENABLE ROW LEVEL SECURITY;

-- 조회 정책 (auth.jwt() 사용 - 다른 테이블과 동일한 패턴)
CREATE POLICY "message_filter_tags_select_policy"
  ON message_filter_tags
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- 삽입 정책
CREATE POLICY "message_filter_tags_insert_policy"
  ON message_filter_tags
  FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- 업데이트 정책
CREATE POLICY "message_filter_tags_update_policy"
  ON message_filter_tags
  FOR UPDATE
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- 삭제 정책
CREATE POLICY "message_filter_tags_delete_policy"
  ON message_filter_tags
  FOR DELETE
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- 4. updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_message_filter_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_message_filter_tags_updated_at
  BEFORE UPDATE ON message_filter_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_message_filter_tags_updated_at();

-- 5. 코멘트 추가
COMMENT ON TABLE message_filter_tags IS '메시지 발송을 위한 회원 필터 태그';
COMMENT ON COLUMN message_filter_tags.condition_type IS '필터 조건 타입 (예: attendance.consecutive_late_3days)';
COMMENT ON COLUMN message_filter_tags.condition_params IS '필터 조건 파라미터 (JSONB)';
COMMENT ON COLUMN message_filter_tags.usage_count IS '태그 사용 횟수 (인기 태그 정렬용)';
COMMENT ON COLUMN message_filter_tags.is_system_default IS '시스템 기본 태그 여부';
