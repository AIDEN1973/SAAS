-- Migration: Disable Worker Cron Job
-- Description: Job Queue 인프라를 향후 사용을 위해 보관하지만 Cron 실행은 중단
-- Reason: 현재 job_executions 테이블이 비어있고, 프론트엔드에서 Job Queue를 사용하지 않음
--         ChatOps는 Streaming 방식, StudentTask는 execute-student-task 직접 호출
-- Date: 2026-01-23

-- ============================================================================
-- 1. Worker Cron 작업 비활성화
-- ============================================================================
-- ⚠️ 주의: 삭제하지 않고 비활성화만 수행 (향후 재활성화 가능)

UPDATE cron.job
SET active = false
WHERE jobname = 'worker-process-job';

-- ============================================================================
-- 2. 비활성화 확인
-- ============================================================================
SELECT
  jobid,
  schedule,
  jobname,
  active,
  CASE
    WHEN active THEN '⚠️ 여전히 활성화됨'
    ELSE '✅ 비활성화됨'
  END AS status
FROM cron.job
WHERE jobname = 'worker-process-job';

-- ============================================================================
-- 3. 완료 메시지
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Worker Cron 작업 비활성화 완료!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '비활성화된 작업:';
  RAISE NOTICE '  - worker-process-job: 1분마다 실행 → 중단됨';
  RAISE NOTICE '';
  RAISE NOTICE '보관된 인프라:';
  RAISE NOTICE '  - job_executions 테이블: 유지';
  RAISE NOTICE '  - worker-process-job Edge Function: 유지';
  RAISE NOTICE '  - 70+ Intent handlers: 유지';
  RAISE NOTICE '';
  RAISE NOTICE '📌 재활성화 방법:';
  RAISE NOTICE '   UPDATE cron.job SET active = true WHERE jobname = ''worker-process-job'';';
  RAISE NOTICE '';
  RAISE NOTICE '📌 완전 삭제 방법:';
  RAISE NOTICE '   SELECT cron.unschedule(''worker-process-job'');';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- 4. 참고: Job Queue 아키텍처 재활성화 가이드
-- ============================================================================
COMMENT ON TABLE job_executions IS
'[ARCHIVED] Worker 아키텍처를 위한 job 실행 테이블.
현재 상태: 비활성화 (2026-01-23)
재활성화 방법:
1. Cron job 활성화: UPDATE cron.job SET active = true WHERE jobname = ''worker-process-job'';
2. 프론트엔드에서 job_executions 테이블에 INSERT
3. worker-process-job Edge Function이 1분마다 처리
참조 문서: docu/JOB_QUEUE_ARCHITECTURE.md';
