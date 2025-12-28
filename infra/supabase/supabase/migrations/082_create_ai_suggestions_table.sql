-- ⚠️ 레거시: 이 마이그레이션은 v2.x 시기의 레거시 테이블입니다.
-- v3.3 정본 규칙: StudentTaskCard (task_type: 'ai_suggested')로 통합되었습니다.
-- 이 테이블은 하위 호환성을 위해 유지되지만, 신규 코드에서는 사용하지 않습니다.
-- 프론트 자동화 문서 2.2 섹션 참조: "StudentTaskCard (task_type: 'ai_suggested')로 통합됨"
--
-- 마이그레이션 가이드:
-- - ai_suggestions 테이블 → student_task_cards 테이블 사용
-- - useAISuggestion() → useStudentTaskCards() 사용
-- - AISuggestionCard → StudentTaskCard 사용

-- StudentTaskCard (task_type: 'ai_suggested') 테이블 생성 (레거시)
-- Zero-Management Platform: StudentTaskCard (task_type: 'ai_suggested') (Level 2) 승인 메커니즘
-- 아키텍처 문서 1.7, Zero-Management 프론트엔드 기능 설계 문서 참조

CREATE TABLE IF NOT EXISTS ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  suggestion_type text NOT NULL, -- 'message_draft', 'consultation_recommendation', 'analysis_request', 'attendance_followup'
  title text NOT NULL,
  summary text NOT NULL,
  suggested_action jsonb NOT NULL, -- 액션 정의 (메시지 초안, 분석 요청 등)
  context_data jsonb, -- 제안 근거 데이터
  priority integer DEFAULT 5, -- 1-10, 높을수록 우선순위 높음
  status text DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'executed'
  created_at timestamptz DEFAULT now(),
  executed_at timestamptz,
  user_feedback text, -- 사용자 피드백
  dismissed_at timestamptz, -- 사용자가 무시한 시간
  CONSTRAINT ai_suggestions_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'executed')),
  CONSTRAINT ai_suggestions_priority_check CHECK (priority >= 1 AND priority <= 10)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_tenant_status ON ai_suggestions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_priority ON ai_suggestions(tenant_id, priority DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_type ON ai_suggestions(tenant_id, suggestion_type, status);

-- RLS 정책
ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (재실행 시 오류 방지)
DROP POLICY IF EXISTS ai_suggestions_tenant_isolation ON ai_suggestions;
DROP POLICY IF EXISTS ai_suggestions_select ON ai_suggestions;
DROP POLICY IF EXISTS ai_suggestions_insert ON ai_suggestions;
DROP POLICY IF EXISTS ai_suggestions_update ON ai_suggestions;
DROP POLICY IF EXISTS ai_suggestions_delete ON ai_suggestions;

-- ⚠️ 레거시 테이블: JWT claim 기반 RLS 정책으로 수정 (일관성 유지)
-- 테넌트별 데이터 격리 (JWT claim 기반, PgBouncer Transaction Pooling 호환)
CREATE POLICY ai_suggestions_tenant_isolation ON ai_suggestions
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- 읽기 권한 (테넌트 내 모든 역할, JWT claim 기반)
CREATE POLICY ai_suggestions_select ON ai_suggestions
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- 쓰기 권한 (Admin, Owner, Sub Admin만, JWT claim 기반)
CREATE POLICY ai_suggestions_insert ON ai_suggestions
  FOR INSERT
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (
      ((auth.jwt() ->> 'role'::text)) IN ('admin', 'owner', 'sub_admin')
      OR
      -- 시스템이 생성하는 경우 (service_role)
      ((auth.jwt() ->> 'role'::text)) = 'service_role'
    )
  );

-- 수정 권한 (Admin, Owner, Sub Admin만, JWT claim 기반)
CREATE POLICY ai_suggestions_update ON ai_suggestions
  FOR UPDATE
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND ((auth.jwt() ->> 'role'::text)) IN ('admin', 'owner', 'sub_admin')
  );

-- 삭제 권한 (Admin, Owner만, JWT claim 기반)
CREATE POLICY ai_suggestions_delete ON ai_suggestions
  FOR DELETE
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND ((auth.jwt() ->> 'role'::text)) IN ('admin', 'owner')
  );

-- PostgREST 노출
COMMENT ON TABLE ai_suggestions IS 'StudentTaskCard (task_type: ''ai_suggested'') 추천 액션 (Level 2, 레거시)';
COMMENT ON COLUMN ai_suggestions.suggestion_type IS '제안 타입: message_draft, consultation_recommendation, analysis_request, attendance_followup';
COMMENT ON COLUMN ai_suggestions.suggested_action IS '제안된 액션 정의 (JSON)';
COMMENT ON COLUMN ai_suggestions.context_data IS '제안 근거 데이터 (JSON)';
COMMENT ON COLUMN ai_suggestions.priority IS '우선순위 (1-10, 높을수록 긴급)';
COMMENT ON COLUMN ai_suggestions.status IS '상태: pending, approved, rejected, executed';

