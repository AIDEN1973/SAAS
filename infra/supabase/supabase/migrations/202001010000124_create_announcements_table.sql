-- announcements 테이블 생성
-- announcement_urgent, announcement_digest 자동화 기능을 위한 공지사항 테이블
-- AI_자동화_기능_정리.md Section 11: announcement_urgent, announcement_digest 참조

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  urgent boolean NOT NULL DEFAULT false,  -- 긴급 공지 여부 (announcement_urgent 트리거용)
  target_audience text CHECK (target_audience IN ('all', 'students', 'guardians', 'staff')),  -- 대상자
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at timestamptz,  -- 발행 시각
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_announcements_tenant_created ON public.announcements(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_tenant_urgent ON public.announcements(tenant_id, urgent) WHERE urgent = true;
CREATE INDEX IF NOT EXISTS idx_announcements_tenant_status ON public.announcements(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_announcements_tenant_published ON public.announcements(tenant_id, published_at DESC) WHERE status = 'published';

-- updated_at 자동 업데이트 트리거
DROP TRIGGER IF EXISTS update_announcements_updated_at ON public.announcements;
CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS 정책 (JWT claim 기반)
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 테넌트별 접근 제어 (JWT claim 기반)
CREATE POLICY announcements_tenant_isolation ON public.announcements
  FOR ALL
  USING (
    tenant_id = (
      SELECT (current_setting('request.jwt.claims', true)::jsonb->>'tenant_id')::uuid
    )
  );

COMMENT ON TABLE public.announcements IS '공지사항 테이블 (announcement_urgent, announcement_digest 자동화 기능용)';
COMMENT ON COLUMN public.announcements.urgent IS '긴급 공지 여부 (announcement_urgent 트리거가 감지하는 필드)';
COMMENT ON COLUMN public.announcements.target_audience IS '대상자: all, students, guardians, staff';
COMMENT ON COLUMN public.announcements.status IS '상태: draft, published, archived';

