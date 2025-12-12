# PowerShell script to rename api/src to api/lib
# Run this script: .\rename-api-src.ps1

Write-Host "Renaming api/src to api/lib..." -ForegroundColor Yellow

if (Test-Path "api\src") {
    Rename-Item -Path "api\src" -NewName "lib"
    Write-Host "✅ Successfully renamed api/src to api/lib" -ForegroundColor Green
} else {
    Write-Host "❌ api\src folder not found!" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Done! Now you can deploy to Vercel." -ForegroundColor Green
Write-Host "Only api/v1/[...path].ts will be detected as a Serverless Function." -ForegroundColor Cyan
