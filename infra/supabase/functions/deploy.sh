#!/bin/bash

# Supabase Edge Functions 배포 스크립트
# 사용법: ./deploy.sh YOUR_PROJECT_REF
#
# 참고: 이 스크립트는 infra/supabase 디렉토리에서 실행해야 합니다.
#       Supabase CLI는 supabase/functions 디렉토리를 찾습니다.

set -e

PROJECT_REF=$1

if [ -z "$PROJECT_REF" ]; then
  # 환경변수에서 가져오기
  PROJECT_REF=$SUPABASE_PROJECT_REF
fi

if [ -z "$PROJECT_REF" ]; then
  echo "❌ 오류: 프로젝트 ref가 필요합니다."
  echo ""
  echo "사용법:"
  echo "  cd infra/supabase"
  echo "  ./functions/deploy.sh YOUR_PROJECT_REF"
  echo ""
  echo "또는 환경변수로 설정:"
  echo "  export SUPABASE_PROJECT_REF=YOUR_PROJECT_REF"
  echo "  cd infra/supabase"
  echo "  ./functions/deploy.sh"
  echo ""
  echo "프로젝트 ref는 Supabase Dashboard → Settings → General에서 확인할 수 있습니다."
  exit 1
fi

# infra/supabase 디렉토리로 이동
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.." || exit 1

# supabase/functions 디렉토리 구조 확인 및 생성
if [ ! -d "supabase/functions" ]; then
  echo "📁 supabase/functions 디렉토리 생성 중..."
  mkdir -p supabase
  cp -r functions supabase/
fi

echo "🚀 Supabase Edge Functions 배포 시작"
echo "프로젝트 Ref: $PROJECT_REF"
echo "작업 디렉토리: $(pwd)"
echo ""

FUNCTIONS=(
  "auto-billing-generation"
  "student-task-card-generation"
  "ai-briefing-generation"
  "daily-statistics-update"
  "overdue-notification-scheduler"
  "student-risk-analysis"
  "execute-student-task"
  "auto-message-suggestion"
  "consultation-ai-summary"
)

SUCCESS_COUNT=0
FAILED_COUNT=0

for func in "${FUNCTIONS[@]}"; do
  echo "📦 배포 중: $func"

  if supabase functions deploy "$func" --project-ref "$PROJECT_REF" --use-api --yes; then
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

