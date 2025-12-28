-- Core Platform 테이블 생성
-- [불변 규칙] 모든 테이블은 tenant_id 필수 + 인덱스 구성
-- [불변 규칙] JWT claim 기반 RLS 사용 (PgBouncer Transaction Pooling 호환)

-- 1. 테넌트 테이블
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry_type text NOT NULL CHECK (industry_type IN ('academy', 'salon', 'real_estate', 'gym', 'ngo')),  -- 정본: real_estate (언더스코어 필수)
  -- ⚠️ 참고: 문서 예시에서 'nail' 업종이 언급되지만, 실제 DB 제약조건에 포함 여부는 마이그레이션 파일을 SSOT로 확인하세요.
  plan text NOT NULL DEFAULT 'basic' CHECK (plan IN ('basic', 'premium', 'enterprise')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed', 'deleting')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenants_industry ON public.tenants(industry_type);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status);

-- 2. 사용자-테넌트-역할 매핑 테이블
CREATE TABLE IF NOT EXISTS public.user_tenant_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'sub_admin', 'instructor', 'teacher', 'assistant', 'counselor', 'guardian', 'parent', 'staff')),  -- instructor/guardian은 정본 키, teacher/parent는 backward compatibility
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)  -- 한 사용자는 한 테넌트에 하나의 역할만
);

CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_user ON public.user_tenant_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_tenant ON public.user_tenant_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_user_tenant ON public.user_tenant_roles(user_id, tenant_id);

-- 3. 테넌트 설정 테이블
CREATE TABLE IF NOT EXISTS public.tenant_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, key)  -- 테넌트별 키 중복 방지
);

CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant ON public.tenant_settings(tenant_id);

-- 4. 테넌트 기능 테이블
CREATE TABLE IF NOT EXISTS public.tenant_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  quota integer,  -- 사용량 제한 (null이면 무제한)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, feature_key)  -- 테넌트별 기능 키 중복 방지
);

CREATE INDEX IF NOT EXISTS idx_tenant_features_tenant ON public.tenant_features(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_features_enabled ON public.tenant_features(tenant_id, enabled);

