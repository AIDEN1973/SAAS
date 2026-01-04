-- Migration: Add performance_analysis to ai_insights insight_type constraint
-- Description: AI 성과 분석 인사이트 타입 추가
-- Date: 2026-01-03

-- ============================================================================
-- 기존 CHECK 제약 조건 삭제 및 재생성
-- ============================================================================

-- 1. 기존 제약 조건 삭제 (존재하는 경우)
DO $$
BEGIN
  -- ai_insights_insight_type_check 제약 조건이 존재하면 삭제
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_insights_insight_type_check'
    AND conrelid = 'public.ai_insights'::regclass
  ) THEN
    ALTER TABLE public.ai_insights DROP CONSTRAINT ai_insights_insight_type_check;
    RAISE NOTICE 'Dropped existing ai_insights_insight_type_check constraint';
  END IF;
END $$;

-- 2. 새 제약 조건 추가 (performance_analysis 포함)
ALTER TABLE public.ai_insights
ADD CONSTRAINT ai_insights_insight_type_check
CHECK (insight_type IN (
  'daily_briefing',
  'weekly_briefing',
  'monthly_report',
  'consultation_summary',
  'daily_automation_digest',
  'regional_analytics',
  'regional_comparison',
  'risk_analysis',
  'performance_analysis',
  'attendance_anomaly',
  'proactive_recommendation',
  'meta_automation_pattern'
));

-- ============================================================================
-- 완료 메시지
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ai_insights insight_type 제약 조건 업데이트 완료!';
  RAISE NOTICE '   - performance_analysis 타입 추가됨';
  RAISE NOTICE '';
END $$;
