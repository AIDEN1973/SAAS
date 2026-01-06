-- 상담일지 AI 요약 트리거 수정
-- [문제] Edge Function이 student_consultations.ai_summary를 업데이트할 때
--       트리거가 ai_insights 테이블에 INSERT를 시도하지만 insights 컬럼이 없어서 에러 발생
-- [해결] ai_summary가 이미 있는 경우(Edge Function에서 생성한 경우)에는
--       ai_insights에 INSERT하지 않도록 트리거 함수 수정

-- 기존 트리거 제거
DROP TRIGGER IF EXISTS consultation_ai_summary_trigger ON student_consultations;

-- 트리거 함수 수정: ai_summary가 이미 있는 경우에는 ai_insights에 INSERT하지 않음
-- (Edge Function이 이미 ai_summary를 생성했으므로 중복 생성 불필요)
CREATE OR REPLACE FUNCTION create_consultation_ai_summary()
RETURNS TRIGGER AS $$
BEGIN
  -- Edge Function(consultation-ai-summary)이 ai_summary를 직접 생성하므로
  -- 트리거에서는 더 이상 ai_insights 테이블에 INSERT하지 않음
  -- 이 함수는 호환성을 위해 유지하지만 실제로는 아무 작업도 수행하지 않음

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 재생성: UPDATE 시에는 실행하지 않음 (Edge Function이 처리)
-- INSERT 시에만 실행 (하지만 함수 내부에서 아무것도 하지 않음)
CREATE TRIGGER consultation_ai_summary_trigger
AFTER INSERT ON student_consultations
FOR EACH ROW
WHEN (NEW.content IS NOT NULL AND LENGTH(TRIM(NEW.content)) > 0)
EXECUTE FUNCTION create_consultation_ai_summary();

COMMENT ON FUNCTION create_consultation_ai_summary() IS
'상담일지 저장 시 AI 요약 생성 트리거 (아키텍처 문서 324줄)
참고: UPDATE 시 ai_summary 생성은 Edge Function(consultation-ai-summary)이 처리합니다.';

