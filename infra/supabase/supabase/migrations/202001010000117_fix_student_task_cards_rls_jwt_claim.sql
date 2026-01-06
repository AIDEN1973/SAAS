/**
 * task_cards 테이블 RLS 정책 JWT claim 기반 마이그레이션
 *
 * [불변 규칙] PgBouncer Transaction Pooling 환경에서는 JWT claim 기반 RLS를 사용합니다.
 * [불변 규칙] user_tenant_roles 조인 패턴은 레거시이며, JWT claim 기반으로 마이그레이션합니다.
 *
 * 기술문서: docu/전체 기술문서.txt "RLS tenant 판별 방식 혼재 문제" 섹션 참조
 *
 * ⚠️ 주의: 이 마이그레이션은 113번 마이그레이션(RENAME) 이전에 실행되었을 수 있습니다.
 * 113번 마이그레이션에서 정책명이 task_cards_read/task_cards_write로 변경되므로,
 * 이 파일은 레거시 참고용으로만 유지됩니다.
 */

-- ============================================================================
-- task_cards 테이블 RLS 정책 (JWT claim 기반)
-- ============================================================================
-- ⚠️ 주의: 113번 마이그레이션에서 이미 정책명이 변경되었을 수 있습니다.
-- 이 파일은 레거시 참고용입니다.
DROP POLICY IF EXISTS student_task_cards_read ON public.task_cards;
DROP POLICY IF EXISTS student_task_cards_write ON public.task_cards;

-- 읽기 정책: JWT claim 기반 (super_admin 우회 포함)
DROP POLICY IF EXISTS task_cards_read ON public.task_cards;
CREATE POLICY task_cards_read ON public.task_cards
FOR SELECT TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- 쓰기 정책: JWT claim 기반 (super_admin 우회 포함)
DROP POLICY IF EXISTS task_cards_write ON public.task_cards;
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
-- 마이그레이션 완료 로그
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ task_cards 테이블 RLS 정책이 JWT claim 기반으로 마이그레이션되었습니다.';
  RAISE NOTICE '   - task_cards_read: JWT claim 기반으로 마이그레이션 완료';
  RAISE NOTICE '   - task_cards_write: JWT claim 기반으로 마이그레이션 완료';
END $$;

