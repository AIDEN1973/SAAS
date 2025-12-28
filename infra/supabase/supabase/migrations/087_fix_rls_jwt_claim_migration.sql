/**
 * RLS 정책 JWT claim 기반 마이그레이션
 *
 * [불변 규칙] PgBouncer Transaction Pooling 환경에서는 JWT claim 기반 RLS를 사용합니다.
 * [불변 규칙] user_tenant_roles 조인 패턴은 레거시이며, JWT claim 기반으로 마이그레이션합니다.
 *
 * 기술문서: docu/전체 기술문서.txt "RLS tenant 판별 방식 혼재 문제" 섹션 참조
 *
 * 마이그레이션 대상 테이블:
 * - notification_templates
 * - invoices
 * - invoice_items
 * - notifications
 * - payment_methods
 * - tenant_theme_overrides
 */

-- ============================================================================
-- 1. notification_templates 테이블 RLS 정책 (JWT claim 기반)
-- ============================================================================
DROP POLICY IF EXISTS notification_templates_read ON public.notification_templates;
DROP POLICY IF EXISTS notification_templates_write ON public.notification_templates;

-- 읽기 정책: JWT claim 기반 (정본)
CREATE POLICY notification_templates_read ON public.notification_templates
FOR SELECT TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- 쓰기 정책: owner/admin/sub_admin만 허용 (JWT claim 기반)
-- ⚠️ 중요: super_admin 우회 없음 (의도적 제한, 문서와 일치)
CREATE POLICY notification_templates_write ON public.notification_templates
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  AND (auth.jwt() ->> 'role'::text) IN ('owner', 'admin', 'sub_admin')
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  AND (auth.jwt() ->> 'role'::text) IN ('owner', 'admin', 'sub_admin')
);

COMMENT ON POLICY notification_templates_read ON public.notification_templates IS
'테넌트 격리: JWT claim 기반 RLS (PgBouncer Transaction Pooling 호환)';
COMMENT ON POLICY notification_templates_write ON public.notification_templates IS
'테넌트 격리: JWT claim 기반 RLS, owner/admin/sub_admin만 수정 가능 (super_admin 우회 없음)';

-- ============================================================================
-- 2. invoices 테이블 RLS 정책 (JWT claim 기반)
-- ============================================================================
DROP POLICY IF EXISTS invoices_read ON public.invoices;
DROP POLICY IF EXISTS invoices_write ON public.invoices;

CREATE POLICY invoices_read ON public.invoices
FOR SELECT TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

CREATE POLICY invoices_write ON public.invoices
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

COMMENT ON POLICY invoices_read ON public.invoices IS
'테넌트 격리: JWT claim 기반 RLS (PgBouncer Transaction Pooling 호환)';
COMMENT ON POLICY invoices_write ON public.invoices IS
'테넌트 격리: JWT claim 기반 RLS (PgBouncer Transaction Pooling 호환)';

-- ============================================================================
-- 3. invoice_items 테이블 RLS 정책 (JWT claim 기반)
-- ============================================================================
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
COMMENT ON POLICY invoice_items_write ON public.invoice_items IS
'테넌트 격리: JWT claim 기반 RLS (PgBouncer Transaction Pooling 호환)';

-- ============================================================================
-- 4. notifications 테이블 RLS 정책 (JWT claim 기반)
-- ============================================================================
DROP POLICY IF EXISTS notifications_read ON public.notifications;
DROP POLICY IF EXISTS notifications_write ON public.notifications;

CREATE POLICY notifications_read ON public.notifications
FOR SELECT TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

CREATE POLICY notifications_write ON public.notifications
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

COMMENT ON POLICY notifications_read ON public.notifications IS
'테넌트 격리: JWT claim 기반 RLS (PgBouncer Transaction Pooling 호환)';
COMMENT ON POLICY notifications_write ON public.notifications IS
'테넌트 격리: JWT claim 기반 RLS (PgBouncer Transaction Pooling 호환)';

-- ============================================================================
-- 5. payment_methods 테이블 RLS 정책 (JWT claim 기반)
-- ============================================================================
DROP POLICY IF EXISTS payment_methods_read ON public.payment_methods;
DROP POLICY IF EXISTS payment_methods_write ON public.payment_methods;

CREATE POLICY payment_methods_read ON public.payment_methods
FOR SELECT TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

CREATE POLICY payment_methods_write ON public.payment_methods
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  AND (auth.jwt() ->> 'role'::text) IN ('owner', 'admin', 'sub_admin')
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  AND (auth.jwt() ->> 'role'::text) IN ('owner', 'admin', 'sub_admin')
);

COMMENT ON POLICY payment_methods_read ON public.payment_methods IS
'테넌트 격리: JWT claim 기반 RLS (PgBouncer Transaction Pooling 호환)';
COMMENT ON POLICY payment_methods_write ON public.payment_methods IS
'테넌트 격리: JWT claim 기반 RLS, owner/admin/sub_admin만 수정 가능';

-- ============================================================================
-- 6. tenant_theme_overrides 테이블 RLS 정책 (JWT claim 기반)
-- ============================================================================
DROP POLICY IF EXISTS tenant_theme_overrides_read ON public.tenant_theme_overrides;
DROP POLICY IF EXISTS tenant_theme_overrides_write ON public.tenant_theme_overrides;

CREATE POLICY tenant_theme_overrides_read ON public.tenant_theme_overrides
FOR SELECT TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

CREATE POLICY tenant_theme_overrides_write ON public.tenant_theme_overrides
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  AND (auth.jwt() ->> 'role'::text) IN ('owner', 'admin', 'sub_admin')
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  AND (auth.jwt() ->> 'role'::text) IN ('owner', 'admin', 'sub_admin')
);

COMMENT ON POLICY tenant_theme_overrides_read ON public.tenant_theme_overrides IS
'테넌트 격리: JWT claim 기반 RLS (PgBouncer Transaction Pooling 호환)';
COMMENT ON POLICY tenant_theme_overrides_write ON public.tenant_theme_overrides IS
'테넌트 격리: JWT claim 기반 RLS, owner/admin/sub_admin만 수정 가능';

-- ============================================================================
-- 완료 로그
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ RLS 정책 JWT claim 기반 마이그레이션 완료';
  RAISE NOTICE '   - notification_templates: JWT claim 기반 (super_admin 우회 없음)';
  RAISE NOTICE '   - invoices: JWT claim 기반';
  RAISE NOTICE '   - invoice_items: JWT claim 기반';
  RAISE NOTICE '   - notifications: JWT claim 기반';
  RAISE NOTICE '   - payment_methods: JWT claim 기반';
  RAISE NOTICE '   - tenant_theme_overrides: JWT claim 기반';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ 중요: Custom Access Token Hook이 활성화되어 JWT claim에 tenant_id가 포함되어야 합니다.';
END $$;

