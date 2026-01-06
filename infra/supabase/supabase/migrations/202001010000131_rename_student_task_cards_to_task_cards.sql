/**
 * student_task_cards 테이블을 task_cards로 RENAME 및 업종 중립화
 *
 * 풀스케일 통합: student_task_cards(학생 특화)를 업종 중립 task_cards(정본)로 승격
 * entity_id/entity_type 기반으로 통합하며, 기존 student_task_cards는 하위호환(VIEW)로 유지
 *
 * [불변 규칙] RLS는 JWT claim 기반만 사용
 * [불변 규칙] 하위 호환성 유지: student_id 컬럼은 레거시로 유지
 */

-- ============================================================================
-- 1. 테이블 RENAME
-- ============================================================================
ALTER TABLE public.student_task_cards RENAME TO task_cards;

-- ============================================================================
-- 2. entity_id/entity_type 컬럼 추가
-- ============================================================================
-- entity_id 컬럼 추가 (초기엔 NULL 허용, 백필 후 NOT NULL)
ALTER TABLE public.task_cards
ADD COLUMN IF NOT EXISTS entity_id UUID;

-- entity_type 컬럼 추가 (기본값 'student'로 설정)
ALTER TABLE public.task_cards
ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT 'student';

-- ============================================================================
-- 3. 기존 데이터 백필
-- ============================================================================
-- student_id가 있는 경우 entity_id와 entity_type을 설정
UPDATE public.task_cards
SET
  entity_id = COALESCE(entity_id, student_id),
  entity_type = COALESCE(entity_type, 'student')
WHERE entity_id IS NULL OR entity_type IS NULL;

-- ============================================================================
-- 4. 정합성 제약 추가
-- ============================================================================
-- entity_type='student'이면 student_id = entity_id AND student_id NOT NULL
-- entity_type<>'student'이면 student_id IS NULL
ALTER TABLE public.task_cards
ADD CONSTRAINT task_cards_entity_consistency_check
CHECK (
  (entity_type = 'student' AND student_id = entity_id AND student_id IS NOT NULL)
  OR (entity_type <> 'student' AND student_id IS NULL)
);

-- entity_id를 NOT NULL로 변경 (백필 완료 후)
ALTER TABLE public.task_cards
ALTER COLUMN entity_id SET NOT NULL;

-- ============================================================================
-- 5. 인덱스명 변경
-- ============================================================================
-- dedup_key 인덱스명 변경
ALTER INDEX IF EXISTS idx_student_task_cards_dedup_key
RENAME TO idx_task_cards_dedup_key;

ALTER INDEX IF EXISTS ux_student_task_cards_dedup_key
RENAME TO ux_task_cards_dedup_key;

-- ============================================================================
-- 6. RLS 정책명 변경
-- ============================================================================
-- 기존 정책 삭제
DROP POLICY IF EXISTS student_task_cards_read ON public.task_cards;
DROP POLICY IF EXISTS student_task_cards_write ON public.task_cards;

-- 새로운 정책명으로 생성
CREATE POLICY task_cards_read ON public.task_cards
FOR SELECT TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY task_cards_write ON public.task_cards
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

COMMENT ON POLICY task_cards_read ON public.task_cards IS
'테넌트 격리: JWT claim 기반 RLS (PgBouncer Transaction Pooling 호환)';
COMMENT ON POLICY task_cards_write ON public.task_cards IS
'테넌트 격리: JWT claim 기반 RLS (PgBouncer Transaction Pooling 호환)';

-- ============================================================================
-- 7. 테이블 COMMENT 업데이트
-- ============================================================================
COMMENT ON TABLE public.task_cards IS
'업무 카드 테이블 (정본, 업종 중립). student_task_cards는 하위 호환 VIEW로 유지됨.';

COMMENT ON COLUMN public.task_cards.entity_id IS
'엔티티 ID (업종 중립). entity_type이 ''student''인 경우 student_id와 동일.';
COMMENT ON COLUMN public.task_cards.entity_type IS
'엔티티 타입 (업종 중립). 예: ''student'', ''client'', ''customer'' 등.';
COMMENT ON COLUMN public.task_cards.student_id IS
'학생 ID (레거시 필드, 하위 호환성 유지). entity_type=''student''인 경우 entity_id와 동일.';

-- ============================================================================
-- 마이그레이션 완료 로그
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ student_task_cards 테이블이 task_cards로 RENAME되었습니다.';
  RAISE NOTICE '   - entity_id, entity_type 컬럼 추가 완료';
  RAISE NOTICE '   - 기존 데이터 백필 완료';
  RAISE NOTICE '   - 인덱스명 변경 완료';
  RAISE NOTICE '   - RLS 정책명 변경 완료';
  RAISE NOTICE '   - 다음 단계: student_task_cards VIEW 생성 (114번 마이그레이션)';
END $$;

