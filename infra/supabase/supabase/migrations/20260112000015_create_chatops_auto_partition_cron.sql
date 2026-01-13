-- chatops_messages 월별 파티션 자동 생성
-- [전략] pg_cron으로 매월 1일에 다음달 파티션 자동 생성
-- [목적] 파티션 누락으로 인한 데이터 삽입 실패 방지

-- ============================================================
-- PART 1: 다음달 파티션 생성 함수
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_next_month_chatops_partition()
RETURNS jsonb AS $$
DECLARE
  next_month date;
  partition_name text;
  start_date date;
  end_date date;
  idx1_name text;
  idx2_name text;
BEGIN
  -- 다음달 날짜 계산
  next_month := date_trunc('month', current_date + interval '1 month');
  partition_name := 'chatops_messages_' || to_char(next_month, 'YYYY_MM');
  start_date := next_month;
  end_date := next_month + interval '1 month';
  idx1_name := 'idx_' || partition_name || '_session_created';
  idx2_name := 'idx_' || partition_name || '_tenant_user_created';

  -- 파티션 생성 (이미 존재하면 스킵)
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.chatops_messages FOR VALUES FROM (%L) TO (%L)',
    partition_name, start_date, end_date
  );

  -- 인덱스 1: session_id + created_at DESC
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON public.%I(session_id, created_at DESC)',
    idx1_name, partition_name
  );

  -- 인덱스 2: tenant_id + user_id + created_at DESC
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON public.%I(tenant_id, user_id, created_at DESC)',
    idx2_name, partition_name
  );

  RAISE NOTICE '[create_next_month_chatops_partition] Created partition: % for period % to %',
    partition_name, start_date, end_date;

  RETURN jsonb_build_object(
    'success', true,
    'partition_name', partition_name,
    'start_date', start_date,
    'end_date', end_date,
    'created_at', now()
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '[create_next_month_chatops_partition] Failed: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'created_at', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_next_month_chatops_partition() TO service_role;

-- ============================================================
-- PART 2: pg_cron 스케줄 등록 (매월 1일 00:30 UTC)
-- ============================================================

DO $do_block$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- 기존 스케줄 삭제 (있다면)
    PERFORM cron.unschedule('create_next_month_chatops_partition_monthly');

    -- 새 스케줄 등록: 매월 1일 00:30 UTC (09:30 KST)
    -- 30분 여유: DROP 스케줄(18:00 UTC)과 충돌 방지
    PERFORM cron.schedule(
      'create_next_month_chatops_partition_monthly',
      '30 0 1 * *',  -- 매월 1일 00:30 UTC
      'SELECT public.create_next_month_chatops_partition()'
    );

    RAISE NOTICE '[pg_cron] chatops_messages 월별 파티션 자동 생성 스케줄 등록 완료';
    RAISE NOTICE '[pg_cron] 실행 시간: 매월 1일 00:30 UTC (09:30 KST)';
    RAISE NOTICE '[pg_cron] 이제 2075년까지 파티션 자동 생성됨';
  ELSE
    RAISE NOTICE '[pg_cron] pg_cron extension not available. Manual partition creation required.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '[pg_cron] Failed to schedule chatops partition creation: %. Manual partition creation required.', SQLERRM;
END;
$do_block$;

-- ============================================================
-- PART 3: 관리자용 RPC 함수 (수동 실행용)
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_create_next_month_chatops_partition()
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  -- 권한 체크: service_role 또는 super_admin만 허용
  IF NOT (
    current_setting('role', true) = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.user_platform_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  ) THEN
    RAISE EXCEPTION 'Permission denied: Only service_role or super_admin can execute this function';
  END IF;

  -- 파티션 생성 실행
  SELECT public.create_next_month_chatops_partition() INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_create_next_month_chatops_partition() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_next_month_chatops_partition() TO service_role;

-- ============================================================
-- PART 4: 초기 파티션 생성 (2026-07 ~ 2026-12, 6개월)
-- ============================================================

-- 2026-07
CREATE TABLE IF NOT EXISTS public.chatops_messages_2026_07
  PARTITION OF public.chatops_messages
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE INDEX IF NOT EXISTS idx_chatops_messages_2026_07_session_created
  ON public.chatops_messages_2026_07(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatops_messages_2026_07_tenant_user_created
  ON public.chatops_messages_2026_07(tenant_id, user_id, created_at DESC);

-- 2026-08
CREATE TABLE IF NOT EXISTS public.chatops_messages_2026_08
  PARTITION OF public.chatops_messages
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE INDEX IF NOT EXISTS idx_chatops_messages_2026_08_session_created
  ON public.chatops_messages_2026_08(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatops_messages_2026_08_tenant_user_created
  ON public.chatops_messages_2026_08(tenant_id, user_id, created_at DESC);

-- 2026-09
CREATE TABLE IF NOT EXISTS public.chatops_messages_2026_09
  PARTITION OF public.chatops_messages
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE INDEX IF NOT EXISTS idx_chatops_messages_2026_09_session_created
  ON public.chatops_messages_2026_09(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatops_messages_2026_09_tenant_user_created
  ON public.chatops_messages_2026_09(tenant_id, user_id, created_at DESC);

-- 2026-10
CREATE TABLE IF NOT EXISTS public.chatops_messages_2026_10
  PARTITION OF public.chatops_messages
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE INDEX IF NOT EXISTS idx_chatops_messages_2026_10_session_created
  ON public.chatops_messages_2026_10(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatops_messages_2026_10_tenant_user_created
  ON public.chatops_messages_2026_10(tenant_id, user_id, created_at DESC);

-- 2026-11
CREATE TABLE IF NOT EXISTS public.chatops_messages_2026_11
  PARTITION OF public.chatops_messages
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE INDEX IF NOT EXISTS idx_chatops_messages_2026_11_session_created
  ON public.chatops_messages_2026_11(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatops_messages_2026_11_tenant_user_created
  ON public.chatops_messages_2026_11(tenant_id, user_id, created_at DESC);

-- 2026-12
CREATE TABLE IF NOT EXISTS public.chatops_messages_2026_12
  PARTITION OF public.chatops_messages
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE INDEX IF NOT EXISTS idx_chatops_messages_2026_12_session_created
  ON public.chatops_messages_2026_12(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatops_messages_2026_12_tenant_user_created
  ON public.chatops_messages_2026_12(tenant_id, user_id, created_at DESC);

-- ============================================================
-- PART 5: 메타데이터
-- ============================================================

COMMENT ON FUNCTION public.create_next_month_chatops_partition() IS
  '다음달 chatops_messages 파티션 자동 생성. pg_cron으로 매월 1일 실행.';
COMMENT ON FUNCTION public.admin_create_next_month_chatops_partition() IS
  '관리자용 다음달 chatops 파티션 생성 함수. super_admin 또는 service_role만 실행 가능.';

-- ============================================================
-- 완료 메시지
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '=== chatops_messages 자동 파티션 생성 설정 완료 ===';
  RAISE NOTICE '초기 파티션: 2026-07 ~ 2026-12 (6개월 추가)';
  RAISE NOTICE '자동 생성: 매월 1일 00:30 UTC (09:30 KST)';
  RAISE NOTICE '이제 2075년까지 파티션 자동 생성됨';
  RAISE NOTICE '수동 생성: SELECT public.admin_create_next_month_chatops_partition()';
END $$;
