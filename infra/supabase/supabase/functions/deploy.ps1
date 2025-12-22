# Supabase Edge Functions 배포 스크립트 (PowerShell)
# 사용법: .\deploy.ps1 YOUR_PROJECT_REF

param(
    [Parameter(Mandatory=$false)]
    [string]$ProjectRef = $env:SUPABASE_PROJECT_REF
)

if ([string]::IsNullOrEmpty($ProjectRef)) {
    Write-Host "❌ 오류: 프로젝트 ref가 필요합니다." -ForegroundColor Red
    Write-Host ""
    Write-Host "사용법:" -ForegroundColor Yellow
    Write-Host "  .\deploy.ps1 YOUR_PROJECT_REF"
    Write-Host ""
    Write-Host "또는 환경변수로 설정:" -ForegroundColor Yellow
    Write-Host "  `$env:SUPABASE_PROJECT_REF = 'YOUR_PROJECT_REF'"
    Write-Host "  .\deploy.ps1"
    exit 1
}

Write-Host "🚀 Supabase Edge Functions 배포 시작" -ForegroundColor Green
Write-Host "프로젝트 Ref: $ProjectRef" -ForegroundColor Cyan
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
    "consultation-summary-worker",
    "daily-automation-digest",
    "financial-automation-batch",
    "customer-retention-automation",
    "capacity-optimization-automation",
    "growth-marketing-automation",
    "safety-compliance-automation",
    "workforce-ops-automation",
    "monthly-business-report",
    "payment-webhook-handler"
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

