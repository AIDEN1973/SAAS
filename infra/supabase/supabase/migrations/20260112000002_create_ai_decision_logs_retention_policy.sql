-- ai_decision_logs 보존 정책: 90일
-- 목적: AI 판단 로그 자동 삭제 (디버깅 및 모델 개선용, 90일 이상은 집계 데이터로 전환)
-- [불변 규칙] 데이터 보존 기간 정책 준수
-- [참고] 파티션은 별도 마이그레이션으로 적용 (기존 데이터 보존 필요)

-- 1. 오래된 로그 삭제 함수 (90일)
CREATE OR REPLACE FUNCTION public.cleanup_old_ai_decision_logs(retention_days int DEFAULT 90)
RETURNS TABLE(deleted_count bigint) AS $$
DECLARE
  deleted bigint;
BEGIN
  -- 90일(기본값)이 지난 로그 삭제
  WITH deleted_logs AS (
    DELETE FROM public.ai_decision_logs
    WHERE created_at < now() - (retention_days || ' days')::interval
    RETURNING id
  )
  SELECT count(*) INTO deleted FROM deleted_logs;

  deleted_count := deleted;
  RETURN NEXT;

  -- 로그 기록 (디버깅용)
  RAISE NOTICE '[cleanup_old_ai_decision_logs] Deleted % logs older than % days', deleted, retention_days;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 함수 실행 권한 설정
GRANT EXECUTE ON FUNCTION public.cleanup_old_ai_decision_logs(int) TO service_role;

-- 2. pg_cron 스케줄 작업 생성 (매일 새벽 3시 KST = 매일 18:00 UTC)
-- 주의: pg_cron은 Supabase Pro/Enterprise에서만 사용 가능
DO $do_block$
BEGIN
  -- pg_cron 확장이 있는지 확인
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- 기존 스케줄이 있으면 삭제
    PERFORM cron.unschedule('cleanup_ai_decision_logs_daily');

    -- 새 스케줄 등록: 매일 18:00 UTC (한국 시간 새벽 3시)
    PERFORM cron.schedule(
      'cleanup_ai_decision_logs_daily',
      '0 18 * * *',
      'SELECT public.cleanup_old_ai_decision_logs(90)'
    );

    RAISE NOTICE '[pg_cron] ai_decision_logs cleanup job scheduled: daily at 18:00 UTC (03:00 KST)';
  ELSE
    RAISE NOTICE '[pg_cron] pg_cron extension not available. Manual cleanup required.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- pg_cron 스케줄 실패해도 마이그레이션은 성공
    RAISE NOTICE '[pg_cron] Failed to schedule cleanup job: %. Manual cleanup required.', SQLERRM;
END;
$do_block$;

-- 3. 수동 삭제용 RPC 함수 (관리자용)
-- service_role 또는 super_admin만 호출 가능
CREATE OR REPLACE FUNCTION public.admin_cleanup_ai_decision_logs(p_retention_days int DEFAULT 90)
RETURNS jsonb AS $$
DECLARE
  result_count bigint;
BEGIN
  -- 권한 체크: service_role 또는 super_admin만 허용
  IF NOT (
    current_setting('role', true) = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.user_platform_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  ) THEN
    RAISE EXCEPTION 'Permission denied: Only service_role or super_admin can execute this function';
  END IF;

  -- 삭제 실행
  SELECT deleted_count INTO result_count
  FROM public.cleanup_old_ai_decision_logs(p_retention_days);

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', result_count,
    'retention_days', p_retention_days,
    'executed_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 함수 실행 권한 설정
GRANT EXECUTE ON FUNCTION public.admin_cleanup_ai_decision_logs(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cleanup_ai_decision_logs(int) TO service_role;

-- 4. 보존 정책 메타데이터 (문서화 목적)
COMMENT ON FUNCTION public.cleanup_old_ai_decision_logs(int) IS
  '90일이 지난 AI 판단 로그 자동 삭제. AI 디버깅 및 모델 개선용, 90일 이상은 집계 데이터로 전환 권장.';
COMMENT ON FUNCTION public.admin_cleanup_ai_decision_logs(int) IS
  '관리자용 AI 판단 로그 정리 함수. super_admin 또는 service_role만 실행 가능.';
