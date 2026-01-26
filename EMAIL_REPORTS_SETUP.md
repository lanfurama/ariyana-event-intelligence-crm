# Email Reports Setup Guide

## Tổng Quan

Tính năng **Auto Email Reports** cho phép hệ thống tự động gửi email báo cáo định kỳ cho manager để theo dõi tình hình hoạt động CRM.

## Cài Đặt

### 1. Chạy Database Migration

Chạy migration để tạo các bảng cần thiết:

```sql
-- Chạy file migration
\i migrations/002_add_email_reports_config.sql
```

Hoặc chạy trực tiếp SQL trong database:

```bash
psql -U your_user -d ariyana_crm -f migrations/002_add_email_reports_config.sql
```

### 2. Cài Đặt Dependencies

```bash
cd api
npm install
```

Package `node-cron` sẽ được tự động cài đặt.

### 3. Cấu Hình Email

Đảm bảo các biến môi trường sau đã được cấu hình trong `.env`:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your_marketing_email@furamavietnam.com
EMAIL_HOST_PASSWORD=your_app_password_here
DEFAULT_FROM_EMAIL=marketing@furamavietnam.com
```

## Cách Sử Dụng

### Qua Frontend UI (Khuyến nghị)

1. Đăng nhập với tài khoản **Director**
2. Vào menu **"Email Reports"** trong sidebar
3. Click **"New Configuration"** để tạo cấu hình mới
4. Điền thông tin:
   - **Recipient Email**: Email của manager nhận báo cáo
   - **Recipient Name**: Tên manager (optional)
   - **Frequency**: Chọn Daily/Weekly/Monthly
   - **Time**: Thời gian gửi (giờ:phút)
   - **Include Options**: Chọn các phần muốn có trong báo cáo
5. Click **"Create"** để lưu

### Qua API

#### Tạo Configuration

```bash
POST /api/v1/email-reports/config
Content-Type: application/json

{
  "recipient_email": "manager@example.com",
  "recipient_name": "Manager Name",
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
}
```

#### Gửi Báo Cáo Thủ Công

```bash
POST /api/v1/email-reports/send/{config_id}
```

#### Xem Logs

```bash
GET /api/v1/email-reports/logs?config_id={config_id}&limit=50
```

## Nội Dung Báo Cáo

Báo cáo email bao gồm các phần sau (tùy chọn):

### 1. Tổng Quan Thống Kê
- Tổng số leads
- Leads mới trong kỳ
- Leads đã liên hệ
- Leads đã qualify
- Email đã gửi
- Replies nhận được
- Tỷ lệ reply

### 2. Hoạt Động Email
- Thống kê email gửi/nhận
- Biểu đồ email theo ngày
- Tỷ lệ reply

### 3. Leads Mới
- Danh sách leads mới trong kỳ
- Phân bố theo trạng thái
- Top quốc gia

### 4. Top Leads
- Top N leads có điểm cao nhất
- Thông tin chi tiết từng lead

## Lịch Gửi

- **Daily**: Gửi mỗi ngày vào giờ đã cấu hình
- **Weekly**: Gửi vào ngày trong tuần đã chọn (0=Chủ Nhật, 1=Thứ 2, ...)
- **Monthly**: Gửi vào ngày trong tháng đã chọn (1-28)

## Scheduled Job

Scheduled job tự động chạy mỗi phút để kiểm tra và gửi báo cáo theo lịch đã cấu hình.

Job được tự động khởi động khi server start.

## Troubleshooting

### Email không được gửi

1. Kiểm tra email credentials trong `.env`
2. Kiểm tra logs trong database table `email_reports_log`
3. Kiểm tra console logs của server

### Báo cáo không đúng thời gian

1. Kiểm tra timezone trong cấu hình
2. Đảm bảo server timezone đúng
3. Kiểm tra `time_hour` và `time_minute` trong config

### Scheduled job không chạy

1. Kiểm tra console logs khi server start
2. Đảm bảo `node-cron` đã được cài đặt
3. Kiểm tra xem có error trong server logs không

## API Endpoints

- `GET /api/v1/email-reports/config` - Lấy tất cả configs
- `GET /api/v1/email-reports/config/:id` - Lấy config theo ID
- `POST /api/v1/email-reports/config` - Tạo config mới
- `PUT /api/v1/email-reports/config/:id` - Cập nhật config
- `DELETE /api/v1/email-reports/config/:id` - Xóa config
- `POST /api/v1/email-reports/send/:id` - Gửi báo cáo thủ công
- `POST /api/v1/email-reports/trigger` - Trigger tất cả reports
- `GET /api/v1/email-reports/logs` - Xem logs

## Database Tables

### email_reports_config
Lưu trữ cấu hình báo cáo email

### email_reports_log
Lưu trữ lịch sử gửi báo cáo (thành công/thất bại)
