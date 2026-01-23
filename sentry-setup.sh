#!/bin/bash

# Sentry 설정 스크립트
# 사용법: 아래 값들을 실제 값으로 변경한 후 실행

# Step 1: Sentry에서 가져온 값들
SENTRY_AUTH_TOKEN="여기에_새로_생성한_Auth_Token을_입력" # Settings > Developer Settings > Auth Tokens
SENTRY_ORG="rutz"  # 조직 이름
SENTRY_PROJECT="여기에_프로젝트_slug를_입력"  # 예: samdle-academy-admin

# Step 2: Supabase Edge Function에 환경 변수 설정
echo "Setting Sentry environment variables for Edge Functions..."
cd infra/supabase
supabase secrets set --project-ref xawypsrotrfoyozhrsbb \
  SENTRY_AUTH_TOKEN="$SENTRY_AUTH_TOKEN" \
  SENTRY_ORG="$SENTRY_ORG" \
  SENTRY_PROJECT="$SENTRY_PROJECT"

echo "✅ Sentry environment variables set successfully!"
echo ""
echo "확인:"
echo "supabase secrets list --project-ref xawypsrotrfoyozhrsbb | grep SENTRY"
