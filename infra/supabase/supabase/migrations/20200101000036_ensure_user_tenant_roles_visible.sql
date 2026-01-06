-- user_tenant_roles 테이블 PostgREST 노출 보장
-- [중요] 로그인 시 테이블을 찾을 수 없는 문제 해결
-- [해결] 테이블이 존재하고 권한이 올바르게 설정되어 있는지 확인

-- 1. 테이블 존재 확인 및 재생성 (필요시)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'user_tenant_roles'
  ) THEN
    -- 테이블이 없으면 재생성
    CREATE TABLE public.user_tenant_roles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      role text NOT NULL CHECK (role IN ('owner', 'admin', 'sub_admin', 'teacher', 'assistant', 'counselor', 'parent', 'staff')),  -- ⚠️ 레거시: instructor/guardian 누락. 최신 SSOT는 000_create_core_tables.sql 참조
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(user_id, tenant_id)
    );

    -- 인덱스 생성
    CREATE INDEX idx_user_tenant_roles_user ON public.user_tenant_roles(user_id);
    CREATE INDEX idx_user_tenant_roles_tenant ON public.user_tenant_roles(tenant_id);
    CREATE INDEX idx_user_tenant_roles_user_tenant ON public.user_tenant_roles(user_id, tenant_id);
  END IF;
END $$;

-- 2. 테이블 소유자 설정
ALTER TABLE public.user_tenant_roles OWNER TO postgres;

-- 3. 스키마 권한 부여
GRANT USAGE ON SCHEMA public TO authenticated, anon;

-- 4. 테이블 권한 부여 (SELECT는 anon도 필요 - 로그인 시)
GRANT SELECT ON TABLE public.user_tenant_roles TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON TABLE public.user_tenant_roles TO authenticated;

-- 5. RLS 활성화
ALTER TABLE public.user_tenant_roles ENABLE ROW LEVEL SECURITY;

-- 6. 기존 정책 삭제
DROP POLICY IF EXISTS user_tenant_roles_isolation ON public.user_tenant_roles;
DROP POLICY IF EXISTS "tenant read" ON public.user_tenant_roles;

-- 7. RLS 정책 생성 (authenticated 사용자는 자신의 레코드만 조회)
CREATE POLICY user_tenant_roles_isolation ON public.user_tenant_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 8. anon 사용자를 위한 정책 (로그인 시 사용)
-- [중요] 로그인 후에는 authenticated가 되므로, anon 정책은 필요 없음
-- 하지만 테이블이 PostgREST에 노출되려면 최소한 하나의 정책이 필요
-- authenticated 정책만으로도 충분함 (로그인 후에는 authenticated가 됨)

-- 9. 테이블 통계 업데이트
ANALYZE public.user_tenant_roles;

-- 10. PostgREST 스키마 캐시 강제 새로고침
NOTIFY pgrst, 'reload schema';

-- 11. 최종 확인: 테이블 및 권한 확인
SELECT
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'user_tenant_roles';

SELECT
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'user_tenant_roles'
  AND grantee IN ('authenticated', 'anon')
ORDER BY grantee, privilege_type;

