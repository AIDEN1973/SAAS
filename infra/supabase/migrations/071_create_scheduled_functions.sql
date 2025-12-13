/**
 * Supabase Scheduled Functions 설정
 *
 * 아키텍처 문서 6218줄 참조
 * Zero-Management: 시간 기반 자동화 작업 스케줄 설정
 *
 * 주의: Supabase cron 설정은 Supabase Dashboard에서 직접 설정해야 함
 * 이 파일은 참고용 문서입니다.
 */

-- Supabase cron 작업 설정 (Supabase Dashboard에서 설정)
--
-- 1. 자동 청구 생성 (매일 04:00 KST = 19:00 UTC 전날)
--    Function: auto-billing-generation
--    Schedule: 0 19 * * * (UTC 기준)
--    Timezone: UTC
--
-- 2. StudentTaskCard 배치 생성 (매일 06:00 KST = 21:00 UTC 전날)
--    Function: student-task-card-generation
--    Schedule: 0 21 * * * (UTC 기준)
--    Timezone: UTC
--
-- 3. AI 브리핑 카드 생성 (매일 07:00 KST = 22:00 UTC 전날)
--    Function: ai-briefing-generation
--    Schedule: 0 22 * * * (UTC 기준)
--    Timezone: UTC
--
-- 4. 일일 통계 업데이트 (매일 23:59 KST = 14:59 UTC 당일)
--    Function: daily-statistics-update
--    Schedule: 59 14 * * * (UTC 기준)
--    Timezone: UTC
--
-- 참고: KST는 UTC+9이므로 UTC 시간에서 9시간을 빼야 함
-- 예: 04:00 KST = 19:00 UTC (전날)

-- cron 작업 등록을 위한 헬퍼 함수 (선택사항)
-- 실제 cron 설정은 Supabase Dashboard에서 수행해야 함

COMMENT ON FUNCTION create_risk_task_card IS
'이탈 위험 감지 시 StudentTaskCard 생성 함수. AI 엔진에서 위험 점수 90 이상 감지 시 호출됨.';




