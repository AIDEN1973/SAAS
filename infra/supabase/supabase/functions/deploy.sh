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
  echo "  ./supabase/supabase/functions/deploy.sh YOUR_PROJECT_REF"
  echo ""
  echo "또는 환경변수로 설정:"
  echo "  export SUPABASE_PROJECT_REF=YOUR_PROJECT_REF"
  echo "  cd infra/supabase"
  echo "  ./supabase/supabase/functions/deploy.sh"
  echo ""
  echo "프로젝트 ref는 Supabase Dashboard → Settings → General에서 확인할 수 있습니다."
  exit 1
fi

# infra/supabase 디렉토리로 이동 (Supabase CLI는 이 디렉토리에서 실행되어야 함)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.." || exit 1

# ⚠️ 중요: Supabase CLI는 supabase/functions 디렉토리를 찾으므로
#          infra/supabase 디렉토리에서 실행해야 합니다.
#          현재 디렉토리: infra/supabase (supabase/functions가 여기에 있음)

echo "🚀 Supabase Edge Functions 배포 시작"
echo "프로젝트 Ref: $PROJECT_REF"
echo "작업 디렉토리: $(pwd)"
echo ""

# ⚠️ P1: DB Contract Gate 검증 (배포 전 자동 실행)
# 붕괴사전예방.md Layer B 참조: CI/CD 파이프라인 자동 통합
echo "🔍 DB Contract Gate 검증 실행 중..."
if ! npm run test:db-contract; then
  echo "❌ DB Contract Gate 검증 실패 - 배포 중단"
  echo "마이그레이션이 누락되었거나 스키마가 불일치합니다."
  echo "scripts/test-db-contract.ts를 확인하세요."
  exit 1
fi
echo "✅ DB Contract Gate 검증 통과"
echo ""

FUNCTIONS=(
  "ai-briefing-generation"
  "auto-billing-generation"
  "capacity-optimization-automation"
  "chatops"
  "consultation-ai-summary"
  "customer-retention-automation"
  "daily-statistics-update"
  "execute-student-task"
  "execute-task-card"
  "execution-audit-runs"
  "financial-automation-batch"
  "growth-marketing-automation"
  "monthly-business-report"
  "overdue-notification-scheduler"
  "payment-webhook-handler"
  "plan-upgrade"
  "safety-compliance-automation"
  "student-risk-analysis"
  "student-task-card-generation"
  "worker-process-job"
  "workforce-ops-automation"
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

