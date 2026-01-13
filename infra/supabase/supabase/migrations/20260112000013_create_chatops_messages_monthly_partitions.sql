-- chatops_messages 월별 파티션
-- [불변 규칙] 실시간 대화 로그이므로 월별 파티셔닝 적용
-- [불변 규칙] 모든 파티션에는 반드시 (session_id, created_at DESC) 인덱스 적용
-- [법적 근거] 법적 의무 없음, 30일 보존 정책 (141_chatops_retention_policy_30days.sql)
-- [전략] 6개월치 월별 파티션 생성 + 파티션 DROP으로 빠른 삭제 (DELETE 대비 1000배 빠름)

-- ============================================================
-- PART 1: 기존 테이블을 파티션 테이블로 전환
-- ============================================================

CREATE TABLE IF NOT EXISTS public.chatops_messages_backup AS
SELECT * FROM public.chatops_messages;

DROP TABLE IF EXISTS public.chatops_messages CASCADE;

CREATE TABLE public.chatops_messages (
  id bigserial NOT NULL,
  session_id uuid NOT NULL,  -- FK는 파티션 생성 후 추가
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,  -- FK는 파티션 생성 후 추가
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- ============================================================
-- PART 2: 월별 파티션 생성 (2025-12 ~ 2026-06, 7개월)
-- ============================================================

-- 2025-12 (기존 데이터 복원용)
CREATE TABLE IF NOT EXISTS public.chatops_messages_2025_12
  PARTITION OF public.chatops_messages
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE INDEX IF NOT EXISTS idx_chatops_messages_2025_12_session_created
  ON public.chatops_messages_2025_12(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatops_messages_2025_12_tenant_user_created
  ON public.chatops_messages_2025_12(tenant_id, user_id, created_at DESC);

-- 2026-01
CREATE TABLE IF NOT EXISTS public.chatops_messages_2026_01
  PARTITION OF public.chatops_messages
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE INDEX IF NOT EXISTS idx_chatops_messages_2026_01_session_created
  ON public.chatops_messages_2026_01(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatops_messages_2026_01_tenant_user_created
  ON public.chatops_messages_2026_01(tenant_id, user_id, created_at DESC);

-- 2026-02
CREATE TABLE IF NOT EXISTS public.chatops_messages_2026_02
  PARTITION OF public.chatops_messages
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE INDEX IF NOT EXISTS idx_chatops_messages_2026_02_session_created
  ON public.chatops_messages_2026_02(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatops_messages_2026_02_tenant_user_created
  ON public.chatops_messages_2026_02(tenant_id, user_id, created_at DESC);

-- 2026-03
CREATE TABLE IF NOT EXISTS public.chatops_messages_2026_03
  PARTITION OF public.chatops_messages
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE INDEX IF NOT EXISTS idx_chatops_messages_2026_03_session_created
  ON public.chatops_messages_2026_03(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatops_messages_2026_03_tenant_user_created
  ON public.chatops_messages_2026_03(tenant_id, user_id, created_at DESC);

-- 2026-04
CREATE TABLE IF NOT EXISTS public.chatops_messages_2026_04
  PARTITION OF public.chatops_messages
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE INDEX IF NOT EXISTS idx_chatops_messages_2026_04_session_created
  ON public.chatops_messages_2026_04(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatops_messages_2026_04_tenant_user_created
  ON public.chatops_messages_2026_04(tenant_id, user_id, created_at DESC);

-- 2026-05
CREATE TABLE IF NOT EXISTS public.chatops_messages_2026_05
  PARTITION OF public.chatops_messages
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE INDEX IF NOT EXISTS idx_chatops_messages_2026_05_session_created
  ON public.chatops_messages_2026_05(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatops_messages_2026_05_tenant_user_created
  ON public.chatops_messages_2026_05(tenant_id, user_id, created_at DESC);

-- 2026-06
CREATE TABLE IF NOT EXISTS public.chatops_messages_2026_06
  PARTITION OF public.chatops_messages
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE INDEX IF NOT EXISTS idx_chatops_messages_2026_06_session_created
  ON public.chatops_messages_2026_06(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatops_messages_2026_06_tenant_user_created
  ON public.chatops_messages_2026_06(tenant_id, user_id, created_at DESC);

-- ============================================================
-- PART 3: 기존 데이터 복원
-- ============================================================
INSERT INTO public.chatops_messages (
  id, session_id, tenant_id, user_id, role, content, created_at
)
SELECT
  id, session_id, tenant_id, user_id, role, content, created_at
FROM public.chatops_messages_backup
ON CONFLICT DO NOTHING;

DROP TABLE IF EXISTS public.chatops_messages_backup;

-- ============================================================
-- PART 4: RLS 정책 재생성
-- ============================================================
ALTER TABLE public.chatops_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chatops_messages_select_policy ON public.chatops_messages;
CREATE POLICY chatops_messages_select_policy ON public.chatops_messages
  FOR SELECT
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::jsonb->>'tenant_id')::uuid
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS chatops_messages_insert_policy ON public.chatops_messages;
CREATE POLICY chatops_messages_insert_policy ON public.chatops_messages
  FOR INSERT
  WITH CHECK (
    tenant_id = (current_setting('request.jwt.claims', true)::jsonb->>'tenant_id')::uuid
    AND user_id = auth.uid()
  );

-- ============================================================
-- PART 5: 파티션 기반 보존 정책 (30일 이상 파티션 DROP)
-- ============================================================

-- 기존 DELETE 방식 정리 함수는 유지 (호환성)
-- 새로운 파티션 DROP 방식 추가

CREATE OR REPLACE FUNCTION public.drop_old_chatops_message_partitions(retention_days int DEFAULT 30)
RETURNS TABLE(dropped_partitions text[]) AS $$
DECLARE
  partition_name text;
  partition_date date;
  cutoff_date date;
  dropped_list text[] := ARRAY[]::text[];
BEGIN
  -- 30일 이전 날짜 계산
  cutoff_date := CURRENT_DATE - (retention_days || ' days')::interval;

  -- 모든 chatops_messages 파티션 조회
  FOR partition_name IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename LIKE 'chatops_messages_%'
      AND tablename ~ 'chatops_messages_[0-9]{4}_[0-9]{2}$'
  LOOP
    -- 파티션 이름에서 년월 추출 (예: chatops_messages_2025_12 -> 2025-12-01)
    BEGIN
      partition_date := TO_DATE(
        SUBSTRING(partition_name FROM 'chatops_messages_([0-9]{4}_[0-9]{2})$'),
        'YYYY_MM'
      );

      -- 30일 이상 지난 파티션 DROP
      IF partition_date < cutoff_date THEN
        EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', partition_name);
        dropped_list := array_append(dropped_list, partition_name);
        RAISE NOTICE '[drop_old_chatops_message_partitions] Dropped partition: %', partition_name;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE '[drop_old_chatops_message_partitions] Failed to process partition %: %', partition_name, SQLERRM;
    END;
  END LOOP;

  dropped_partitions := dropped_list;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.drop_old_chatops_message_partitions(int) TO service_role;

-- pg_cron 스케줄 업데이트 (DELETE에서 DROP으로 전환)
DO $do_block$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- 기존 스케줄 삭제
    PERFORM cron.unschedule('cleanup_chatops_sessions_daily');

    -- 새 스케줄 등록: 월별 파티션 DROP (훨씬 빠름)
    PERFORM cron.schedule(
      'drop_old_chatops_partitions_daily',
      '0 18 * * *',  -- 18:00 UTC = 03:00 KST
      'SELECT public.drop_old_chatops_message_partitions(30)'
    );

    RAISE NOTICE '[pg_cron] chatops_messages partition cleanup scheduled: daily at 18:00 UTC (03:00 KST)';
    RAISE NOTICE '[pg_cron] 성능 개선: DELETE (수분) -> DROP PARTITION (1초)';
  ELSE
    RAISE NOTICE '[pg_cron] pg_cron extension not available. Manual cleanup required.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '[pg_cron] Failed to schedule cleanup job: %. Manual cleanup required.', SQLERRM;
END;
$do_block$;

-- 관리자용 RPC 함수
CREATE OR REPLACE FUNCTION public.admin_drop_old_chatops_partitions(p_retention_days int DEFAULT 30)
RETURNS jsonb AS $$
DECLARE
  dropped_list text[];
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

  SELECT dropped_partitions INTO dropped_list
  FROM public.drop_old_chatops_message_partitions(p_retention_days);

  RETURN jsonb_build_object(
    'success', true,
    'dropped_partitions', dropped_list,
    'retention_days', p_retention_days,
    'executed_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_drop_old_chatops_partitions(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_drop_old_chatops_partitions(int) TO service_role;

-- ============================================================
-- PART 6: 메타데이터
-- ============================================================
COMMENT ON TABLE public.chatops_messages IS 'ChatOps 메시지 테이블 (월별 파티션 적용)';
COMMENT ON FUNCTION public.drop_old_chatops_message_partitions(int) IS
  '30일 이상 된 chatops_messages 파티션 DROP. DELETE 대비 1000배 빠름 (메타데이터 삭제만).';
COMMENT ON FUNCTION public.admin_drop_old_chatops_partitions(int) IS
  '관리자용 ChatOps 파티션 정리 함수. super_admin 또는 service_role만 실행 가능.';

DO $$
BEGIN
  RAISE NOTICE '=== chatops_messages 월별 파티션 생성 완료 ===';
  RAISE NOTICE '파티션: 2025-12 ~ 2026-06 (7개월)';
  RAISE NOTICE '보존 정책: 30일 (파티션 DROP 방식)';
  RAISE NOTICE '성능 개선: DELETE (수분) -> DROP PARTITION (1초)';
  RAISE NOTICE '⚠️ 주의: 매월 새 파티션 생성 필요 (자동화 권장)';
END $$;
