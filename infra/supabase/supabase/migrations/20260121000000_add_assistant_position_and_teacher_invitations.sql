-- 직급에 조교(assistant) 추가 및 teacher_invitations 테이블 생성
-- Phase 7: 설정 페이지 직급별 권한 관리

-- 1. teacher_invitations 테이블 생성 (강사 초대 링크)
CREATE TABLE IF NOT EXISTS public.teacher_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  position TEXT NOT NULL CHECK (position IN ('vice_principal', 'manager', 'teacher', 'assistant', 'other')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_teacher_invitations_token ON public.teacher_invitations(token);
CREATE INDEX IF NOT EXISTS idx_teacher_invitations_tenant ON public.teacher_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_teacher_invitations_expires ON public.teacher_invitations(expires_at);

-- RLS 정책
ALTER TABLE public.teacher_invitations ENABLE ROW LEVEL SECURITY;

-- 관리자만 초대 생성/관리 가능
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.teacher_invitations;
CREATE POLICY "Admins can manage invitations" ON public.teacher_invitations
  FOR ALL USING (
    tenant_id = (
      SELECT tenant_id FROM public.user_tenant_roles
      WHERE user_id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM public.user_tenant_roles
      WHERE user_id = auth.uid()
      AND tenant_id = teacher_invitations.tenant_id
      AND role IN ('owner', 'admin', 'sub_admin')
    )
  );

-- 초대 토큰 검증은 모든 사용자에게 허용 (SELECT only)
DROP POLICY IF EXISTS "Anyone can validate invitation token" ON public.teacher_invitations;
CREATE POLICY "Anyone can validate invitation token" ON public.teacher_invitations
  FOR SELECT USING (true);

-- 2. role_permissions 테이블 생성 (직급별 페이지 접근 권한 설정)
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  position TEXT NOT NULL CHECK (position IN ('vice_principal', 'manager', 'teacher', 'assistant', 'other')),
  page_path TEXT NOT NULL,
  can_access BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, position, page_path)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_role_permissions_tenant ON public.role_permissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_position ON public.role_permissions(tenant_id, position);

-- RLS 정책
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- 관리자만 권한 설정 관리 가능
DROP POLICY IF EXISTS "Admins can manage role_permissions" ON public.role_permissions;
CREATE POLICY "Admins can manage role_permissions" ON public.role_permissions
  FOR ALL USING (
    tenant_id = (
      SELECT tenant_id FROM public.user_tenant_roles
      WHERE user_id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM public.user_tenant_roles
      WHERE user_id = auth.uid()
      AND tenant_id = role_permissions.tenant_id
      AND role IN ('owner', 'admin')
    )
  );

-- 모든 사용자가 권한 설정 조회 가능
DROP POLICY IF EXISTS "All users can read role_permissions" ON public.role_permissions;
CREATE POLICY "All users can read role_permissions" ON public.role_permissions
  FOR SELECT USING (
    tenant_id = (
      SELECT tenant_id FROM public.user_tenant_roles
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

-- 3. academy_teachers 테이블에 position 컬럼 추가 (이미 있으면 무시)
DO $$
BEGIN
  -- position 컬럼이 없으면 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'academy_teachers'
    AND column_name = 'position'
  ) THEN
    ALTER TABLE public.academy_teachers
    ADD COLUMN position TEXT CHECK (position IN ('vice_principal', 'manager', 'teacher', 'assistant', 'other')) DEFAULT 'teacher';
  END IF;

  -- login_id 컬럼이 없으면 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'academy_teachers'
    AND column_name = 'login_id'
  ) THEN
    ALTER TABLE public.academy_teachers ADD COLUMN login_id TEXT;
  END IF;

  -- user_id 컬럼이 없으면 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'academy_teachers'
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.academy_teachers ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 인덱스 (이미 있으면 무시)
CREATE INDEX IF NOT EXISTS idx_academy_teachers_position ON public.academy_teachers(position);
CREATE INDEX IF NOT EXISTS idx_academy_teachers_user_id ON public.academy_teachers(user_id);

-- login_id 고유 인덱스 (테넌트 내에서 유일, 삭제되지 않은 것만)
CREATE UNIQUE INDEX IF NOT EXISTS idx_academy_teachers_tenant_login_id
ON public.academy_teachers(tenant_id, login_id)
WHERE login_id IS NOT NULL AND deleted_at IS NULL;

-- 기존 position CHECK 제약조건 업데이트 (있으면 삭제 후 재생성)
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- 기존 position 관련 CHECK 제약조건 찾기
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.academy_teachers'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) LIKE '%position%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.academy_teachers DROP CONSTRAINT %I', constraint_name);
  END IF;

  -- 새 CHECK 제약조건 추가 (assistant 포함)
  ALTER TABLE public.academy_teachers
  ADD CONSTRAINT academy_teachers_position_check
  CHECK (position IS NULL OR position IN ('vice_principal', 'manager', 'teacher', 'assistant', 'other'));
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- 이미 존재하면 무시
END $$;

-- 권한 부여
GRANT ALL ON public.teacher_invitations TO authenticated;
GRANT SELECT ON public.teacher_invitations TO anon;
GRANT ALL ON public.role_permissions TO authenticated;
