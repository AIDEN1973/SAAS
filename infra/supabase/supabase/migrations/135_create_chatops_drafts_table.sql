-- ChatOps Draft 상태 머신 테이블
-- Inline Execution에서 필드 수집 및 실행 전 상태 관리
-- SSOT: 서버(DB)가 정본, 프론트는 UI 캐시만 사용

CREATE TABLE IF NOT EXISTS public.chatops_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.chatops_sessions(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  intent_key text NOT NULL,
  status text NOT NULL DEFAULT 'collecting' CHECK (status IN ('collecting', 'ready', 'executed', 'cancelled')),
  draft_params jsonb NOT NULL DEFAULT '{}',
  missing_required jsonb NOT NULL DEFAULT '[]', -- 필수 필드 누락 목록
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_chatops_drafts_session_updated
  ON public.chatops_drafts(session_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chatops_drafts_tenant_user_updated
  ON public.chatops_drafts(tenant_id, user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chatops_drafts_status
  ON public.chatops_drafts(status) WHERE status IN ('collecting', 'ready');

-- RLS 정책 (Zero-Trust: tenant_id/user_id 일치만 허용)
ALTER TABLE public.chatops_drafts ENABLE ROW LEVEL SECURITY;

-- SELECT 정책
CREATE POLICY "chatops_drafts_select_policy" ON public.chatops_drafts
  FOR SELECT
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::jsonb->>'tenant_id')::uuid
    AND user_id = auth.uid()
  );

-- INSERT 정책
CREATE POLICY "chatops_drafts_insert_policy" ON public.chatops_drafts
  FOR INSERT
  WITH CHECK (
    tenant_id = (current_setting('request.jwt.claims', true)::jsonb->>'tenant_id')::uuid
    AND user_id = auth.uid()
  );

-- UPDATE 정책
CREATE POLICY "chatops_drafts_update_policy" ON public.chatops_drafts
  FOR UPDATE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::jsonb->>'tenant_id')::uuid
    AND user_id = auth.uid()
  )
  WITH CHECK (
    tenant_id = (current_setting('request.jwt.claims', true)::jsonb->>'tenant_id')::uuid
    AND user_id = auth.uid()
  );

-- DELETE 정책 (필요시)
CREATE POLICY "chatops_drafts_delete_policy" ON public.chatops_drafts
  FOR DELETE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::jsonb->>'tenant_id')::uuid
    AND user_id = auth.uid()
  );

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_chatops_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chatops_drafts_updated_at_trigger
  BEFORE UPDATE ON public.chatops_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_chatops_drafts_updated_at();

COMMENT ON TABLE public.chatops_drafts IS 'ChatOps Inline Execution Draft 상태 머신 (SSOT)';
COMMENT ON COLUMN public.chatops_drafts.status IS 'Draft 상태: collecting(수집 중), ready(실행 준비), executed(실행 완료), cancelled(취소)';
COMMENT ON COLUMN public.chatops_drafts.draft_params IS '수집된 파라미터 (JSONB)';
COMMENT ON COLUMN public.chatops_drafts.missing_required IS '누락된 필수 필드 목록 (JSONB 배열)';

