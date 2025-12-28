#!/bin/bash

# 모든 Edge Functions 배포 스크립트
# 사용법: ./deploy-all-functions.sh YOUR_PROJECT_REF

set -e

PROJECT_REF=$1

if [ -z "$PROJECT_REF" ]; then
  PROJECT_REF=$SUPABASE_PROJECT_REF
fi

if [ -z "$PROJECT_REF" ]; then
  echo "❌ 오류: 프로젝트 ref가 필요합니다."
  echo ""
  echo "사용법:"
  echo "  cd infra/supabase"
  echo "  ./deploy-all-functions.sh YOUR_PROJECT_REF"
  echo ""
  echo "또는 환경변수로 설정:"
  echo "  export SUPABASE_PROJECT_REF=YOUR_PROJECT_REF"
  echo "  cd infra/supabase"
  echo "  ./deploy-all-functions.sh"
  echo ""
  echo "프로젝트 ref는 Supabase Dashboard → Settings → General에서 확인할 수 있습니다."
  exit 1
fi

# infra/supabase 디렉토리로 이동
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

# ⚠️ 중요: 이제 supabase/functions/를 직접 사용합니다
if [ ! -d "supabase/functions" ]; then
  echo "❌ 오류: supabase/functions 디렉토리를 찾을 수 없습니다."
  echo "   supabase/functions/ 디렉토리가 존재하는지 확인해주세요."
  exit 1
fi

echo "🚀 모든 Supabase Edge Functions 배포 시작"
echo "프로젝트 Ref: $PROJECT_REF"
echo "작업 디렉토리: $(pwd)"
echo ""

# 모든 함수 디렉토리 찾기 (_shared 제외)
FUNCTIONS=($(ls -d supabase/functions/*/ | grep -v "_shared" | sed 's|supabase/functions/||' | sed 's|/$||' | sort))

if [ ${#FUNCTIONS[@]} -eq 0 ]; then
  echo "❌ 배포할 함수를 찾을 수 없습니다."
  exit 1
fi

echo "📋 배포할 함수 목록 (${#FUNCTIONS[@]}개):"
for func in "${FUNCTIONS[@]}"; do
  echo "  - $func"
done
echo ""

SUCCESS_COUNT=0
FAILED_COUNT=0
FAILED_FUNCTIONS=()

for func in "${FUNCTIONS[@]}"; do
  echo "📦 배포 중: $func"

  if supabase functions deploy "$func" --project-ref "$PROJECT_REF" --use-api --yes; then
    echo "✅ $func 배포 성공"
    ((SUCCESS_COUNT++))
  else
    echo "❌ $func 배포 실패"
    ((FAILED_COUNT++))
    FAILED_FUNCTIONS+=("$func")
  fi
  echo ""
done

echo "=========================================="
echo "배포 완료"
echo "  성공: $SUCCESS_COUNT"
echo "  실패: $FAILED_COUNT"
echo "=========================================="

if [ $FAILED_COUNT -gt 0 ]; then
  echo ""
  echo "❌ 배포 실패한 함수:"
  for func in "${FAILED_FUNCTIONS[@]}"; do
    echo "  - $func"
  done
  exit 1
fi

echo ""
echo "✅ 모든 함수 배포 완료!"

