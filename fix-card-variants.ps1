# 카드 variant 일괄 수정 스크립트
# 규칙: 단독 카드는 outlined, 그리드 내 카드는 elevated 유지

$files = @(
    "apps\academy-admin\src\pages\AnalyticsPage.tsx",
    "apps\academy-admin\src\pages\BillingPage.tsx",
    "apps\academy-admin\src\pages\ClassesPage.tsx",
    "apps\academy-admin\src\pages\TeachersPage.tsx"
)

foreach ($file in $files) {
    Write-Host "Processing $file..."

    $content = Get-Content $file -Raw

    # 로딩/에러/빈 상태 카드 (단독) → outlined
    $content = $content -replace '(\{/\*.*?로딩.*?\*/\}.*?<Card padding="lg" variant=")elevated(")', '$1outlined$2'
    $content = $content -replace '(\{/\*.*?에러.*?\*/\}.*?<Card padding="lg" variant=")elevated(")', '$1outlined$2'
    $content = $content -replace '(\{/\*.*?빈.*?\*/\}.*?<Card padding="lg" variant=")elevated(")', '$1outlined$2'
    $content = $content -replace '(데이터가 없습니다.*?<Card padding="lg" variant=")elevated(")', '$1outlined$2'

    # 필터/액션/탭 카드 (단독) → outlined
    $content = $content -replace '(\{/\*.*?필터.*?\*/\}.*?<Card padding="lg" variant=")elevated(")', '$1outlined$2'
    $content = $content -replace '(\{/\*.*?액션.*?\*/\}.*?<Card padding="lg" variant=")elevated(")', '$1outlined$2'
    $content = $content -replace '(\{/\*.*?탭.*?\*/\}.*?<Card padding="lg" variant=")elevated(")', '$1outlined$2'

    Set-Content $file $content -NoNewline
    Write-Host "✓ $file updated"
}

Write-Host "`nAll files updated successfully!"
