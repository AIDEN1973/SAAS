# 디어쌤 환경변수 설정 스크립트
# 이 스크립트는 .env.example 파일을 기반으로 .env.local 파일을 생성합니다.

Write-Host "디어쌤 환경변수 설정 스크립트" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host ""

# 환경변수 템플릿
$envTemplate = @"
# Supabase 설정 (필수)
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
APP_VERSION=1.0.0
"@

# 루트 디렉토리에 중앙 환경변수 파일 생성
$envFile = ".env.local"

if (Test-Path $envFile) {
    Write-Host "[SKIP] $envFile 이미 존재합니다." -ForegroundColor Yellow
} else {
    # .env.local 파일 생성 (루트 디렉토리)
    $envTemplate | Out-File -FilePath $envFile -Encoding UTF8
    Write-Host "[CREATED] $envFile 생성 완료 (중앙 환경변수 파일)" -ForegroundColor Green
}

Write-Host ""
Write-Host "=================================" -ForegroundColor Green
Write-Host "환경변수 파일 생성 완료!" -ForegroundColor Green
Write-Host ""
Write-Host "다음 단계:" -ForegroundColor Yellow
Write-Host "1. 루트 디렉토리의 .env.local 파일을 열어서 Supabase 프로젝트 정보를 입력하세요"
Write-Host "2. Supabase 프로젝트: https://supabase.com"
Write-Host "3. 프로젝트 설정 > API Keys에서 다음 정보를 확인하세요:"
Write-Host "   - Project URL (SUPABASE_URL)"
Write-Host "   - anon/public key (SUPABASE_ANON_KEY)"
Write-Host "   - service_role key (SERVICE_ROLE_KEY) - 보안 주의!"
Write-Host ""
Write-Host "자세한 내용은 ENV_SETUP.md 파일을 참고하세요."

