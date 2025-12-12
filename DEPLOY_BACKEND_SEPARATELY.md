# 🚀 Hướng dẫn Deploy Backend riêng để tránh giới hạn Vercel

## ⚠️ Vấn đề

Vercel Hobby plan chỉ cho phép tối đa 12 Serverless Functions. Project này có nhiều routes nên vượt quá giới hạn.

## ✅ Giải pháp: Deploy Backend riêng

### Option 1: Railway (Khuyến nghị - Free tier tốt) ⭐

1. **Tạo tài khoản Railway:**
   - Vào https://railway.app
   - Đăng nhập bằng GitHub

2. **Deploy Backend:**
   ```bash
   # Tại root project
   cd api
   
   # Railway sẽ tự động detect:
   # - Node.js project
   # - package.json
   # - Start command từ package.json
   ```

3. **Setup trong Railway Dashboard:**
   - New Project → Deploy from GitHub repo
   - Chọn repo của bạn
   - Root Directory: `api`
   - Railway sẽ tự động detect và deploy

4. **Environment Variables trong Railway:**
   ```
   DB_HOST=your_db_host
   DB_PORT=5432
   DB_NAME=your_db_name
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   PORT=3001
   NODE_ENV=production
   CORS_ORIGIN=https://your-frontend.vercel.app
   ```

5. **Lấy URL backend:**
   - Railway sẽ cung cấp URL: `https://your-api.up.railway.app`
   - Copy URL này

6. **Deploy Frontend trên Vercel:**
   - Set Environment Variable: `VITE_API_URL=https://your-api.up.railway.app`

### Option 2: Render

1. **Tạo tài khoản Render:**
   - Vào https://render.com
   - Đăng nhập bằng GitHub

2. **Tạo Web Service:**
   - New → Web Service
   - Connect GitHub repo
   - Settings:
     - **Name:** ariyana-api
     - **Root Directory:** `api`
     - **Environment:** Node
     - **Build Command:** `npm install`
     - **Start Command:** `tsx src/server.ts` hoặc `node dist/server.js`

3. **Environment Variables:**
   ```
   DB_HOST=your_db_host
   DB_PORT=5432
   DB_NAME=your_db_name
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   PORT=3001
   NODE_ENV=production
   CORS_ORIGIN=https://your-frontend.vercel.app
   ```

4. **Lấy URL và setup Frontend:**
   - Render URL: `https://ariyana-api.onrender.com`
   - Set `VITE_API_URL` trong Vercel

### Option 3: Fly.io (Free tier)

1. **Install Fly CLI:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login và setup:**
   ```bash
   cd api
   fly launch
   ```

3. **Setup environment variables:**
   ```bash
   fly secrets set DB_HOST=your_db_host
   fly secrets set DB_PASSWORD=your_password
   # ... etc
   ```

## 📋 Checklist

- [ ] Tạo tài khoản Railway/Render/Fly.io
- [ ] Deploy backend API
- [ ] Setup Environment Variables
- [ ] Test API endpoints (health check)
- [ ] Lấy backend URL
- [ ] Deploy frontend trên Vercel
- [ ] Set `VITE_API_URL` trong Vercel Environment Variables
- [ ] Test frontend kết nối với backend

## 🔧 Cập nhật Vercel Config

Sau khi deploy backend riêng, cập nhật `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

**Xóa phần `rewrites` và `functions`** vì không cần deploy API trên Vercel nữa.

## 🎯 Kết quả

- ✅ Frontend: Deploy trên Vercel (free)
- ✅ Backend: Deploy trên Railway/Render (free tier)
- ✅ Database: Vercel Postgres hoặc Railway Postgres
- ✅ Không bị giới hạn Serverless Functions
- ✅ Backend có thể scale độc lập

## 🆘 Troubleshooting

### Backend không start được
- Kiểm tra `package.json` có script `start` không
- Kiểm tra Environment Variables đã set đúng chưa
- Xem logs trong Railway/Render dashboard

### CORS errors
- Set `CORS_ORIGIN` trong backend = URL frontend Vercel
- Kiểm tra backend có enable CORS chưa

### Database connection fails
- Kiểm tra database credentials
- Kiểm tra database có allow external connections không
- Kiểm tra SSL connection (nếu cần)
