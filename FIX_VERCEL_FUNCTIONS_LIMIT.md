# 🔧 Sửa lỗi: Quá nhiều Serverless Functions trên Vercel

## 🔴 Lỗi

```
Error: No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan. 
Create a team (Pro plan) to deploy more.
```

## 🔍 Nguyên nhân

Vercel tự động detect các file trong thư mục `api/` là Serverless Functions. Hiện tại có nhiều file `.ts` trong `api/src/routes/` và Vercel có thể đang tạo function riêng cho mỗi file.

## ✅ Giải pháp đã áp dụng

### 1. Đã sửa lỗi TypeScript ✅

Đã thêm property `organizationName` vào interface `OrganizationData`:

```typescript
export interface OrganizationData {
  name: string;
  organizationName?: string; // ✅ Đã thêm
  rawData: any;
  // ...
}
```

### 2. Đã cập nhật `.vercelignore` ✅

Đã thêm các thư mục không cần thiết vào `.vercelignore`:

```
api/src/
api/dist/
api/node_modules/
api/tsconfig.json
api/package.json
```

### 3. Kiến trúc hiện tại

- ✅ **1 Serverless Function duy nhất**: `api/v1/[...path].ts`
- ✅ Tất cả routes được mount vào Express app trong function này
- ✅ File này import tất cả routes từ `api/src/routes/`

## 🚀 Giải pháp khác (nếu vẫn gặp lỗi)

Nếu vẫn gặp lỗi sau khi đã cập nhật `.vercelignore`, bạn có thể thử các cách sau:

### Option 1: Đổi tên thư mục `api/src` → `api/lib`

Vercel chỉ detect các file trong `api/` có pattern cụ thể. Đổi tên `src` thành `lib` có thể giúp:

```powershell
# Đã có script sẵn
.\rename-api-src.ps1
```

Sau đó cập nhật imports trong `api/v1/[...path].ts`:

```typescript
// Thay đổi từ
import usersRouter from '../src/routes/users.js';
// Thành
import usersRouter from '../lib/routes/users.js';
```

### Option 2: Di chuyển routes ra ngoài `api/`

Tạo thư mục `server/` ở root level và di chuyển `api/src/` vào đó:

```
project/
  ├── api/
  │   └── v1/
  │       └── [...path].ts  # Chỉ function này
  └── server/               # Di chuyển api/src vào đây
      └── routes/
          └── ...
```

### Option 3: Sử dụng Vercel Pro Plan

Nếu cần nhiều hơn 12 functions, bạn có thể nâng cấp lên Pro plan ($20/tháng).

## 📋 Checklist

### Đã hoàn thành:
- [x] Sửa lỗi TypeScript (thêm `organizationName` vào interface)
- [x] Cập nhật `.vercelignore` để ignore `api/src/`
- [x] Xóa các file compiled khỏi Git tracking
- [x] Verify chỉ có `api/v1/[...path].ts` là function

### Cần làm tiếp:
- [ ] Commit và push changes
- [ ] Deploy lại trên Vercel
- [ ] Kiểm tra số lượng functions được tạo
- [ ] Nếu vẫn > 12 functions, thử Option 1 hoặc Option 2

## 🔍 Kiểm tra số lượng functions

Sau khi deploy, kiểm tra trong Vercel Dashboard:

1. Vào project → **Deployments**
2. Click vào deployment mới nhất
3. Vào tab **Functions**
4. Đếm số lượng functions

**Kỳ vọng**: Chỉ có 1 function: `api/v1/[...path]`

## 📝 Lưu ý

- Vercel Hobby plan giới hạn **12 Serverless Functions** mỗi deployment
- Mỗi file trong `api/` (trừ khi được ignore) sẽ được detect là function
- Chỉ cần 1 function với Express router để handle tất cả routes
- File `api/v1/[...path].ts` là catch-all route, sẽ handle tất cả requests

## ✅ Kết quả mong đợi

Sau khi áp dụng các thay đổi:
- ✅ Chỉ có 1 Serverless Function: `api/v1/[...path]`
- ✅ Tất cả routes hoạt động bình thường
- ✅ Không vượt quá giới hạn 12 functions
- ✅ Build và deploy thành công trên Vercel

