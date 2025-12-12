# Script to remove .env file from git history
# Run this from the root of your git repository

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Remove .env from Git History" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in a git repository
if (-not (Test-Path ".git")) {
    Write-Host "❌ Error: Not a git repository!" -ForegroundColor Red
    Write-Host "Please run this script from the root of your git repository." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Git repository detected" -ForegroundColor Green
Write-Host ""

# Step 1: Remove .env from git index if it's tracked
Write-Host "Step 1: Checking if .env is tracked..." -ForegroundColor Cyan
$envTracked = git ls-files | Select-String -Pattern "^\.env$"
if ($envTracked) {
    Write-Host "⚠️  .env file is currently tracked in git!" -ForegroundColor Yellow
    Write-Host "Removing from git index..." -ForegroundColor Yellow
    git rm --cached .env 2>&1 | Out-Null
    Write-Host "✅ Removed .env from git index" -ForegroundColor Green
} else {
    Write-Host "✅ .env is not currently tracked (good!)" -ForegroundColor Green
}

Write-Host ""

# Step 2: Remove from git history
Write-Host "Step 2: Removing .env from git history..." -ForegroundColor Cyan
Write-Host "This will rewrite git history - this may take a few minutes..." -ForegroundColor Yellow
Write-Host ""

# Check if BFG is available
$bfgAvailable = Get-Command bfg -ErrorAction SilentlyContinue

if ($bfgAvailable) {
    Write-Host "Using BFG Repo-Cleaner (faster method)..." -ForegroundColor Green
    bfg --delete-files .env
    git reflog expire --expire=now --all
    git gc --prune=now --aggressive
} else {
    Write-Host "Using git filter-branch (slower method)..." -ForegroundColor Yellow
    Write-Host "Note: This may take 5-10 minutes for large repositories" -ForegroundColor Yellow
    Write-Host ""
    
    # Use git filter-branch
    git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env" --prune-empty --tag-name-filter cat -- --all
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Cleaning up..." -ForegroundColor Cyan
        git reflog expire --expire=now --all
        git gc --prune=now --aggressive
    } else {
        Write-Host ""
        Write-Host "❌ Error running git filter-branch" -ForegroundColor Red
        Write-Host "You may need to install BFG Repo-Cleaner for better performance:" -ForegroundColor Yellow
        Write-Host "https://rtyley.github.io/bfg-repo-cleaner/" -ForegroundColor Cyan
        exit 1
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ Done! .env has been removed from git history" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Step 3: Verify .env is in .gitignore
Write-Host "Step 3: Verifying .gitignore..." -ForegroundColor Cyan
if (Test-Path ".gitignore") {
    $gitignoreContent = Get-Content ".gitignore" -Raw
    if ($gitignoreContent -match "\.env") {
        Write-Host "✅ .env is in .gitignore" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Warning: .env is NOT in .gitignore!" -ForegroundColor Yellow
        Write-Host "Adding .env to .gitignore..." -ForegroundColor Yellow
        Add-Content ".gitignore" "`n# Environment variables - CRITICAL: Never commit these!`n.env`n.env.local`n.env.*.local`n*.env`n!.env.example"
        Write-Host "✅ Added .env to .gitignore" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  Warning: .gitignore file not found!" -ForegroundColor Yellow
    Write-Host "Creating .gitignore with .env..." -ForegroundColor Yellow
    @"
# Environment variables - CRITICAL: Never commit these!
.env
.env.local
.env.*.local
*.env
!.env.example
"@ | Out-File ".gitignore" -Encoding UTF8
    Write-Host "✅ Created .gitignore with .env" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. ⚠️  CRITICAL: Rotate your API keys immediately!" -ForegroundColor Red
Write-Host "   - OpenAI: https://platform.openai.com/api-keys" -ForegroundColor White
Write-Host "   - Gemini: https://aistudio.google.com/app/apikey" -ForegroundColor White
Write-Host ""
Write-Host "2. Review the changes:" -ForegroundColor Yellow
Write-Host "   git log --oneline --all | Select-Object -First 10" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Force push to remote (⚠️  WARNING: This rewrites remote history):" -ForegroundColor Yellow
Write-Host "   git push --force-with-lease origin main" -ForegroundColor Gray
Write-Host ""
Write-Host "   Or if you're sure:" -ForegroundColor Yellow
Write-Host "   git push --force origin main" -ForegroundColor Gray
Write-Host ""
Write-Host "4. ⚠️  IMPORTANT: Notify all team members!" -ForegroundColor Red
Write-Host "   They need to re-clone or reset their local repos:" -ForegroundColor Yellow
Write-Host "   git fetch origin" -ForegroundColor Gray
Write-Host "   git reset --hard origin/main" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Update your local .env file with new API keys" -ForegroundColor Yellow
Write-Host ""



