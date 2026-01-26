# Test Email Report - Quick Guide

## Cách Test Email Report cho lanfurama@gmail.com

### Option 1: Chạy Script Test (Nhanh nhất)

```bash
cd api
npm run test:email-report
```

Script này sẽ:
1. Tạo một cấu hình test tạm thời
2. Gửi email báo cáo ngay lập tức đến `lanfurama@gmail.com`
3. Xóa cấu hình test sau khi gửi xong

### Option 2: Tạo Config Qua UI

1. Đăng nhập với tài khoản **Director**
2. Vào menu **"Email Reports"** trong sidebar
3. Click **"New Configuration"**
4. Điền thông tin:
   - **Recipient Email**: `lanfurama@gmail.com`
   - **Recipient Name**: `Test Manager` (hoặc tên bạn muốn)
   - **Frequency**: Chọn `Daily` (hoặc Weekly/Monthly tùy bạn)
   - **Time**: Chọn giờ bạn muốn (ví dụ: 9:00)
   - **Enabled**: ✅ Bật
   - **Include Options**: Chọn tất cả các mục bạn muốn
5. Click **"Create"**
6. Click nút **Send** (icon Send) để gửi ngay lập tức

### Option 3: Tạo Config Qua API

```bash
curl -X POST http://localhost:3001/api/email-reports/config \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_email": "lanfurama@gmail.com",
    "recipient_name": "Test Manager",
    "frequency": "daily",
    "time_hour": 9,
    "time_minute": 0,
    "timezone": "Asia/Ho_Chi_Minh",
    "enabled": true,
    "include_stats": true,
    "include_new_leads": true,
    "include_email_activity": true,
    "include_top_leads": true,
    "top_leads_count": 10
  }'
```

Sau đó gửi thủ công:
```bash
curl -X POST http://localhost:3001/api/email-reports/send/{config_id}
```

## Kiểm Tra Email

Sau khi gửi, kiểm tra inbox của `lanfurama@gmail.com`:
- Email sẽ có subject: `📊 Báo Cáo CRM [Daily/Weekly/Monthly] - [Date Range]`
- Email sẽ có format HTML đẹp với các thống kê

## Lưu Ý

- Đảm bảo email credentials đã được cấu hình trong `.env`
- Nếu email không đến, kiểm tra:
  1. Spam folder
  2. Console logs của server
  3. Database table `email_reports_log` để xem error message
