-- Core Tags 공통 태깅 시스템 테이블
-- [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
-- [불변 규칙] 모든 업종에서 공통으로 사용하는 태깅 시스템

-- 1. 태그 테이블 (공통)
CREATE TABLE IF NOT EXISTS public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  description text,
  entity_type text CHECK (entity_type IN ('student', 'customer', 'property', 'donor', 'other')),  -- 업종별 엔티티 타입 (선택적)
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name, entity_type)  -- 테넌트 내 태그 이름 중복 방지 (entity_type별)
);

CREATE INDEX IF NOT EXISTS idx_tags_tenant ON public.tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tags_tenant_entity_type ON public.tags(tenant_id, entity_type);

-- 2. 태그 할당 테이블 (공통, 다대다)
CREATE TABLE IF NOT EXISTS public.tag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL,  -- student_id, customer_id 등 (업종별 테이블 참조)
  entity_type text NOT NULL CHECK (entity_type IN ('student', 'customer', 'property', 'donor', 'other')),
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id, entity_type, tag_id)  -- 중복 방지
);

CREATE INDEX IF NOT EXISTS idx_tag_assignments_tenant ON public.tag_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tag_assignments_entity ON public.tag_assignments(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_tag_assignments_tag ON public.tag_assignments(tag_id);
CREATE INDEX IF NOT EXISTS idx_tag_assignments_tenant_entity ON public.tag_assignments(tenant_id, entity_id, entity_type);

