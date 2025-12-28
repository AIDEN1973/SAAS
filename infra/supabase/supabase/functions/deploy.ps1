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
    Write-Host "  .\supabase\supabase\functions\deploy.ps1 YOUR_PROJECT_REF"
    Write-Host ""
    Write-Host "또는 환경변수로 설정:" -ForegroundColor Yellow
    Write-Host "  `$env:SUPABASE_PROJECT_REF = 'YOUR_PROJECT_REF'"
    Write-Host "  cd infra\supabase"
    Write-Host "  .\supabase\supabase\functions\deploy.ps1"
    Write-Host ""
    Write-Host "프로젝트 ref는 Supabase Dashboard → Settings → General에서 확인할 수 있습니다." -ForegroundColor Yellow
    exit 1
}

# infra/supabase 디렉토리로 이동
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $scriptDir "../../..")

# ⚠️ 중요: 이제 supabase/supabase/functions/가 소스 디렉토리입니다
# 동기화 단계가 필요 없습니다. 직접 수정하고 배포하세요.

Write-Host "🚀 Supabase Edge Functions 배포 시작" -ForegroundColor Green
Write-Host "프로젝트 Ref: $ProjectRef" -ForegroundColor Cyan
Write-Host "작업 디렉토리: $(Get-Location)" -ForegroundColor Cyan
Write-Host ""

# ⚠️ P1: DB Contract Gate 검증 (배포 전 자동 실행)
# 붕괴사전예방.md Layer B 참조: CI/CD 파이프라인 자동 통합
Write-Host "🔍 DB Contract Gate 검증 실행 중..." -ForegroundColor Yellow
$dbContractResult = npm run test:db-contract
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ DB Contract Gate 검증 실패 - 배포 중단" -ForegroundColor Red
    Write-Host "마이그레이션이 누락되었거나 스키마가 불일치합니다." -ForegroundColor Red
    Write-Host "scripts/test-db-contract.ts를 확인하세요." -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ DB Contract Gate 검증 통과" -ForegroundColor Green
Write-Host ""

$functions = @(
    "ai-briefing-generation",
    "auto-billing-generation",
    "capacity-optimization-automation",
    "chatops",
    "consultation-ai-summary",
    "customer-retention-automation",
    "daily-statistics-update",
    "execute-student-task",
    "execute-task-card",
    "execution-audit-runs",
    "financial-automation-batch",
    "growth-marketing-automation",
    "monthly-business-report",
    "overdue-notification-scheduler",
    "payment-webhook-handler",
    "plan-upgrade",
    "safety-compliance-automation",
    "student-risk-analysis",
    "student-task-card-generation",
    "worker-process-job",
    "workforce-ops-automation"
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

