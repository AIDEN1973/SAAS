-- refunds 테이블 생성
-- refund_spike 자동화 기능을 위한 환불 추적 테이블
-- AI_자동화_기능_정리.md Section 11: refund_spike 참조

CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  student_id uuid REFERENCES public.persons(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
  processed_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_refunds_tenant_created ON public.refunds(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refunds_invoice ON public.refunds(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refunds_student ON public.refunds(student_id) WHERE student_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refunds(tenant_id, status);

-- RLS 정책 (JWT claim 기반)
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- 테넌트별 접근 제어 (JWT claim 기반)
CREATE POLICY refunds_tenant_isolation ON public.refunds
  FOR ALL
  USING (
    tenant_id = (
      SELECT (current_setting('request.jwt.claims', true)::jsonb->>'tenant_id')::uuid
    )
  );

COMMENT ON TABLE public.refunds IS '환불 추적 테이블 (refund_spike 자동화 기능용)';
COMMENT ON COLUMN public.refunds.invoice_id IS '환불 대상 청구서 ID';
COMMENT ON COLUMN public.refunds.student_id IS '환불 대상 학생 ID';
COMMENT ON COLUMN public.refunds.amount IS '환불 금액';
COMMENT ON COLUMN public.refunds.reason IS '환불 사유';
COMMENT ON COLUMN public.refunds.status IS '환불 상태: pending, approved, rejected, completed, cancelled';

