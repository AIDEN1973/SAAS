# Supabase Edge Functions 배포 스크립트 (PowerShell)
# 사용법: .\deploy.ps1 YOUR_PROJECT_REF
#
# 참고: 이 스크립트는 infra/supabase 디렉토리에서 실행해야 합니다.
#       Supabase CLI는 supabase/functions 디렉토리를 찾습니다.

param(
    [Parameter(Mandatory=$false)]
    [string]$ProjectRef = $env:SUPABASE_PROJECT_REF
)

if ([string]::IsNullOrEmpty($ProjectRef)) {
    Write-Host "❌ 오류: 프로젝트 ref가 필요합니다." -ForegroundColor Red
    Write-Host ""
    Write-Host "사용법:" -ForegroundColor Yellow
    Write-Host "  cd infra\supabase"
    Write-Host "  .\functions\deploy.ps1 YOUR_PROJECT_REF"
    Write-Host ""
    Write-Host "또는 환경변수로 설정:" -ForegroundColor Yellow
    Write-Host "  `$env:SUPABASE_PROJECT_REF = 'YOUR_PROJECT_REF'"
    Write-Host "  cd infra\supabase"
    Write-Host "  .\functions\deploy.ps1"
    Write-Host ""
    Write-Host "프로젝트 ref는 Supabase Dashboard → Settings → General에서 확인할 수 있습니다." -ForegroundColor Yellow
    exit 1
}

# infra/supabase 디렉토리로 이동
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $scriptDir "..")

# supabase/functions 디렉토리 구조 확인 및 생성
if (-not (Test-Path "supabase\functions")) {
    Write-Host "📁 supabase/functions 디렉토리 생성 중..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path "supabase" -Force | Out-Null
    Copy-Item -Path "functions" -Destination "supabase\functions" -Recurse -Force
}

Write-Host "🚀 Supabase Edge Functions 배포 시작" -ForegroundColor Green
Write-Host "프로젝트 Ref: $ProjectRef" -ForegroundColor Cyan
Write-Host "작업 디렉토리: $(Get-Location)" -ForegroundColor Cyan
Write-Host ""

$functions = @(
    "auto-billing-generation",
    "student-task-card-generation",
    "ai-briefing-generation",
    "daily-statistics-update",
    "overdue-notification-scheduler",
    "student-risk-analysis",
    "execute-student-task",
    "auto-message-suggestion",
    "consultation-ai-summary",
    "workforce-ops-automation",
    "capacity-optimization-automation",
    "growth-marketing-automation",
    "customer-retention-automation",
    "financial-automation-batch"
)

$successCount = 0
$failedCount = 0

foreach ($func in $functions) {
    Write-Host "📦 배포 중: $func" -ForegroundColor Yellow

    supabase functions deploy $func --project-ref $ProjectRef --use-api --yes

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ $func 배포 성공" -ForegroundColor Green
        $successCount++
    } else {
        Write-Host "❌ $func 배포 실패" -ForegroundColor Red
        $failedCount++
    }
    Write-Host ""
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "배포 완료" -ForegroundColor Green
Write-Host "  성공: $successCount" -ForegroundColor Green
Write-Host "  실패: $failedCount" -ForegroundColor $(if ($failedCount -gt 0) { "Red" } else { "Green" })
Write-Host "==========================================" -ForegroundColor Cyan

if ($failedCount -gt 0) {
    exit 1
}

