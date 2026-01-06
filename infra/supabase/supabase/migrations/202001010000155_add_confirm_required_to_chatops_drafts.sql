-- ChatOps Draft에 confirm_required 컬럼 추가
-- [P1-UX-1] confirm 키워드 오작동 방지: confirm_required가 true일 때만 자동 confirm 허용

ALTER TABLE public.chatops_drafts
  ADD COLUMN IF NOT EXISTS confirm_required boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.chatops_drafts.confirm_required IS '실행 확인 필요 여부 (true일 때만 자동 confirm 허용)';

-- 기존 ready 상태의 draft는 모두 confirm_required=true로 설정 (기본값)
UPDATE public.chatops_drafts
SET confirm_required = true
WHERE confirm_required IS NULL;

