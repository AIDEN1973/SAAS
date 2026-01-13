-- automation_actions 파티션 및 보존 정책
-- [불변 규칙] 자동화 로그이므로 파티셔닝 적용 (연도별 RANGE 파티션)
-- [불변 규칙] 모든 파티션에는 반드시 (tenant_id, executed_at DESC) 복합 인덱스 적용
-- [법적 근거] 개인정보보호법 2년 (최소) 보존
-- [전략] 7년치 파티션 생성 + 2년 보존 정책

-- ============================================================
-- PART 1: 기존 테이블을 파티션 테이블로 전환
-- ============================================================

CREATE TABLE IF NOT EXISTS public.automation_actions_backup AS
SELECT * FROM public.automation_actions;

DROP TABLE IF EXISTS public.automation_actions CASCADE;

CREATE TABLE public.automation_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid,  -- FK는 파티션 생성 후 추가
  action_type text NOT NULL,
  executed_by uuid,  -- FK는 파티션 생성 후 추가
  executed_at timestamptz DEFAULT now(),
  result jsonb,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  trace_id text,
  request_id text,
  policy_version text,
  rule_id text,
  dedup_key text,
  approved_by uuid,  -- FK는 파티션 생성 후 추가
  approved_at timestamptz,
  executor_role text,
  execution_context jsonb,
  PRIMARY KEY (id, executed_at)
) PARTITION BY RANGE (executed_at);

-- 2025년 파티션
CREATE TABLE IF NOT EXISTS public.automation_actions_2025
  PARTITION OF public.automation_actions
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE INDEX IF NOT EXISTS idx_automation_actions_2025_tenant_executed
  ON public.automation_actions_2025(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2025_task
  ON public.automation_actions_2025(task_id);

-- ============================================================
-- PART 2: 2026-2032년 파티션 생성 (7년치)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.automation_actions_2026 PARTITION OF public.automation_actions FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2026_tenant_executed ON public.automation_actions_2026(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2026_task ON public.automation_actions_2026(task_id);

-- 기존 데이터 복원 (2025-2026년 파티션 생성 후)
INSERT INTO public.automation_actions (
  id, task_id, action_type, executed_by, executed_at, result, tenant_id,
  trace_id, request_id, policy_version, rule_id, dedup_key,
  approved_by, approved_at, executor_role, execution_context
)
SELECT
  id, task_id, action_type, executed_by, executed_at, result, tenant_id,
  trace_id, request_id, policy_version, rule_id, dedup_key,
  approved_by, approved_at, executor_role, execution_context
FROM public.automation_actions_backup
ON CONFLICT DO NOTHING;

DROP TABLE IF EXISTS public.automation_actions_backup;

CREATE TABLE IF NOT EXISTS public.automation_actions_2027 PARTITION OF public.automation_actions FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2027_tenant_executed ON public.automation_actions_2027(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2027_task ON public.automation_actions_2027(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2028 PARTITION OF public.automation_actions FOR VALUES FROM ('2028-01-01') TO ('2029-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2028_tenant_executed ON public.automation_actions_2028(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2028_task ON public.automation_actions_2028(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2029 PARTITION OF public.automation_actions FOR VALUES FROM ('2029-01-01') TO ('2030-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2029_tenant_executed ON public.automation_actions_2029(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2029_task ON public.automation_actions_2029(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2030 PARTITION OF public.automation_actions FOR VALUES FROM ('2030-01-01') TO ('2031-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2030_tenant_executed ON public.automation_actions_2030(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2030_task ON public.automation_actions_2030(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2031 PARTITION OF public.automation_actions FOR VALUES FROM ('2031-01-01') TO ('2032-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2031_tenant_executed ON public.automation_actions_2031(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2031_task ON public.automation_actions_2031(task_id);

CREATE TABLE IF NOT EXISTS public.automation_actions_2032 PARTITION OF public.automation_actions FOR VALUES FROM ('2032-01-01') TO ('2033-01-01');
CREATE INDEX IF NOT EXISTS idx_automation_actions_2032_tenant_executed ON public.automation_actions_2032(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_2032_task ON public.automation_actions_2032(task_id);

-- ============================================================
-- PART 3: RLS 정책 재생성
-- ============================================================
ALTER TABLE public.automation_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_automation_actions ON public.automation_actions;
CREATE POLICY tenant_isolation_automation_actions ON public.automation_actions
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ============================================================
-- PART 4: 2년 보존 정책 (최소)
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_automation_actions(retention_days int DEFAULT 730)
RETURNS TABLE(deleted_count bigint) AS $$
DECLARE
  deleted bigint;
BEGIN
  -- 2년(기본값)이 지난 자동화 액션 삭제
  WITH deleted_actions AS (
    DELETE FROM public.automation_actions
    WHERE executed_at < now() - (retention_days || ' days')::interval
    RETURNING id
  )
  SELECT count(*) INTO deleted FROM deleted_actions;

  deleted_count := deleted;
  RETURN NEXT;

  RAISE NOTICE '[cleanup_old_automation_actions] Deleted % actions older than % days', deleted, retention_days;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.cleanup_old_automation_actions(int) TO service_role;

-- pg_cron 스케줄 (매일 03:00 KST)
DO $do_block$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cleanup_automation_actions_daily');
    PERFORM cron.schedule(
      'cleanup_automation_actions_daily',
      '0 18 * * *',
      'SELECT public.cleanup_old_automation_actions(730)'
    );
    RAISE NOTICE '[pg_cron] automation_actions cleanup scheduled: daily at 18:00 UTC (03:00 KST)';
  ELSE
    RAISE NOTICE '[pg_cron] pg_cron extension not available. Manual cleanup required.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '[pg_cron] Failed to schedule cleanup job: %. Manual cleanup required.', SQLERRM;
END;
$do_block$;

-- 관리자용 RPC 함수
CREATE OR REPLACE FUNCTION public.admin_cleanup_automation_actions(p_retention_days int DEFAULT 730)
RETURNS jsonb AS $$
DECLARE
  result_count bigint;
BEGIN
  IF NOT (
    current_setting('role', true) = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.user_platform_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  ) THEN
    RAISE EXCEPTION 'Permission denied: Only service_role or super_admin can execute this function';
  END IF;

  SELECT deleted_count INTO result_count
  FROM public.cleanup_old_automation_actions(p_retention_days);

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', result_count,
    'retention_days', p_retention_days,
    'executed_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_cleanup_automation_actions(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cleanup_automation_actions(int) TO service_role;

-- ============================================================
-- PART 5: 메타데이터
-- ============================================================
COMMENT ON TABLE public.automation_actions IS '자동화 실행 로그 (파티션 적용, 프론트 자동화.md 2.5 참조)';
COMMENT ON FUNCTION public.cleanup_old_automation_actions(int) IS
  '2년이 지난 자동화 액션 자동 삭제. 개인정보보호법 최소 요건.';
COMMENT ON FUNCTION public.admin_cleanup_automation_actions(int) IS
  '관리자용 자동화 액션 정리 함수. super_admin 또는 service_role만 실행 가능.';

DO $$
BEGIN
  RAISE NOTICE '=== automation_actions 파티션 및 보존 정책 생성 완료 ===';
  RAISE NOTICE '파티션: 2025-2032년 (8년치)';
  RAISE NOTICE '보존 정책: 2년(최소)';
  RAISE NOTICE '법적 근거: 개인정보보호법 2년';
END $$;
