/**
 * 월말 자동 리포트 생성 배치 작업 설정
 *
 * 아키텍처 문서 319줄 참조: 월말 자동 리포트 생성
 * Zero-Management: 사용자 개입 없이 자동 실행
 *
 * 주의: 실제 리포트 생성 로직은 Edge Function으로 구현 필요
 * 이 파일은 참고용 문서입니다.
 */

-- 월말 리포트 생성 함수 (Edge Function으로 구현)
-- 스케줄: 매월 말일 23:00 KST
-- Function: monthly-report-generation
-- Schedule: 0 14 28-31 * * (UTC 기준, 매월 말일)

COMMENT ON FUNCTION create_risk_task_card IS
'이탈 위험 감지 시 StudentTaskCard 생성 함수. AI 엔진에서 위험 점수 90 이상 감지 시 호출됨.';

-- 월말 리포트 생성은 별도 Edge Function으로 구현 필요
-- 리포트 내용:
-- - 월간 출석률 통계
-- - 월간 수납 현황
-- - 학생별 성과 요약
-- - AI 인사이트 요약




