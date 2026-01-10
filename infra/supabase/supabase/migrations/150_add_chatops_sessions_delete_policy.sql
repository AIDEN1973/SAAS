-- Migration: 150_add_chatops_sessions_delete_policy
--
-- 목적: chatops_sessions 및 chatops_messages 테이블에 DELETE 정책 추가
-- 배경: 134 마이그레이션에서 DELETE 정책이 누락되어 세션 삭제가 작동하지 않음
--
-- 주의: RLS가 활성화된 상태에서 DELETE 정책이 없으면 anon/authenticated 역할의 DELETE 요청이 차단됨

-- chatops_sessions DELETE 정책 추가
CREATE POLICY "chatops_sessions_delete_policy" ON public.chatops_sessions
  FOR DELETE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::jsonb->>'tenant_id')::uuid
    AND user_id = auth.uid()
  );

-- chatops_messages DELETE 정책 추가 (직접 삭제는 거의 없지만 일관성 유지)
CREATE POLICY "chatops_messages_delete_policy" ON public.chatops_messages
  FOR DELETE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::jsonb->>'tenant_id')::uuid
    AND user_id = auth.uid()
  );

-- 결과 확인용
DO $$
BEGIN
  RAISE NOTICE 'Added DELETE policies for chatops_sessions and chatops_messages';
END $$;
