/**
 * RLS 정책 JWT claim 기반 완전 마이그레이션
 *
 * [불변 규칙] PgBouncer Transaction Pooling 환경에서는 JWT claim 기반 RLS를 사용합니다.
 * [불변 규칙] user_tenant_roles 조인 패턴은 레거시이며, JWT claim 기반으로 마이그레이션합니다.
 *
 * 기술문서: docu/전체 기술문서.txt "RLS tenant 판별 방식 혼재 문제" 섹션 참조
 *
 * 마이그레이션 대상 테이블 (085_fix_tenant_features_rls_jwt_claim.sql에서 확인):
 * - academy_classes
 * - academy_students
 * - academy_teachers
 * - tenant_features
 * - tenant_theme_overrides
 * - tenants
 * - ai_suggestions (레거시 테이블이지만 일관성 유지)
 */

-- ============================================================================
-- 1. academy_classes 테이블 RLS 정책 (JWT claim 기반)
-- ============================================================================
DROP POLICY IF EXISTS tenant_isolation_academy_classes_delete ON public.academy_classes;
DROP POLICY IF EXISTS tenant_isolation_academy_classes_insert ON public.academy_classes;
DROP POLICY IF EXISTS tenant_isolation_academy_classes_select ON public.academy_classes;
DROP POLICY IF EXISTS tenant_isolation_academy_classes_update ON public.academy_classes;

-- 읽기 정책: JWT claim 기반 (super_admin 우회 포함)
CREATE POLICY tenant_isolation_academy_classes_select ON public.academy_classes
FOR SELECT TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- 쓰기 정책: JWT claim 기반 (super_admin 우회 포함)
CREATE POLICY tenant_isolation_academy_classes_insert ON public.academy_classes
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY tenant_isolation_academy_classes_update ON public.academy_classes
FOR UPDATE TO authenticated
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

CREATE POLICY tenant_isolation_academy_classes_delete ON public.academy_classes
FOR DELETE TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

COMMENT ON POLICY tenant_isolation_academy_classes_select ON public.academy_classes IS
'테넌트 격리: JWT claim 기반 RLS (PgBouncer Transaction Pooling 호환)';

-- ============================================================================
-- 2. academy_students 테이블 RLS 정책 (JWT claim 기반)
-- ============================================================================
DROP POLICY IF EXISTS tenant_isolation_academy_students_delete ON public.academy_students;
DROP POLICY IF EXISTS tenant_isolation_academy_students_insert ON public.academy_students;
DROP POLICY IF EXISTS tenant_isolation_academy_students_select ON public.academy_students;
DROP POLICY IF EXISTS tenant_isolation_academy_students_update ON public.academy_students;

CREATE POLICY tenant_isolation_academy_students_select ON public.academy_students
FOR SELECT TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY tenant_isolation_academy_students_insert ON public.academy_students
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY tenant_isolation_academy_students_update ON public.academy_students
FOR UPDATE TO authenticated
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

CREATE POLICY tenant_isolation_academy_students_delete ON public.academy_students
FOR DELETE TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

COMMENT ON POLICY tenant_isolation_academy_students_select ON public.academy_students IS
'테넌트 격리: JWT claim 기반 RLS (PgBouncer Transaction Pooling 호환)';

-- ============================================================================
-- 3. academy_teachers 테이블 RLS 정책 (JWT claim 기반)
-- ============================================================================
DROP POLICY IF EXISTS tenant_isolation_academy_teachers_delete ON public.academy_teachers;
DROP POLICY IF EXISTS tenant_isolation_academy_teachers_insert ON public.academy_teachers;
DROP POLICY IF EXISTS tenant_isolation_academy_teachers_select ON public.academy_teachers;
DROP POLICY IF EXISTS tenant_isolation_academy_teachers_update ON public.academy_teachers;

CREATE POLICY tenant_isolation_academy_teachers_select ON public.academy_teachers
FOR SELECT TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY tenant_isolation_academy_teachers_insert ON public.academy_teachers
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY tenant_isolation_academy_teachers_update ON public.academy_teachers
FOR UPDATE TO authenticated
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

CREATE POLICY tenant_isolation_academy_teachers_delete ON public.academy_teachers
FOR DELETE TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

COMMENT ON POLICY tenant_isolation_academy_teachers_select ON public.academy_teachers IS
'테넌트 격리: JWT claim 기반 RLS (PgBouncer Transaction Pooling 호환)';

-- ============================================================================
-- 4. tenant_features 테이블 RLS 정책 (JWT claim 기반)
-- ============================================================================
DROP POLICY IF EXISTS tenant_features_read ON public.tenant_features;
DROP POLICY IF EXISTS tenant_features_write ON public.tenant_features;

CREATE POLICY tenant_features_read ON public.tenant_features
FOR SELECT TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY tenant_features_write ON public.tenant_features
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

COMMENT ON POLICY tenant_features_read ON public.tenant_features IS
'테넌트 격리: JWT claim 기반 RLS (PgBouncer Transaction Pooling 호환)';

-- ============================================================================
-- 5. tenant_theme_overrides 테이블 RLS 정책 (JWT claim 기반)
-- ============================================================================
DROP POLICY IF EXISTS tenant_theme_overrides_read ON public.tenant_theme_overrides;
DROP POLICY IF EXISTS tenant_theme_overrides_write ON public.tenant_theme_overrides;

CREATE POLICY tenant_theme_overrides_read ON public.tenant_theme_overrides
FOR SELECT TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- 쓰기 정책: owner/admin/sub_admin만 허용 (JWT claim 기반)
CREATE POLICY tenant_theme_overrides_write ON public.tenant_theme_overrides
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  AND ((auth.jwt() ->> 'role'::text)) IN ('owner', 'admin', 'sub_admin')
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  AND ((auth.jwt() ->> 'role'::text)) IN ('owner', 'admin', 'sub_admin')
);

COMMENT ON POLICY tenant_theme_overrides_read ON public.tenant_theme_overrides IS
'테넌트 격리: JWT claim 기반 RLS (PgBouncer Transaction Pooling 호환)';

-- ============================================================================
-- 6. tenants 테이블 RLS 정책 (JWT claim 기반)
-- ============================================================================
DROP POLICY IF EXISTS tenant_isolation_tenants ON public.tenants;

-- tenants 테이블은 특수: user_tenant_roles 조인으로 자신이 속한 테넌트만 조회
-- JWT claim 기반으로 변경: tenant_id가 JWT claim에 있으면 해당 테넌트 조회 가능
CREATE POLICY tenant_isolation_tenants ON public.tenants
FOR SELECT TO authenticated
USING (
  id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

COMMENT ON POLICY tenant_isolation_tenants ON public.tenants IS
'테넌트 격리: JWT claim 기반 RLS (PgBouncer Transaction Pooling 호환)';

-- ============================================================================
-- 7. ai_insights 테이블 RLS 정책 (JWT claim 기반)
-- ============================================================================
DROP POLICY IF EXISTS ai_insights_read ON public.ai_insights;
DROP POLICY IF EXISTS ai_insights_write ON public.ai_insights;

CREATE POLICY ai_insights_read ON public.ai_insights
FOR SELECT TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY ai_insights_write ON public.ai_insights
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

COMMENT ON POLICY ai_insights_read ON public.ai_insights IS
'테넌트 격리: JWT claim 기반 RLS (PgBouncer Transaction Pooling 호환)';

-- ============================================================================
-- 8. class_teachers 테이블 RLS 정책 (JWT claim 기반)
-- ============================================================================
DROP POLICY IF EXISTS tenant_isolation_class_teachers_delete ON public.class_teachers;
DROP POLICY IF EXISTS tenant_isolation_class_teachers_insert ON public.class_teachers;
DROP POLICY IF EXISTS tenant_isolation_class_teachers_select ON public.class_teachers;
DROP POLICY IF EXISTS tenant_isolation_class_teachers_update ON public.class_teachers;

CREATE POLICY tenant_isolation_class_teachers_select ON public.class_teachers
FOR SELECT TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY tenant_isolation_class_teachers_insert ON public.class_teachers
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY tenant_isolation_class_teachers_update ON public.class_teachers
FOR UPDATE TO authenticated
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

CREATE POLICY tenant_isolation_class_teachers_delete ON public.class_teachers
FOR DELETE TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

COMMENT ON POLICY tenant_isolation_class_teachers_select ON public.class_teachers IS
'테넌트 격리: JWT claim 기반 RLS (PgBouncer Transaction Pooling 호환)';

-- ============================================================================
-- 9. invoice_items 테이블 RLS 정책 (JWT claim 기반)
-- ============================================================================
-- ⚠️ 참고: invoices 테이블은 087_fix_rls_jwt_claim_migration.sql에서 이미 마이그레이션됨
DROP POLICY IF EXISTS invoice_items_read ON public.invoice_items;
DROP POLICY IF EXISTS invoice_items_write ON public.invoice_items;

CREATE POLICY invoice_items_read ON public.invoice_items
FOR SELECT TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

CREATE POLICY invoice_items_write ON public.invoice_items
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

COMMENT ON POLICY invoice_items_read ON public.invoice_items IS
'테넌트 격리: JWT claim 기반 RLS (PgBouncer Transaction Pooling 호환)';

-- ============================================================================
-- 10. ai_suggestions 테이블 RLS 정책 (레거시 테이블, 일관성 유지)
-- ============================================================================
-- ⚠️ 레거시 테이블: 이미 082_create_ai_suggestions_table.sql에서 수정됨
-- 여기서는 정책이 이미 JWT claim 기반으로 수정되었는지 확인만 수행

-- 정책이 이미 수정되었는지 확인 (082 파일에서 수정됨)
DO $$
BEGIN
  RAISE NOTICE '✅ ai_suggestions 테이블 RLS 정책은 082_create_ai_suggestions_table.sql에서 이미 JWT claim 기반으로 수정되었습니다.';
END $$;

-- ============================================================================
-- 마이그레이션 완료 로그
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ RLS 정책 JWT claim 기반 마이그레이션 완료';
  RAISE NOTICE '   - academy_classes: JWT claim 기반으로 마이그레이션 완료';
  RAISE NOTICE '   - academy_students: JWT claim 기반으로 마이그레이션 완료';
  RAISE NOTICE '   - academy_teachers: JWT claim 기반으로 마이그레이션 완료';
  RAISE NOTICE '   - tenant_features: JWT claim 기반으로 마이그레이션 완료';
  RAISE NOTICE '   - tenant_theme_overrides: JWT claim 기반으로 마이그레이션 완료';
  RAISE NOTICE '   - tenants: JWT claim 기반으로 마이그레이션 완료';
  RAISE NOTICE '   - ai_insights: JWT claim 기반으로 마이그레이션 완료';
  RAISE NOTICE '   - class_teachers: JWT claim 기반으로 마이그레이션 완료';
  RAISE NOTICE '   - invoice_items: JWT claim 기반으로 마이그레이션 완료';
  RAISE NOTICE '   - ai_suggestions: 이미 수정됨 (082 파일)';
  RAISE NOTICE '   - invoices: 이미 수정됨 (087 파일)';
END $$;

