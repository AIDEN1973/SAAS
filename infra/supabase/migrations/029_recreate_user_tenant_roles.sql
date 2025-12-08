-- user_tenant_roles 테이블 재생성 (PostgREST 인식 문제 해결)
-- [중요] 테이블을 완전히 삭제하고 재생성하여 PostgREST가 인식하도록 함
-- [주의] 기존 데이터가 있다면 백업이 필요합니다.

-- 1. 기존 테이블 삭제 (CASCADE로 모든 의존성 제거)
DROP TABLE IF EXISTS public.user_tenant_roles CASCADE;

-- 2. 테이블 재생성
CREATE TABLE public.user_tenant_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'sub_admin', 'teacher', 'assistant', 'counselor', 'parent', 'staff')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)  -- 한 사용자는 한 테넌트에 하나의 역할만
);

-- 3. 인덱스 생성
CREATE INDEX idx_user_tenant_roles_user ON public.user_tenant_roles(user_id);
CREATE INDEX idx_user_tenant_roles_tenant ON public.user_tenant_roles(tenant_id);
CREATE INDEX idx_user_tenant_roles_user_tenant ON public.user_tenant_roles(user_id, tenant_id);

-- 4. 테이블 소유자 설정
ALTER TABLE public.user_tenant_roles OWNER TO postgres;

-- 5. 권한 부여
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_tenant_roles TO authenticated, anon;

-- 6. RLS 활성화 (정책은 나중에 추가)
ALTER TABLE public.user_tenant_roles ENABLE ROW LEVEL SECURITY;

-- 7. 기본 RLS 정책 생성 (단순화)
CREATE POLICY user_tenant_roles_isolation ON public.user_tenant_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 8. 테이블 통계 업데이트
ANALYZE public.user_tenant_roles;

-- 9. PostgREST 스키마 캐시 강제 새로고침
NOTIFY pgrst, 'reload schema';

-- 10. 테이블 생성 확인
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'user_tenant_roles';



