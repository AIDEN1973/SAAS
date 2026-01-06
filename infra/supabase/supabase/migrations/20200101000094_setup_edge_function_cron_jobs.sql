/**
 * Edge Functions Cron 작업 설정 (SQL)
 *
 * [목적] pg_cron을 사용하여 Edge Functions를 주기적으로 호출합니다.
 *
 * ⚠️ 중요: Supabase Dashboard에서 설정하는 것이 더 안정적입니다.
 *          이 SQL은 참고용이며, Dashboard 설정을 권장합니다.
 *
 * Edge Function URL 형식:
 *   https://{project-ref}.supabase.co/functions/v1/{function-name}
 *
 * 인증:
 *   - Service Role Key를 사용하여 인증
 *   - Authorization 헤더에 Bearer 토큰 포함
 */

-- ============================================================================
-- 1. 환경변수 확인 (실제 값은 Supabase Secrets에서 가져와야 함)
-- ============================================================================
-- 주의: 실제 프로젝트에서는 current_setting() 또는 환경변수로 가져와야 합니다.
--       여기서는 예시로 하드코딩하지 않습니다.

DO $$
DECLARE
  supabase_url text;
  service_role_key text;
  project_ref text;
BEGIN
  -- Supabase URL에서 project-ref 추출 (예시)
  -- 실제로는 환경변수나 설정에서 가져와야 합니다.
  supabase_url := current_setting('app.supabase_url', true);
  service_role_key := current_setting('app.service_role_key', true);

  IF supabase_url IS NULL OR service_role_key IS NULL THEN
    RAISE NOTICE '⚠️ Supabase URL 또는 Service Role Key가 설정되지 않았습니다.';
    RAISE NOTICE '   Dashboard에서 cron 작업을 설정하는 것을 권장합니다.';
    RAISE NOTICE '   Dashboard > Edge Functions > 각 함수 > Cron Jobs 탭';
    RETURN;
  END IF;

  -- project-ref 추출 (URL에서)
  -- 예: https://xawypsrotrfoyozhrsbb.supabase.co -> xawypsrotrfoyozhrsbb
  project_ref := substring(supabase_url from 'https://([^.]+)\.supabase\.co');

  RAISE NOTICE '✅ Supabase 설정 확인 완료';
  RAISE NOTICE '   Project Ref: %', project_ref;
END $$;

-- ============================================================================
-- 2. Edge Function 호출을 위한 헬퍼 함수 (선택사항)
-- ============================================================================
-- 주의: Supabase는 net.http_post 확장이 필요할 수 있습니다.
--       실제 구현은 Supabase 버전에 따라 다를 수 있습니다.

-- HTTP 요청을 보내는 함수 (예시)
-- 실제로는 Supabase가 제공하는 방법을 사용해야 합니다.
/*
CREATE OR REPLACE FUNCTION call_edge_function(
  function_name text,
  payload jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
  function_url text;
  response_status int;
BEGIN
  -- 환경변수에서 가져오기 (실제 구현 필요)
  supabase_url := current_setting('app.supabase_url', true);
  service_role_key := current_setting('app.service_role_key', true);

  function_url := supabase_url || '/functions/v1/' || function_name;

  -- HTTP POST 요청 (net.http_post 확장 필요)
  -- 실제 구현은 Supabase 환경에 따라 다를 수 있습니다.
  -- PERFORM net.http_post(
  --   url := function_url,
  --   headers := jsonb_build_object(
  --     'Authorization', 'Bearer ' || service_role_key,
  --     'Content-Type', 'application/json'
  --   ),
  --   body := payload::text
  -- );

  RAISE NOTICE 'Edge Function 호출: %', function_url;
END;
$$;
*/

-- ============================================================================
-- 3. Cron 작업 설정 (예시 - 실제로는 Dashboard에서 설정 권장)
-- ============================================================================
-- ⚠️ 주의: 이 방법은 Supabase의 실제 구현에 따라 작동하지 않을 수 있습니다.
--          Dashboard에서 설정하는 것이 가장 안정적입니다.

-- 방법 1: Dashboard에서 설정 (권장)
-- Dashboard > Edge Functions > 각 함수 > Cron Jobs 탭

-- 방법 2: SQL로 설정 (제한적, Supabase 구현에 따라 다름)
/*
-- 자동 청구 생성 (매일 04:00 KST = 19:00 UTC 전날)
SELECT cron.schedule(
  'auto-billing-generation',
  '0 19 * * *',  -- UTC 19:00 (KST 다음날 04:00)
  $$
  SELECT call_edge_function('auto-billing-generation', '{}'::jsonb);
  $$
);

-- StudentTaskCard 배치 생성 (매일 06:00 KST = 21:00 UTC 전날)
SELECT cron.schedule(
  'student-task-card-generation',
  '0 21 * * *',  -- UTC 21:00 (KST 다음날 06:00)
  $$
  SELECT call_edge_function('student-task-card-generation', '{}'::jsonb);
  $$
);

-- AI 브리핑 카드 생성 (매일 07:00 KST = 22:00 UTC 전날)
SELECT cron.schedule(
  'ai-briefing-generation',
  '0 22 * * *',  -- UTC 22:00 (KST 다음날 07:00)
  $$
  SELECT call_edge_function('ai-briefing-generation', '{}'::jsonb);
  $$
);

-- 일일 통계 업데이트 (매일 23:59 KST = 14:59 UTC 당일)
SELECT cron.schedule(
  'daily-statistics-update',
  '59 14 * * *',  -- UTC 14:59 (KST 23:59)
  $$
  SELECT call_edge_function('daily-statistics-update', '{}'::jsonb);
  $$
);

-- 미납 알림 자동 발송 (매일 09:00 KST = 00:00 UTC 당일)
SELECT cron.schedule(
  'overdue-notification-scheduler',
  '0 0 * * *',  -- UTC 00:00 (KST 09:00)
  $$
  SELECT call_edge_function('overdue-notification-scheduler', '{}'::jsonb);
  $$
);
*/

-- ============================================================================
-- 4. 권장사항
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Edge Functions Cron 작업 설정 방법';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ 권장 방법: Supabase Dashboard';
  RAISE NOTICE '   1. Dashboard > Edge Functions로 이동';
  RAISE NOTICE '   2. 각 함수를 선택';
  RAISE NOTICE '   3. "Cron Jobs" 탭 클릭';
  RAISE NOTICE '   4. 스케줄 설정:';
  RAISE NOTICE '      - auto-billing-generation: 0 19 * * * (UTC)';
  RAISE NOTICE '      - student-task-card-generation: 0 21 * * * (UTC)';
  RAISE NOTICE '      - ai-briefing-generation: 0 22 * * * (UTC)';
  RAISE NOTICE '      - daily-statistics-update: 59 14 * * * (UTC)';
  RAISE NOTICE '      - overdue-notification-scheduler: 0 0 * * * (UTC)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ SQL로 설정:';
  RAISE NOTICE '   - Supabase의 실제 구현에 따라 다를 수 있습니다';
  RAISE NOTICE '   - HTTP 요청을 보내는 확장(net.http_post 등)이 필요할 수 있습니다';
  RAISE NOTICE '   - Dashboard 설정이 더 안정적이고 관리하기 쉽습니다';
  RAISE NOTICE '';
END $$;

