-- task_cards 테이블의 task_type CHECK 제약조건 강제 수정
-- 목적: 'ai_suggested'를 허용하도록 제약조건 업데이트
-- 작성일: 2025-12-27

-- ============================================================================
-- 1. 모든 가능한 이름의 CHECK 제약 제거
-- ============================================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.task_cards'::regclass
      AND contype = 'c'
      AND conname LIKE '%task_type%'
  LOOP
    EXECUTE 'ALTER TABLE public.task_cards DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    RAISE NOTICE 'Dropped constraint: %', r.conname;
  END LOOP;
END $$;

-- ============================================================================
-- 2. 새로운 CHECK 제약 추가 (ai_suggested 포함)
-- ============================================================================
-- 문서 정본: task_type: 'ai_suggested' | 'risk' | 'absence' | 'counseling' | 'new_signup'
ALTER TABLE public.task_cards
ADD CONSTRAINT task_cards_task_type_check
CHECK (task_type IN ('ai_suggested', 'risk', 'absence', 'counseling', 'new_signup'));

COMMENT ON CONSTRAINT task_cards_task_type_check ON public.task_cards IS
'task_type 허용 값: ai_suggested, risk, absence, counseling, new_signup';

-- ============================================================================
-- 마이그레이션 완료 로그
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ task_cards.task_type CHECK 제약조건이 강제 수정되었습니다.';
  RAISE NOTICE '   - ai_suggested 값이 허용됩니다.';
END $$;

