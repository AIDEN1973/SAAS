#!/bin/bash

# 디어쌤 환경변수 설정 스크립트
# 이 스크립트는 .env.example 파일을 기반으로 .env.local 파일을 생성합니다.

echo "디어쌤 환경변수 설정 스크립트"
echo "================================="
echo ""

# 환경변수 템플릿
ENV_TEMPLATE="# Supabase 설정 (필수)
# Supabase 프로젝트 대시보드에서 확인 가능
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SERVICE_ROLE_KEY=your-service-role-key-here

# 클라이언트 환경변수 (필수)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Node 환경
NODE_ENV=development

# 공통 설정
APP_NAME=디어쌤
APP_VERSION=1.0.0"

# 각 앱 디렉토리
APP_DIRS=(
    "apps/academy-admin"
    "apps/academy-parent"
    "apps/super-admin"
    "apps/public-gateway"
    "packages/env-registry"
)

for dir in "${APP_DIRS[@]}"; do
    env_file="$dir/.env.local"
    
    if [ -f "$env_file" ]; then
        echo "[SKIP] $env_file 이미 존재합니다."
    else
        # 디렉토리가 없으면 생성
        mkdir -p "$(dirname "$env_file")"
        
        # .env.local 파일 생성
        echo "$ENV_TEMPLATE" > "$env_file"
        echo "[CREATED] $env_file 생성 완료"
    fi
done

echo ""
echo "================================="
echo "환경변수 파일 생성 완료!"
echo ""
echo "다음 단계:"
echo "1. 각 .env.local 파일을 열어서 Supabase 프로젝트 정보를 입력하세요"
echo "2. Supabase 프로젝트: https://supabase.com"
echo "3. 프로젝트 설정 > API Keys에서 다음 정보를 확인하세요:"
echo "   - Project URL (SUPABASE_URL)"
echo "   - anon/public key (SUPABASE_ANON_KEY)"
echo "   - service_role key (SERVICE_ROLE_KEY) - 보안 주의!"
echo ""
echo "자세한 내용은 ENV_SETUP.md 파일을 참고하세요."

