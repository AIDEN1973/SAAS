-- ChatOps Draft에 resolve_snapshot 컬럼 추가
-- 실행 스냅샷 저장: draft 생성 시점의 intentCandidates 정보를 저장

ALTER TABLE public.chatops_drafts
  ADD COLUMN IF NOT EXISTS resolve_snapshot jsonb DEFAULT NULL;

COMMENT ON COLUMN public.chatops_drafts.resolve_snapshot IS 'Intent 후보 추출 시점의 스냅샷 (intentCandidates 정보)';

