# 🔧 Hướng dẫn đổi tên api/src → api/lib

## ⚠️ Vấn đề

Vercel đang detect tất cả file `.ts` trong `api/` như Serverless Functions, dẫn đến vượt quá giới hạn 12 functions.

## ✅ Giải pháp: Đổi tên `api/src` → `api/lib`

Vercel chỉ detect files trực tiếp trong `api/` folder như functions. Đổi tên `src` thành `lib` sẽ tránh được vấn đề này.

## 📋 Các bước thực hiện

### Bước 1: Đổi tên thư mục

**Trong File Explorer hoặc Terminal:**
```bash
# Windows PowerShell
Rename-Item -Path "api\src" -NewName "lib"

# Hoặc trong File Explorer: Right-click → Rename
```

### Bước 2: Cập nhật imports

Đã cập nhật `api/v1/[...path].ts` để import từ `../lib/` thay vì `../src/`

### Bước 3: Cập nhật các file khác (nếu có)

Kiểm tra và cập nhật imports trong:
- `api/lib/routes/*.ts` (nếu có imports giữa các routes)
- `api/lib/models/*.ts` (nếu có imports giữa các models)

### Bước 4: Cập nhật tsconfig.json

Cập nhật `api/tsconfig.json`:
```json
{
  "compilerOptions": {
    ...
    "rootDir": "./lib",  // Đổi từ "./src"
    "outDir": "./dist",
    ...
  },
  "include": ["lib/**/*"]  // Đổi từ ["src/**/*"]
}
```

### Bước 5: Test và Deploy

1. Test local: `npm run dev:api` vẫn hoạt động
2. Deploy lên Vercel
3. Verify chỉ có 1 function được tạo (`api/v1/[...path].ts`)

## 🎯 Kết quả

Sau khi đổi tên:
- ✅ Vercel chỉ detect `api/v1/[...path].ts` như function
- ✅ `api/lib/` không được detect như functions
- ✅ Chỉ có **1 Serverless Function** → Tránh giới hạn 12 functions
- ✅ Code vẫn hoạt động bình thường

## 📝 Lưu ý

- Đảm bảo đổi tên thư mục trước khi commit
- Cập nhật tất cả imports liên quan
- Test kỹ trước khi deploy
