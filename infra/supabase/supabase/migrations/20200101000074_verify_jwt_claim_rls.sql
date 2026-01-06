-- JWT claim 기반 RLS 정책 검증 및 복원
--
-- [목적] guardians, student_classes, student_consultations, attendance_logs 테이블의
--        RLS 정책이 JWT claim 기반인지 확인하고, 필요시 복원합니다.
--
-- [불변 규칙] 문서(docu/전체 기술문서.txt, docu/rules.md)에 따라 JWT claim 기반 RLS 사용
-- [불변 규칙] PgBouncer Transaction Pooling 호환

-- ============================================================================
-- 1. 현재 RLS 정책 확인
-- ============================================================================
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  CASE
    WHEN using_expression LIKE '%auth.jwt()%' THEN 'JWT claim 기반'
    WHEN using_expression LIKE '%user_tenant_roles%' THEN 'user_tenant_roles 기반'
    ELSE '기타'
  END AS policy_type,
  using_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('guardians', 'student_classes', 'student_consultations', 'attendance_logs')
ORDER BY tablename, policyname;

-- ============================================================================
-- 2. guardians 테이블 RLS 정책 (JWT claim 기반)
-- ============================================================================
DROP POLICY IF EXISTS tenant_isolation_guardians ON public.guardians;

CREATE POLICY tenant_isolation_guardians ON public.guardians
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

COMMENT ON POLICY tenant_isolation_guardians ON public.guardians IS
'테넌트 격리: JWT claim 기반 RLS (PgBouncer Transaction Pooling 호환)';

-- ============================================================================
-- 3. student_classes 테이블 RLS 정책 (JWT claim 기반)
-- ============================================================================
DROP POLICY IF EXISTS tenant_isolation_student_classes ON public.student_classes;

CREATE POLICY tenant_isolation_student_classes ON public.student_classes
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

COMMENT ON POLICY tenant_isolation_student_classes ON public.student_classes IS
'테넌트 격리: JWT claim 기반 RLS (PgBouncer Transaction Pooling 호환)';

-- ============================================================================
-- 4. student_consultations 테이블 RLS 정책 (JWT claim 기반)
-- ============================================================================
DROP POLICY IF EXISTS tenant_isolation_student_consultations ON public.student_consultations;

CREATE POLICY tenant_isolation_student_consultations ON public.student_consultations
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

COMMENT ON POLICY tenant_isolation_student_consultations ON public.student_consultations IS
'테넌트 격리: JWT claim 기반 RLS (PgBouncer Transaction Pooling 호환)';

-- ============================================================================
-- 5. attendance_logs 테이블 RLS 정책 (JWT claim 기반)
-- ============================================================================
DROP POLICY IF EXISTS tenant_isolation_attendance_logs ON public.attendance_logs;
DROP POLICY IF EXISTS dev_bypass_attendance_logs ON public.attendance_logs;

CREATE POLICY tenant_isolation_attendance_logs ON public.attendance_logs
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

COMMENT ON POLICY tenant_isolation_attendance_logs ON public.attendance_logs IS
'테넌트 격리: JWT claim 기반 RLS (PgBouncer Transaction Pooling 호환)';

-- ============================================================================
-- 6. 최종 검증
-- ============================================================================
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  CASE
    WHEN using_expression LIKE '%auth.jwt()%' THEN '✅ JWT claim 기반'
    WHEN using_expression LIKE '%user_tenant_roles%' THEN '⚠️  user_tenant_roles 기반'
    ELSE '❌ 기타'
  END AS policy_type
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('guardians', 'student_classes', 'student_consultations', 'attendance_logs')
ORDER BY tablename, policyname;

