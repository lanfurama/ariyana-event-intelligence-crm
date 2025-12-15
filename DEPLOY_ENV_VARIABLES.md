# 🔐 Hướng dẫn bảo vệ Environment Variables trên GitHub và Vercel

## ✅ Kiểm tra hiện tại

### 1. `.gitignore` đã được cấu hình đúng ✅

File `.gitignore` ở root đã bao gồm:
```
.env
.env.local
.env.*.local
*.env
!.env.example
```

**Kết quả kiểm tra:**
- ✅ File `.env` đã được Git bỏ qua (ignored)
- ✅ File `.env` KHÔNG được track trong Git
- ✅ Không có file `.env` nào trong Git history (sau khi đã xử lý leak trước đó)

### 2. Không có hardcoded secrets trong code ✅

- ✅ Tất cả API keys và credentials đều được đọc từ `process.env`
- ✅ Không có giá trị thực tế của secrets trong code

---

## 🚀 Cấu hình Environment Variables trên Vercel

### Bước 1: Đăng nhập vào Vercel Dashboard

1. Vào https://vercel.com và đăng nhập
2. Chọn project của bạn (ariyana-event-intelligence-crm)

### Bước 2: Thêm Environment Variables

1. Vào **Settings** → **Environment Variables**
2. Thêm từng biến môi trường cần thiết:

#### 🔑 Danh sách Environment Variables cần thêm:

```
DB_HOST=<your_database_host>
DB_PORT=5432
DB_NAME=ariyana_crm
DB_USER=<your_database_user>
DB_PASSWORD=<your_database_password>

GEMINI_API_KEY=<your_gemini_api_key>
OPENAI_API_KEY=<your_openai_api_key>

NODE_ENV=production
PORT=3001

CORS_ORIGIN=https://your-app.vercel.app
```

#### 📝 Hướng dẫn thêm từng biến:

1. Click **Add New**
2. Điền **Key** (ví dụ: `DB_HOST`)
3. Điền **Value** (giá trị thực tế từ file `.env` local của bạn)
4. Chọn **Environments**:
   - ✅ Production (bắt buộc)
   - ✅ Preview (khuyến nghị - để test trên preview deployments)
   - ✅ Development (tùy chọn - nếu bạn dùng Vercel CLI để dev)

5. Click **Save**

**Lặp lại** cho tất cả các biến môi trường ở trên.

### Bước 3: Vercel sẽ tự động load Environment Variables

Vercel sẽ tự động inject các environment variables vào `process.env` khi chạy serverless functions. Code của bạn đã được viết đúng cách:

```typescript
// api/src/config/database.ts
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ariyana_crm',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // ...
});

// api/src/routes/gemini.ts
const apiKey = process.env.GEMINI_API_KEY;

// api/src/routes/gpt.ts
const apiKey = process.env.OPENAI_API_KEY;
```

---

## 🔒 Bảo mật trên GitHub

### ✅ Đã được bảo vệ:

1. **`.gitignore` đã ignore `.env`** ✅
   - Git sẽ không track file `.env`
   - File `.env` sẽ không bao giờ được commit

2. **Sử dụng `env.example`** ✅
   - File `env.example` chỉ chứa placeholder values
   - File này được commit để làm template cho developers khác

### ⚠️ Checklist trước khi push lên GitHub:

```bash
# 1. Kiểm tra .env có bị track không
git ls-files | findstr /i "\.env"
# Kết quả: KHÔNG được có file .env

# 2. Kiểm tra git status
git status
# Đảm bảo .env KHÔNG xuất hiện trong "Changes to be committed"

# 3. Kiểm tra .gitignore
git check-ignore -v .env
# Kết quả: Phải show ".gitignore:19:*.env	.env"
```

### 🚨 Nếu vô tình commit .env (không nên xảy ra):

Nếu bạn vô tình commit `.env` vào Git:

1. **ROTATE API KEYS NGAY LẬP TỨC** 🔴
   - Đổi tất cả API keys và passwords
   
2. **Xóa khỏi Git history:**
   ```powershell
   # Sử dụng script có sẵn
   .\fix-git-secrets.ps1
   
   # Hoặc manual
   git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env" --prune-empty --tag-name-filter cat -- --all
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   ```

3. **Force push:**
   ```bash
   git push --force-with-lease origin main
   ```

---

## 🌐 Vercel Environment Variables Best Practices

### 1. **Không bao giờ commit `.env` file** ✅
   - Vercel sẽ đọc từ Environment Variables trong dashboard
   - Không cần file `.env` trên Vercel

### 2. **Sử dụng different values cho từng environment:**
   - Production: Database và API keys thật
   - Preview: Test database và test API keys
   - Development: Local database (nếu dùng Vercel CLI)

### 3. **Rotate keys định kỳ:**
   - Đổi API keys và passwords định kỳ
   - Đặc biệt nếu bạn nghi ngờ có leak

### 4. **Kiểm tra sau khi deploy:**
   - Test API endpoints để đảm bảo environment variables hoạt động
   - Check Vercel logs nếu có lỗi

### 5. **Sử dụng Vercel CLI để test local (tùy chọn):**
   ```bash
   # Pull environment variables từ Vercel
   vercel env pull .env.local
   ```

---

## 📋 Checklist Deployment

### Trước khi push lên GitHub:
- [ ] Kiểm tra `.gitignore` có `.env` ✅
- [ ] Kiểm tra `.env` không được track: `git ls-files | findstr .env`
- [ ] Kiểm tra `git status` không có `.env`
- [ ] Đảm bảo `env.example` có đầy đủ variables (chỉ placeholder values)

### Khi deploy lên Vercel:
- [ ] Đã thêm tất cả environment variables vào Vercel Dashboard
- [ ] Đã set đúng values (copy từ `.env` local)
- [ ] Đã chọn đúng environments (Production, Preview)
- [ ] Đã redeploy sau khi thêm environment variables
- [ ] Đã test API endpoints sau khi deploy
- [ ] Đã check Vercel logs để đảm bảo không có lỗi

---

## 🔍 Verify sau khi deploy

### 1. Kiểm tra Environment Variables có được load:

Vào Vercel Dashboard → **Deployments** → Click vào deployment mới nhất → **Runtime Logs**

Bạn sẽ thấy logs từ code:
```
📦 Database config: {
  host: 'your-db-host',
  port: '5432',
  database: 'ariyana_crm',
  user: 'your-user',
}
```

### 2. Test API endpoints:

```bash
# Test Gemini API
curl https://your-app.vercel.app/api/v1/gemini/chat

# Test GPT API  
curl https://your-app.vercel.app/api/v1/gpt/chat

# Test Database connection
curl https://your-app.vercel.app/api/v1/leads
```

---

## 📚 Tài liệu tham khảo

- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [GitHub Secret Scanning](https://docs.github.com/code-security/secret-scanning)
- [.gitignore best practices](https://git-scm.com/docs/gitignore)

---

## ⚡ Quick Commands

```bash
# Kiểm tra .env có bị track không
git ls-files | findstr /i "\.env"

# Kiểm tra .gitignore có ignore .env không
git check-ignore -v .env

# Xem git status (đảm bảo không có .env)
git status

# Pull env từ Vercel (tùy chọn)
vercel env pull .env.local
```

---

## ✅ Kết luận

Dự án của bạn **ĐÃ ĐƯỢC BẢO VỆ ĐÚNG CÁCH**:

1. ✅ `.gitignore` đã ignore `.env`
2. ✅ Không có `.env` trong Git
3. ✅ Code đã đọc từ `process.env` đúng cách
4. ✅ Có `env.example` làm template

**Chỉ cần:**
1. Thêm environment variables vào Vercel Dashboard
2. Deploy lại project
3. Test để đảm bảo mọi thứ hoạt động

**Nhớ:** Luôn kiểm tra `git status` trước khi commit để đảm bảo không có `.env` file! 🔒


