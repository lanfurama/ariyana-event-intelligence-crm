# 🚨 URGENT: Fix Secret Leak in Git History

## Problem

GitHub đã phát hiện **OpenAI API Key** trong file `.env` đã bị commit vào git history ở commit `53fee5c6038d0c762815d57e430982d9359fd5be`.

## ⚠️ Immediate Actions Required

### 1. **ROTATE API KEY NGAY LẬP TỨC** 🔴

API key đã bị lộ, cần phải rotate (tạo key mới):

**OpenAI API Key:**
1. Vào https://platform.openai.com/api-keys
2. Xóa key cũ đã bị lộ
3. Tạo key mới
4. Cập nhật trong file `.env` local của bạn

**Nếu có Gemini API Key trong file đó:**
1. Vào https://aistudio.google.com/app/apikey
2. Xóa key cũ
3. Tạo key mới
4. Cập nhật trong file `.env`

### 2. Remove .env from Git History

Có 2 cách:

#### Option A: Sử dụng script PowerShell (Recommended)

```powershell
# Chạy script
.\fix-git-secrets.ps1
```

#### Option B: Manual với git filter-branch

```bash
# Remove .env from all commits
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

#### Option C: Sử dụng BFG Repo-Cleaner (Fastest)

```bash
# Download BFG: https://rtyley.github.io/bfg-repo-cleaner/
java -jar bfg.jar --delete-files .env
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### 3. Force Push (Sau khi đã xóa khỏi history)

⚠️ **WARNING:** Force push sẽ rewrite remote history. Đảm bảo team members đã được thông báo!

```bash
git push --force-with-lease origin main
```

Hoặc nếu bạn chắc chắn:

```bash
git push --force origin main
```

### 4. Verify .env is in .gitignore

Đảm bảo `.gitignore` có:
```
.env
.env.local
.env.*.local
*.env
!.env.example
```

### 5. Check Current Status

```bash
# Verify .env is NOT tracked
git ls-files | grep .env

# Should only show .env.example, NOT .env
```

## Prevention for Future

1. ✅ **Always check `.gitignore`** trước khi commit
2. ✅ **Use `git status`** để xem files sẽ được commit
3. ✅ **Never commit `.env` files**
4. ✅ **Use `env.example`** với placeholder values
5. ✅ **Enable GitHub Push Protection** (đã enable - đó là lý do push bị block)

## Checklist

- [ ] Rotate OpenAI API Key
- [ ] Rotate Gemini API Key (nếu có trong file)
- [ ] Remove .env from git history
- [ ] Verify .env is in .gitignore
- [ ] Force push to remote
- [ ] Notify team members
- [ ] Update .env file locally với keys mới

## Notes

- File `.env` hiện tại đã có trong `.gitignore` ✅
- Nhưng file đã bị commit vào history trước đó ❌
- Cần xóa khỏi history để GitHub không block nữa
- API keys cũ đã bị lộ, cần rotate ngay

## References

- GitHub Secret Scanning: https://docs.github.com/code-security/secret-scanning
- Git Filter Branch: https://git-scm.com/docs/git-filter-branch
- BFG Repo-Cleaner: https://rtyley.github.io/bfg-repo-cleaner/



