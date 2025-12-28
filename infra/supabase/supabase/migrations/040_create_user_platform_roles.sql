/**
 * user_platform_roles 테이블 생성 마이그레이션
 * 
 * [불변 규칙] Platform RBAC (SaaS 전체 관리자) 테이블
 * [불변 규칙] 테넌트 레벨이 아닌 플랫폼 전체 관리 권한
 * [불변 규칙] Schema Registry RLS 정책에서 필수 참조
 * 
 * 기술문서: 
 * - docu/스키마에디터.txt 3. 보안 모델
 * - docu/스키마엔진.txt 4. Schema Registry (DB + RLS)
 */

-- Platform RBAC 테이블 생성
-- ⚠️ 중요: 이 테이블은 테넌트 레벨이 아닌 SaaS 플랫폼 전체 관리 권한을 관리합니다.
-- - super_admin: 플랫폼 전체 관리자 (Schema Registry 관리, 모든 테넌트 관리)
-- - developer: 개발자 (Schema Registry 읽기, 개발/테스트)
-- - qa: QA 담당자 (Schema Registry 읽기, 테스트)
CREATE TABLE IF NOT EXISTS public.user_platform_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('super_admin', 'developer', 'qa')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(user_id)  -- 한 사용자는 하나의 플랫폼 역할만 가질 수 있음
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_platform_roles_user ON public.user_platform_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_platform_roles_role ON public.user_platform_roles(role);

-- RLS 활성화
ALTER TABLE public.user_platform_roles ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (재실행 시 오류 방지)
DROP POLICY IF EXISTS user_platform_roles_read ON public.user_platform_roles;
DROP POLICY IF EXISTS user_platform_roles_write ON public.user_platform_roles;

-- RLS 정책: 자신의 역할은 조회 가능, Super Admin은 모든 역할 조회 가능
CREATE POLICY user_platform_roles_read ON public.user_platform_roles
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- RLS 정책: Super Admin만 쓰기 가능 (자기 자신의 역할은 수정 불가)
-- ⚠️ 중요: Super Admin은 다른 Super Admin을 생성할 수 있지만, 자기 자신의 역할은 변경할 수 없습니다.
-- 이는 권한 상승 공격을 방지하기 위함입니다.
CREATE POLICY user_platform_roles_write ON public.user_platform_roles
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
  AND user_id != auth.uid()  -- 자기 자신의 역할은 변경 불가
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
  AND user_id != auth.uid()  -- 자기 자신의 역할은 변경 불가
);

-- 초기 Super Admin 생성 함수 (선택적)
-- ⚠️ 주의: 이 함수는 개발 환경에서만 사용하고, 프로덕션에서는 수동으로 관리해야 합니다.
CREATE OR REPLACE FUNCTION public.create_initial_super_admin(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 기존 역할이 있는지 확인
  IF EXISTS (SELECT 1 FROM public.user_platform_roles WHERE user_id = target_user_id) THEN
    RAISE EXCEPTION 'User already has a platform role';
  END IF;
  
  -- Super Admin 역할 부여
  INSERT INTO public.user_platform_roles (user_id, role, created_by)
  VALUES (target_user_id, 'super_admin', target_user_id);
END;
$$;

-- 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION public.create_initial_super_admin(uuid) TO authenticated;

-- 주석 추가
COMMENT ON TABLE public.user_platform_roles IS 'Platform RBAC: SaaS 플랫폼 전체 관리 권한 (테넌트 레벨이 아님)';
COMMENT ON COLUMN public.user_platform_roles.user_id IS '사용자 ID (auth.users 참조)';
COMMENT ON COLUMN public.user_platform_roles.role IS '플랫폼 역할: super_admin (전체 관리), developer (개발자), qa (QA)';
COMMENT ON COLUMN public.user_platform_roles.created_by IS '역할을 부여한 사용자 ID';

