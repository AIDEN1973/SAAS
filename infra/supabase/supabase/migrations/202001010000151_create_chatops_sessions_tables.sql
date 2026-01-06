-- ChatOps 세션 및 메시지 테이블 생성
-- 목적: ChatOps 대화의 맥락 유지 및 새로고침 시 대화 복원
-- [불변 규칙] SSOT/Zero-Trust/Fail-Closed 준수: tenant_id/user_id는 JWT에서 추출 (프론트에서 받지 않음)

-- 1. chatops_sessions 테이블
CREATE TABLE IF NOT EXISTS public.chatops_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), -- session_id (프론트에서 생성한 UUID)
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary text, -- 대화 요약 (최대 2000자, 메시지가 많을 때만 업데이트)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_chatops_sessions_tenant_user_updated
  ON public.chatops_sessions(tenant_id, user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatops_sessions_id
  ON public.chatops_sessions(id);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_chatops_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_chatops_sessions_updated_at
  BEFORE UPDATE ON public.chatops_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_chatops_sessions_updated_at();

-- 2. chatops_messages 테이블
CREATE TABLE IF NOT EXISTS public.chatops_messages (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.chatops_sessions(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_chatops_messages_session_created
  ON public.chatops_messages(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatops_messages_tenant_user_created
  ON public.chatops_messages(tenant_id, user_id, created_at DESC);

-- RLS 정책 활성화
ALTER TABLE public.chatops_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatops_messages ENABLE ROW LEVEL SECURITY;

-- RLS 정책: chatops_sessions
-- [Zero-Trust] tenant_id와 user_id는 JWT에서 추출한 값과 일치해야 함
CREATE POLICY "chatops_sessions_select_policy" ON public.chatops_sessions
  FOR SELECT
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::jsonb->>'tenant_id')::uuid
    AND user_id = auth.uid()
  );

CREATE POLICY "chatops_sessions_insert_policy" ON public.chatops_sessions
  FOR INSERT
  WITH CHECK (
    tenant_id = (current_setting('request.jwt.claims', true)::jsonb->>'tenant_id')::uuid
    AND user_id = auth.uid()
  );

CREATE POLICY "chatops_sessions_update_policy" ON public.chatops_sessions
  FOR UPDATE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::jsonb->>'tenant_id')::uuid
    AND user_id = auth.uid()
  );

-- RLS 정책: chatops_messages
CREATE POLICY "chatops_messages_select_policy" ON public.chatops_messages
  FOR SELECT
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::jsonb->>'tenant_id')::uuid
    AND user_id = auth.uid()
  );

CREATE POLICY "chatops_messages_insert_policy" ON public.chatops_messages
  FOR INSERT
  WITH CHECK (
    tenant_id = (current_setting('request.jwt.claims', true)::jsonb->>'tenant_id')::uuid
    AND user_id = auth.uid()
  );

-- ⚠️ 중요: Edge Function은 service_role을 사용하므로 RLS를 우회합니다.
-- Edge Function 내부에서는 직접 INSERT/UPDATE를 수행하며, tenant_id/user_id는 JWT에서 추출한 값을 사용합니다.

