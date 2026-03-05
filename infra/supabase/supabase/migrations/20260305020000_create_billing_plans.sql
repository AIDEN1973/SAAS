-- Phase 0-2: billing_plans 테이블 생성
-- 학생별 수강료 관리 (수업별 월 수강료 설정)

CREATE TABLE IF NOT EXISTS public.billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.academy_classes(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'KRW',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  start_date DATE NOT NULL,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_billing_plans_tenant ON public.billing_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_plans_student ON public.billing_plans(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_billing_plans_active ON public.billing_plans(tenant_id, status) WHERE status = 'active';

-- updated_at 자동 업데이트
DROP TRIGGER IF EXISTS update_billing_plans_updated_at ON public.billing_plans;
CREATE TRIGGER update_billing_plans_updated_at
  BEFORE UPDATE ON public.billing_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS 적용
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.billing_plans
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

COMMENT ON TABLE public.billing_plans IS 'Student billing plans - defines monthly tuition per student/class combination.';
