#!/bin/bash

# Supabase Edge Functions 배포 스크립트
# 사용법: ./deploy.sh YOUR_PROJECT_REF

set -e

PROJECT_REF=$1

if [ -z "$PROJECT_REF" ]; then
  echo "❌ 오류: 프로젝트 ref가 필요합니다."
  echo ""
  echo "사용법:"
  echo "  ./deploy.sh YOUR_PROJECT_REF"
  echo ""
  echo "또는 환경변수로 설정:"
  echo "  export SUPABASE_PROJECT_REF=YOUR_PROJECT_REF"
  echo "  ./deploy.sh"
  exit 1
fi

# 환경변수에서 가져오기 (인자가 없으면)
if [ -z "$PROJECT_REF" ] && [ ! -z "$SUPABASE_PROJECT_REF" ]; then
  PROJECT_REF=$SUPABASE_PROJECT_REF
fi

echo "🚀 Supabase Edge Functions 배포 시작"
echo "프로젝트 Ref: $PROJECT_REF"
echo ""

FUNCTIONS=(
  "auto-billing-generation"
  "student-task-card-generation"
  "ai-briefing-generation"
  "daily-statistics-update"
  "overdue-notification-scheduler"
  "student-risk-analysis"
)

SUCCESS_COUNT=0
FAILED_COUNT=0

for func in "${FUNCTIONS[@]}"; do
  echo "📦 배포 중: $func"
  
  if supabase functions deploy "$func" --project-ref "$PROJECT_REF" --use-api; then
    echo "✅ $func 배포 성공"
    ((SUCCESS_COUNT++))
  else
    echo "❌ $func 배포 실패"
    ((FAILED_COUNT++))
  fi
  echo ""
done

echo "=========================================="
echo "배포 완료"
echo "  성공: $SUCCESS_COUNT"
echo "  실패: $FAILED_COUNT"
echo "=========================================="

if [ $FAILED_COUNT -gt 0 ]; then
  exit 1
fi

