# psql ?ㅽ뻾 ?ㅽ겕由쏀듃
# ?ъ슜踰? .\run_sql.ps1 -ConnectionString 'postgresql://...'

param(
    [Parameter(Mandatory=$true)]
    [string]$ConnectionString
)

$sqlFile = "migrations\20251221160140_fix_tenants_rls_jwt_claim.sql"

if (Test-Path $sqlFile) {
    Write-Host "SQL ?뚯씪 ?ㅽ뻾 以? $sqlFile"
    Write-Host "?곌껐: $ConnectionString"
    Write-Host ""
    
    # psql???ㅼ튂?섏뼱 ?덈뒗吏 ?뺤씤
    if (Get-Command psql -ErrorAction SilentlyContinue) {
        psql $ConnectionString -f $sqlFile
    } else {
        Write-Host "psql???ㅼ튂?섏뼱 ?덉? ?딆뒿?덈떎."
        Write-Host "PostgreSQL ?대씪?댁뼵?몃? ?ㅼ튂?섍굅??Supabase Dashboard瑜??ъ슜?섏꽭??"
    }
} else {
    Write-Host "SQL ?뚯씪??李얠쓣 ???놁뒿?덈떎: $sqlFile"
}
