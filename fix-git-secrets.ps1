# Script to remove .env file from git history
# This will remove the file from all commits

Write-Host "⚠️  WARNING: This script will rewrite git history!" -ForegroundColor Yellow
Write-Host "⚠️  Make sure you have a backup and all team members are aware!" -ForegroundColor Yellow
Write-Host ""
$confirm = Read-Host "Type 'yes' to continue"

if ($confirm -ne "yes") {
    Write-Host "Cancelled." -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "🔍 Checking if .env file exists in git history..." -ForegroundColor Cyan

# Check if .env is tracked
$envTracked = git ls-files | Select-String -Pattern "^\.env$"
if ($envTracked) {
    Write-Host "❌ .env file is currently tracked in git!" -ForegroundColor Red
    Write-Host "Removing from git index..." -ForegroundColor Yellow
    git rm --cached .env
    Write-Host "✅ Removed .env from git index" -ForegroundColor Green
}

# Remove from git history using git filter-branch
Write-Host ""
Write-Host "🧹 Removing .env from git history..." -ForegroundColor Cyan
Write-Host "This may take a few minutes..." -ForegroundColor Yellow

# Use BFG Repo-Cleaner if available, otherwise use git filter-branch
$bfgAvailable = Get-Command bfg -ErrorAction SilentlyContinue

if ($bfgAvailable) {
    Write-Host "Using BFG Repo-Cleaner (faster)..." -ForegroundColor Green
    bfg --delete-files .env
    git reflog expire --expire=now --all
    git gc --prune=now --aggressive
} else {
    Write-Host "Using git filter-branch (slower)..." -ForegroundColor Yellow
    git filter-branch --force --index-filter `
        "git rm --cached --ignore-unmatch .env" `
        --prune-empty --tag-name-filter cat -- --all
}

Write-Host ""
Write-Host "✅ Done! .env file has been removed from git history" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Verify .env is in .gitignore (already done)" -ForegroundColor White
Write-Host "2. Force push to remote (if you're sure):" -ForegroundColor White
Write-Host "   git push --force-with-lease origin main" -ForegroundColor Yellow
Write-Host "3. ⚠️  IMPORTANT: Rotate your OpenAI API key!" -ForegroundColor Red
Write-Host "   - Go to https://platform.openai.com/api-keys" -ForegroundColor White
Write-Host "   - Delete the exposed key" -ForegroundColor White
Write-Host "   - Create a new key" -ForegroundColor White
Write-Host "   - Update your .env file with the new key" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  WARNING: Force pushing will rewrite remote history!" -ForegroundColor Red
Write-Host "   Make sure all team members are aware and have pulled latest changes." -ForegroundColor Yellow



