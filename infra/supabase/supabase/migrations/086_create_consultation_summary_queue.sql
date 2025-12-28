-- 상담일지 자동 요약 큐 테이블 생성
-- 프론트 자동화 문서 5.2.1 섹션 참조
--
-- ⚠️ 중요: DB Trigger에서 HTTP 호출 및 Service Role Key 사용은 보안 위험이 있습니다.
-- 대신 큐 테이블에 작업을 적재하고, Edge Function(Cron/Worker)이 서버 환경변수로 Service Role Key를 들고 처리합니다.

-- 1. 큐 테이블 생성
CREATE TABLE IF NOT EXISTS public.consultation_summary_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL REFERENCES public.student_consultations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  content text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  completed_at timestamptz
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_consultation_summary_jobs_status
ON public.consultation_summary_jobs(status, created_at)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_consultation_summary_jobs_tenant
ON public.consultation_summary_jobs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consultation_summary_jobs_consultation
ON public.consultation_summary_jobs(consultation_id);

-- 3. RLS 정책 활성화
ALTER TABLE public.consultation_summary_jobs ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책 생성 (JWT claim 기반)
DROP POLICY IF EXISTS tenant_isolation_consultation_summary_jobs ON public.consultation_summary_jobs;
CREATE POLICY tenant_isolation_consultation_summary_jobs ON public.consultation_summary_jobs
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- 5. 트리거 함수 생성
CREATE OR REPLACE FUNCTION public.trigger_consultation_ai_summary()
RETURNS TRIGGER AS $$
BEGIN
  -- ⚠️ 중요: DB Trigger에서 HTTP 호출 및 Service Role Key 사용은 보안 위험이 있습니다.
  -- 대신 큐 테이블에 작업을 적재하고, Edge Function(Cron/Worker)이 서버 환경변수로 Service Role Key를 들고 처리합니다.

  -- 큐 테이블에 작업 적재 (재시도/백오프/로그 지원)
  INSERT INTO public.consultation_summary_jobs (
    consultation_id,
    tenant_id,
    content,
    status,
    created_at
  ) VALUES (
    NEW.id,
    NEW.tenant_id,
    NEW.content,
    'pending',
    now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 트리거 생성
DROP TRIGGER IF EXISTS consultation_ai_summary_trigger ON public.student_consultations;
CREATE TRIGGER consultation_ai_summary_trigger
  AFTER INSERT ON public.student_consultations
  FOR EACH ROW
  WHEN (NEW.content IS NOT NULL AND length(NEW.content) > 50)
  EXECUTE FUNCTION public.trigger_consultation_ai_summary();

-- 7. 주석 추가
COMMENT ON TABLE public.consultation_summary_jobs IS
'상담일지 자동 요약 큐 테이블. DB Trigger가 작업을 적재하고, Edge Function(Cron/Worker)이 처리합니다.';
COMMENT ON FUNCTION public.trigger_consultation_ai_summary() IS
'상담일지 저장 시 자동 요약 작업을 큐에 적재하는 트리거 함수. 프론트 자동화 문서 5.2.1 섹션 참조.';

