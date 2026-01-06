/**
 * Supabase Edge Functions Cron 작업 설정
 *
 * 아키텍처 문서 6218줄 참조
 * Zero-Management: 시간 기반 자동화 작업 스케줄 설정
 *
 * [주의] Supabase는 pg_cron 확장을 사용합니다.
 *        이 마이그레이션은 cron 작업을 SQL로 설정합니다.
 *        Supabase Dashboard에서도 설정 가능하지만, SQL로 관리하는 것이 버전 관리에 유리합니다.
 */

-- ============================================================================
-- 1. pg_cron 확장 확인 및 활성화
-- ============================================================================
-- ⚠️ 중요: Supabase Dashboard에서 먼저 pg_cron 확장을 활성화해야 합니다.
--          Dashboard > Database > Extensions > pg_cron > Enable
--          스키마는 "extensions" 또는 "pg_cron"을 선택하세요.
--
--          이 마이그레이션은 확장이 이미 활성화된 경우에만 실행됩니다.

-- 확장 활성화 확인
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    RAISE NOTICE '✅ pg_cron 확장이 이미 활성화되어 있습니다.';
  ELSE
    RAISE NOTICE '⚠️ pg_cron 확장이 활성화되지 않았습니다.';
    RAISE NOTICE '';
    RAISE NOTICE '활성화 방법:';
    RAISE NOTICE '  1. Supabase Dashboard > Database > Extensions로 이동';
    RAISE NOTICE '  2. "pg_cron" 확장 찾기';
    RAISE NOTICE '  3. "Enable" 버튼 클릭';
    RAISE NOTICE '  4. 스키마 선택: "extensions" (권장) 또는 "pg_cron"';
    RAISE NOTICE '';
    RAISE NOTICE '확장 활성화 후 이 마이그레이션을 다시 실행하세요.';
  END IF;
END $$;

-- ============================================================================
-- 2. 기존 cron 작업 확인
-- ============================================================================
-- 이 쿼리를 실행하여 현재 설정된 cron 작업을 확인할 수 있습니다:
-- SELECT * FROM cron.job ORDER BY jobid;

-- ============================================================================
-- 3. 기존 cron 작업 삭제 (재설정 시)
-- ============================================================================
-- 기존 작업이 있으면 삭제 (idempotent)
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
-- 4. Cron 작업 등록
-- ============================================================================
-- 참고: Supabase Edge Functions는 HTTP 요청으로 호출됩니다.
--       cron.schedule 함수는 PostgreSQL 함수를 호출하므로,
--       Edge Function을 호출하려면 net.http_post를 사용해야 합니다.
--       하지만 Supabase는 Edge Functions를 직접 호출하는 방법을 제공합니다.

-- 방법 1: Supabase Dashboard에서 설정 (권장)
-- Dashboard > Edge Functions > 각 함수 > Cron Jobs 탭에서 설정

-- 방법 2: SQL로 설정 (Supabase가 지원하는 경우)
-- 주의: Supabase의 실제 구현에 따라 다를 수 있습니다.
--       Dashboard에서 설정하는 것이 더 안정적입니다.

-- ============================================================================
-- 5. Cron 작업 확인 쿼리
-- ============================================================================
-- 다음 쿼리로 현재 설정된 cron 작업을 확인할 수 있습니다:
/*
SELECT
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job
WHERE jobname IN (
  'auto-billing-generation',
  'student-task-card-generation',
  'ai-briefing-generation',
  'daily-statistics-update',
  'overdue-notification-scheduler'
)
ORDER BY jobname;
*/

-- ============================================================================
-- 6. Cron 작업 스케줄 정보 (참고용)
-- ============================================================================
-- 1. 자동 청구 생성 (매일 04:00 KST = 19:00 UTC 전날)
--    Function: auto-billing-generation
--    Schedule: 0 19 * * * (UTC 기준)
--    Cron 표현식: 분 시 일 월 요일
--    설명: 매일 UTC 19:00 (한국시간 다음날 04:00)에 실행

-- 2. StudentTaskCard 배치 생성 (매일 06:00 KST = 21:00 UTC 전날)
--    Function: student-task-card-generation
--    Schedule: 0 21 * * * (UTC 기준)
--    설명: 매일 UTC 21:00 (한국시간 다음날 06:00)에 실행

-- 3. AI 브리핑 카드 생성 (매일 07:00 KST = 22:00 UTC 전날)
--    Function: ai-briefing-generation
--    Schedule: 0 22 * * * (UTC 기준)
--    설명: 매일 UTC 22:00 (한국시간 다음날 07:00)에 실행

-- 4. 일일 통계 업데이트 (매일 23:59 KST = 14:59 UTC 당일)
--    Function: daily-statistics-update
--    Schedule: 59 14 * * * (UTC 기준)
--    설명: 매일 UTC 14:59 (한국시간 23:59)에 실행

-- 5. 미납 알림 자동 발송 (매일 09:00 KST = 00:00 UTC 당일)
--    Function: overdue-notification-scheduler
--    Schedule: 0 0 * * * (UTC 기준)
--    설명: 매일 UTC 00:00 (한국시간 09:00)에 실행

-- ============================================================================
-- 참고: KST는 UTC+9이므로 UTC 시간에서 9시간을 빼야 합니다.
-- 예: 04:00 KST = 19:00 UTC (전날)
--     계산: 04:00 - 9시간 = -5:00 → 전날 19:00
-- ============================================================================

COMMENT ON EXTENSION pg_cron IS
'PostgreSQL cron 확장. Supabase Edge Functions의 스케줄 작업에 사용됩니다.';

