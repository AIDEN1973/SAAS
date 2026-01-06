/**
 * Edge Functions Cron 작업 설정 (SQL)
 *
 * [목적] pg_cron과 pg_net 확장을 사용하여 Edge Functions를 주기적으로 호출합니다.
 *
 * ⚠️ 중요:
 * 1. pg_cron 확장이 활성화되어 있어야 합니다 (이미 활성화됨)
 * 2. pg_net 확장이 활성화되어 있어야 합니다 (HTTP 요청용)
 * 3. Supabase Dashboard > Integrations > Cron에서 설정하는 것이 더 간편합니다
 *
 * Edge Function URL 형식:
 *   https://{project-ref}.supabase.co/functions/v1/{function-name}
 */

-- ============================================================================
-- 1. pg_net 확장 확인 및 활성화
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
  ) THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
      RAISE NOTICE '✅ pg_net 확장 활성화 완료 (HTTP 요청용)';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '⚠️ pg_net 확장 활성화 실패: %', SQLERRM;
      RAISE NOTICE '';
      RAISE NOTICE 'Supabase Dashboard에서 수동으로 활성화하세요:';
      RAISE NOTICE '  Dashboard > Database > Extensions > pg_net > Enable';
    END;
  ELSE
    RAISE NOTICE '✅ pg_net 확장이 이미 활성화되어 있습니다.';
  END IF;
END $$;

-- ============================================================================
-- 2. 환경변수 확인 (실제 값은 Supabase Secrets에서 가져와야 함)
-- ============================================================================
-- 주의: 실제 프로젝트에서는 Supabase Secrets 또는 환경변수로 관리해야 합니다.
--       여기서는 예시로 변수명만 표시합니다.

DO $$
DECLARE
  supabase_url text;
  service_role_key text;
  project_ref text;
BEGIN
  -- 실제로는 Supabase Secrets에서 가져와야 합니다
  -- 예시: current_setting('app.supabase_url', true)

  RAISE NOTICE '⚠️ 실제 프로젝트에서는 다음 값을 설정해야 합니다:';
  RAISE NOTICE '   - SUPABASE_URL: https://{project-ref}.supabase.co';
  RAISE NOTICE '   - SERVICE_ROLE_KEY: Supabase Service Role Key';
  RAISE NOTICE '';
  RAISE NOTICE '   Dashboard > Project Settings > API > Service Role Key';
END $$;

-- ============================================================================
-- 3. 기존 cron 작업 삭제 (재설정 시)
-- ============================================================================
DO $$
DECLARE
  job_record RECORD;
BEGIN
  FOR job_record IN
    SELECT jobid, jobname
    FROM cron.job
    WHERE jobname IN (
      'auto-billing-generation',
      'student-task-card-generation',
      'ai-briefing-generation',
      'daily-statistics-update',
      'overdue-notification-scheduler'
    )
  LOOP
    PERFORM cron.unschedule(job_record.jobname);
    RAISE NOTICE '기존 cron 작업 삭제: %', job_record.jobname;
  END LOOP;
END $$;

-- ============================================================================
-- 4. Edge Function 호출을 위한 헬퍼 함수
-- ============================================================================
-- 주의: 실제 SUPABASE_URL과 SERVICE_ROLE_KEY를 설정해야 합니다.
--       이 함수는 예시이며, 실제 값은 Supabase Secrets에서 가져와야 합니다.

CREATE OR REPLACE FUNCTION call_edge_function_via_http(
  function_name text,
  supabase_url text,
  service_role_key text,
  payload jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  function_url text;
  request_id bigint;
BEGIN
  -- Edge Function URL 구성
  function_url := supabase_url || '/functions/v1/' || function_name;

  -- HTTP POST 요청 (pg_net 사용)
  SELECT net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := payload::text::jsonb
  ) INTO request_id;

  RAISE NOTICE 'Edge Function 호출: % (Request ID: %)', function_url, request_id;

  RETURN request_id;
END;
$$;

COMMENT ON FUNCTION call_edge_function_via_http IS
'Edge Function을 HTTP POST로 호출하는 헬퍼 함수. pg_net 확장이 필요합니다.';

-- ============================================================================
-- 5. Cron 작업 등록 (예시 - 실제 값 필요)
-- ============================================================================
-- ⚠️ 주의: 실제 SUPABASE_URL과 SERVICE_ROLE_KEY를 설정해야 합니다.
--          아래 쿼리는 주석 처리되어 있으며, 실제 값으로 수정 후 실행해야 합니다.

/*
-- 실제 값으로 교체 필요:
-- 1. 'YOUR_PROJECT_REF' → 실제 프로젝트 ref
-- 2. 'YOUR_SERVICE_ROLE_KEY' → 실제 Service Role Key

-- 자동 청구 생성 (매일 04:00 KST = 19:00 UTC 전날)
SELECT cron.schedule(
  'auto-billing-generation',
  '0 19 * * *',  -- UTC 19:00 (KST 다음날 04:00)
  $$
  SELECT call_edge_function_via_http(
    'auto-billing-generation',
    'https://YOUR_PROJECT_REF.supabase.co',
    'YOUR_SERVICE_ROLE_KEY',
    '{}'::jsonb
  );
  $$
);

-- StudentTaskCard 배치 생성 (매일 06:00 KST = 21:00 UTC 전날)
SELECT cron.schedule(
  'student-task-card-generation',
  '0 21 * * *',  -- UTC 21:00 (KST 다음날 06:00)
  $$
  SELECT call_edge_function_via_http(
    'student-task-card-generation',
    'https://YOUR_PROJECT_REF.supabase.co',
    'YOUR_SERVICE_ROLE_KEY',
    '{}'::jsonb
  );
  $$
);

-- AI 브리핑 카드 생성 (매일 07:00 KST = 22:00 UTC 전날)
SELECT cron.schedule(
  'ai-briefing-generation',
  '0 22 * * *',  -- UTC 22:00 (KST 다음날 07:00)
  $$
  SELECT call_edge_function_via_http(
    'ai-briefing-generation',
    'https://YOUR_PROJECT_REF.supabase.co',
    'YOUR_SERVICE_ROLE_KEY',
    '{}'::jsonb
  );
  $$
);

-- 일일 통계 업데이트 (매일 23:59 KST = 14:59 UTC 당일)
SELECT cron.schedule(
  'daily-statistics-update',
  '59 14 * * *',  -- UTC 14:59 (KST 23:59)
  $$
  SELECT call_edge_function_via_http(
    'daily-statistics-update',
    'https://YOUR_PROJECT_REF.supabase.co',
    'YOUR_SERVICE_ROLE_KEY',
    '{}'::jsonb
  );
  $$
);

-- 미납 알림 자동 발송 (매일 09:00 KST = 00:00 UTC 당일)
SELECT cron.schedule(
  'overdue-notification-scheduler',
  '0 0 * * *',  -- UTC 00:00 (KST 09:00)
  $$
  SELECT call_edge_function_via_http(
    'overdue-notification-scheduler',
    'https://YOUR_PROJECT_REF.supabase.co',
    'YOUR_SERVICE_ROLE_KEY',
    '{}'::jsonb
  );
  $$
);
*/

-- ============================================================================
-- 6. 권장사항
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Edge Functions Cron 작업 설정 방법';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ 권장 방법: Supabase Dashboard';
  RAISE NOTICE '   1. Dashboard > Integrations > Cron으로 이동';
  RAISE NOTICE '   2. "Create job" 버튼 클릭';
  RAISE NOTICE '   3. 작업 설정:';
  RAISE NOTICE '      - Job name: 함수명';
  RAISE NOTICE '      - Schedule: Cron 표현식 (UTC 기준)';
  RAISE NOTICE '      - Command type: HTTP Request';
  RAISE NOTICE '      - URL: https://{project-ref}.supabase.co/functions/v1/{function-name}';
  RAISE NOTICE '      - Method: POST';
  RAISE NOTICE '      - Headers: Authorization Bearer {SERVICE_ROLE_KEY}';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ SQL로 설정:';
  RAISE NOTICE '   - pg_net 확장이 필요합니다';
  RAISE NOTICE '   - 실제 SUPABASE_URL과 SERVICE_ROLE_KEY를 설정해야 합니다';
  RAISE NOTICE '   - 위 주석 처리된 쿼리를 수정하여 실행하세요';
  RAISE NOTICE '   - Dashboard 설정이 더 간편하고 안전합니다';
  RAISE NOTICE '';
END $$;

