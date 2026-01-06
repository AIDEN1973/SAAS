-- Migration: Add intent fields to chatops_messages table
-- Description: ChatOps 메시지에 Intent 정보 저장을 위한 컬럼 추가
-- Date: 2025-01-28

-- chatops_messages 테이블에 Intent 정보 컬럼 추가
-- Assistant 응답에 Intent 정보를 저장하여 대화 맥락 추적 및 분석 가능

ALTER TABLE public.chatops_messages
  ADD COLUMN IF NOT EXISTS intent_key text,
  ADD COLUMN IF NOT EXISTS automation_level text CHECK (automation_level IN ('L0', 'L1', 'L2')),
  ADD COLUMN IF NOT EXISTS execution_class text CHECK (execution_class IN ('A', 'B'));

-- 인덱스 생성 (Intent 기반 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_chatops_messages_intent_key
  ON public.chatops_messages(intent_key)
  WHERE intent_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chatops_messages_automation_level
  ON public.chatops_messages(automation_level)
  WHERE automation_level IS NOT NULL;

-- 주석 추가
COMMENT ON COLUMN public.chatops_messages.intent_key IS 'Intent 키 (예: student.exec.discharge)';
COMMENT ON COLUMN public.chatops_messages.automation_level IS '자동화 레벨: L0(조회), L1(단순 실행), L2(복잡한 실행)';
COMMENT ON COLUMN public.chatops_messages.execution_class IS '실행 클래스: A(자동 실행), B(승인 필요) - L2일 때만 존재';

