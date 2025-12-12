# 🔧 Fix: API không hoạt động trong Dev Mode

## ❌ Vấn đề

API trả về HTML thay vì JSON, có nghĩa là vite-plugin-api không được load hoặc middleware không được register.

## ✅ Giải pháp tạm thời

**Restart dev server và kiểm tra console logs:**

```bash
# Dừng server hiện tại (Ctrl+C)
npm run dev
```

**Bạn sẽ thấy một trong các message sau:**

1. ✅ `✅ vite-plugin-api loaded successfully` 
   → Plugin đã load
   → Kiểm tra tiếp: `✅ API middleware integrated into Vite dev server`
   
2. ❌ `❌ vite-plugin-api could not be loaded: ...`
   → Có lỗi khi load plugin
   → Kiểm tra error message để debug

## 🔍 Debug Steps

### 1. Kiểm tra vite-plugin-api có load không:
- Xem console khi start `npm run dev`
- Tìm message về vite-plugin-api

### 2. Kiểm tra middleware có register không:
- Tìm message: `✅ API middleware integrated into Vite dev server`
- Nếu không có → middleware chưa được register

### 3. Test API endpoint trực tiếp:
```bash
curl http://localhost:3000/api/v1/health
```
- Nếu trả về JSON → API hoạt động
- Nếu trả về HTML → middleware không hoạt động

## 🚀 Solution

Nếu plugin không load, có thể do:
1. TypeScript file không được resolve đúng
2. Module system conflict (ESM vs CommonJS)

**Quick fix:** Đảm bảo restart dev server và check logs.

