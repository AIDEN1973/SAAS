#!/bin/bash

# Supabase Edge Functions 배포 전 동기화 스크립트
# 소스 디렉토리(functions/)의 파일을 배포 디렉토리(supabase/functions/)로 동기화
#
# ⚠️ 중요:
# - 소스 파일은 functions/ 디렉토리에서만 수정하세요
# - supabase/functions/는 배포용이므로 직접 수정하지 마세요
# - 이 스크립트는 배포 전 자동으로 최신 파일을 동기화합니다

# set -e 제거: 일부 파일이 없어도 계속 진행

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.." || exit 1

echo "🔄 Supabase Edge Functions 파일 동기화 시작..."
echo "작업 디렉토리: $(pwd)"
echo ""
echo "⚠️ 주의: supabase/functions/ 디렉토리는 배포용입니다."
echo "   소스 파일은 functions/ 디렉토리에서만 수정하세요."
echo ""

# supabase/functions 디렉토리 구조 확인 및 생성
if [ ! -d "supabase/functions" ]; then
  echo "📁 supabase/functions 디렉토리 생성 중..."
  mkdir -p supabase/functions
else
  echo "🧹 기존 supabase/functions 디렉토리 정리 중..."
  # 기존 파일 제거 (구버전 방지)
  rm -rf supabase/functions/_shared
  rm -rf supabase/functions/*/
  mkdir -p supabase/functions/_shared
fi

# _shared 디렉토리 동기화
echo "📦 _shared 디렉토리 동기화 중..."
mkdir -p supabase/functions/_shared
cp -f functions/_shared/*.ts supabase/functions/_shared/ 2>/dev/null || true
SHARED_COUNT=$(ls -1 supabase/functions/_shared/*.ts 2>/dev/null | wc -l)
echo "✅ _shared 디렉토리 동기화 완료 ($SHARED_COUNT 개 파일)"

# 각 함수 디렉토리 동기화
echo "📦 함수 디렉토리 동기화 중..."
SYNC_COUNT=0

# functions/ 디렉토리의 모든 함수를 자동으로 찾아서 동기화
for func_dir in functions/*/; do
  if [ -d "$func_dir" ]; then
    func_name=$(basename "$func_dir")
    # _shared는 이미 동기화했으므로 제외
    if [ "$func_name" != "_shared" ]; then
      if [ -f "functions/$func_name/index.ts" ]; then
        mkdir -p "supabase/functions/$func_name"
        # index.ts 복사
        if cp -f "functions/$func_name/index.ts" "supabase/functions/$func_name/index.ts" 2>/dev/null; then
          # handlers/ 디렉토리가 있으면 복사
          if [ -d "functions/$func_name/handlers" ]; then
            mkdir -p "supabase/functions/$func_name/handlers"
            cp -rf "functions/$func_name/handlers"/* "supabase/functions/$func_name/handlers/" 2>/dev/null || true
          fi
          ((SYNC_COUNT++))
          echo "  ✅ $func_name"
        fi
      fi
    fi
  fi
done

echo "✅ 함수 디렉토리 동기화 완료 ($SYNC_COUNT 개 함수)"
echo ""
echo "=========================================="
echo "동기화 완료"
echo "  _shared 파일: $SHARED_COUNT 개"
echo "  함수 파일: $SYNC_COUNT 개"
echo "=========================================="

