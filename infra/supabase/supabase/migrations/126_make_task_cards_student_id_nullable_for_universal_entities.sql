-- TaskCard 범용 엔티티 지원을 위한 student_id nullable 전환
-- 챗봇.md v1.2: 4.2.4 TaskCard 범용 엔티티 정합(P0)
--
-- 목적: tenant/billing/report/system 등 범용 entity_type을 지원하기 위해
-- student_id를 nullable로 전환하고 레거시 필드로 격하

-- ============================================================================
-- 1. 기존 CHECK 제약 확인 및 제거
-- ============================================================================
-- 113번 마이그레이션에서 추가된 CHECK 제약 제거
ALTER TABLE public.task_cards
DROP CONSTRAINT IF EXISTS task_cards_entity_consistency_check;

-- ============================================================================
-- 2. student_id 컬럼을 nullable로 변경
-- ============================================================================
-- student_id NOT NULL 제약이 있다면 제거
ALTER TABLE public.task_cards
ALTER COLUMN student_id DROP NOT NULL;

-- ============================================================================
-- 3. 새로운 CHECK 제약 추가 (레거시 호환)
-- ============================================================================
-- entity_type='student'이면 student_id = entity_id AND student_id NOT NULL
-- entity_type<>'student'이면 student_id IS NULL (범용 엔티티)
ALTER TABLE public.task_cards
ADD CONSTRAINT task_cards_entity_consistency_check_v2
CHECK (
  (entity_type = 'student' AND student_id = entity_id AND student_id IS NOT NULL)
  OR (entity_type <> 'student' AND student_id IS NULL)
);

-- ============================================================================
-- 4. 기존 데이터 정합성 확인 및 수정
-- ============================================================================
-- entity_type='student'이 아닌데 student_id가 있는 경우 수정
UPDATE public.task_cards
SET student_id = NULL
WHERE entity_type <> 'student' AND student_id IS NOT NULL;

-- entity_type='student'인데 student_id가 NULL인 경우 entity_id로 채움
UPDATE public.task_cards
SET student_id = entity_id
WHERE entity_type = 'student' AND student_id IS NULL;

-- ============================================================================
-- 5. COMMENT 업데이트
-- ============================================================================
COMMENT ON COLUMN public.task_cards.student_id IS
'학생 ID (레거시 필드, 하위 호환성 유지). entity_type=''student''인 경우 entity_id와 동일하며 필수. entity_type이 ''tenant'', ''billing'', ''report'', ''system'' 등일 때는 NULL.';

COMMENT ON CONSTRAINT task_cards_entity_consistency_check_v2 ON public.task_cards IS
'엔티티 일관성 검증: entity_type=''student''이면 student_id=entity_id AND student_id NOT NULL, 그 외는 student_id IS NULL';

-- ============================================================================
-- 마이그레이션 완료 로그
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ task_cards.student_id가 nullable로 전환되었습니다.';
  RAISE NOTICE '   - entity_type=''student''일 때만 student_id 필수';
  RAISE NOTICE '   - entity_type이 ''tenant'', ''billing'', ''report'', ''system'' 등일 때는 student_id=NULL';
  RAISE NOTICE '   - 범용 TaskCard 지원 가능';
END $$;

