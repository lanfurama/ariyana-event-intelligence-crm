# Email Reply Tracking - Hướng dẫn sử dụng

## Tổng quan

Hệ thống đã được tích hợp tính năng theo dõi email replies/feedback tự động thông qua IMAP Inbox Monitoring.

## Cài đặt

### 1. Cài đặt dependencies

```bash
npm install imap mailparser @types/imap @types/mailparser
```

### 2. Chạy migration database

Chạy file migration để thêm các bảng và columns cần thiết:

```bash
psql -U your_username -d ariyana_crm -f migrations/add_email_reply_tracking.sql
```

Hoặc chạy SQL trực tiếp trong database:

```sql
-- Thêm message_id vào email_logs
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS message_id VARCHAR(500);
CREATE INDEX IF NOT EXISTS idx_email_logs_message_id ON email_logs(message_id);

-- Tạo bảng email_replies
CREATE TABLE IF NOT EXISTS email_replies (
    id VARCHAR(255) PRIMARY KEY,
    email_log_id VARCHAR(255) NOT NULL,
    lead_id VARCHAR(255) NOT NULL,
    from_email VARCHAR(255) NOT NULL,
    from_name VARCHAR(255),
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    html_body TEXT,
    reply_date TIMESTAMP NOT NULL,
    message_id VARCHAR(500),
    in_reply_to VARCHAR(500),
    references_header TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (email_log_id) REFERENCES email_logs(id) ON DELETE CASCADE,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- Tạo indexes
CREATE INDEX IF NOT EXISTS idx_email_replies_email_log_id ON email_replies(email_log_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_lead_id ON email_replies(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_reply_date ON email_replies(reply_date);
CREATE INDEX IF NOT EXISTS idx_email_replies_message_id ON email_replies(message_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_in_reply_to ON email_replies(in_reply_to);
```

### 3. Cấu hình environment variables

Thêm vào file `.env`:

```env
# IMAP Configuration (sử dụng cùng credentials với SMTP)
EMAIL_IMAP_HOST=imap.gmail.com  # Optional: auto-detected nếu không set
EMAIL_IMAP_PORT=993
# Note: EMAIL_HOST_USER và EMAIL_HOST_PASSWORD đã được cấu hình cho SMTP
```

#### Cấu hình cho các nhà cung cấp email khác nhau:

**Gmail:**
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_IMAP_HOST=imap.gmail.com
EMAIL_IMAP_PORT=993
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password  # Cần App Password, không dùng password thường
```

**Outlook.com (Personal):**
```env
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_IMAP_HOST=imap-mail.outlook.com
EMAIL_IMAP_PORT=993
EMAIL_HOST_USER=your-email@outlook.com
EMAIL_HOST_PASSWORD=your-password
```

**Office 365 / Microsoft 365:**
```env
EMAIL_HOST=smtp.office365.com
EMAIL_IMAP_HOST=outlook.office365.com
EMAIL_IMAP_PORT=993
EMAIL_HOST_USER=your-email@yourcompany.com
EMAIL_HOST_PASSWORD=your-password
```

**Lưu ý:**
- Hệ thống sẽ tự động detect IMAP host dựa trên domain của email nếu không set `EMAIL_IMAP_HOST`
- Với Gmail: cần tạo App Password (không dùng password thường)
- Với Outlook/Office 365: có thể cần bật IMAP trong cài đặt tài khoản

## Cách sử dụng

### 1. Tự động lưu Message-ID

Khi gửi email, hệ thống sẽ tự động:
- Lưu Message-ID vào `email_logs.message_id`
- Message-ID được dùng để match với replies

### 2. Check inbox thủ công

Trong LeadDetail, tab "AI Email":
- Click button "Check Inbox" để kiểm tra emails mới
- Hệ thống sẽ:
  - Kết nối đến inbox qua IMAP
  - Tìm emails mới (unread)
  - Match với emails đã gửi bằng:
    - In-Reply-To header
    - References header
    - Subject matching (fallback)
  - Lưu replies vào database

### 3. Xem replies

Replies được hiển thị:
- Trong LeadDetail, tab "Info" - phần "Email Replies"
- Trong LeadDetail, tab "AI Email" - phần "Email Replies"
- Hiển thị: From name/email, subject, date, preview body

## API Endpoints

### GET /api/email-replies
Lấy tất cả replies (có thể filter theo leadId hoặc emailLogId)

```javascript
// Lấy replies của một lead
GET /api/email-replies?leadId=lead-123

// Lấy replies của một email log
GET /api/email-replies?emailLogId=email-456
```

### GET /api/email-replies/:id
Lấy reply theo ID

### POST /api/email-replies/check-inbox
Check inbox thủ công

```javascript
POST /api/email-replies/check-inbox
Body: {
  since: "2024-01-01T00:00:00Z", // Optional: chỉ check emails sau ngày này
  maxEmails: 50 // Optional: giới hạn số emails (default: 50)
}
```

### DELETE /api/email-replies/:id
Xóa reply

## Cách hoạt động

1. **Khi gửi email:**
   - Nodemailer tạo Message-ID tự động
   - Message-ID được lưu vào `email_logs.message_id`

2. **Khi check inbox:**
   - Kết nối IMAP đến inbox
   - Tìm emails unread
   - Parse email headers:
     - `In-Reply-To`: Message-ID của email gốc
     - `References`: Danh sách Message-IDs liên quan
   - Match với `email_logs.message_id`
   - Nếu match, tạo record trong `email_replies`

3. **Matching logic:**
   - Ưu tiên 1: Match bằng In-Reply-To hoặc References header
   - Ưu tiên 2: Match bằng subject (nếu headers không có)

## Lưu ý

- Cần cấu hình IMAP credentials (EMAIL_HOST_USER, EMAIL_HOST_PASSWORD)
- Gmail cần App Password, không dùng password thường
- IMAP port mặc định: 993 (Gmail)
- Hệ thống chỉ check unread emails để tránh duplicate
- Có thể setup cron job để check inbox tự động định kỳ

## Troubleshooting

### Lỗi kết nối IMAP

**Gmail:**
- Kiểm tra EMAIL_HOST_USER và EMAIL_HOST_PASSWORD
- Cần tạo App Password (không dùng password thường):
  1. Vào Google Account → Security
  2. Bật 2-Step Verification
  3. Tạo App Password cho "Mail"
  4. Dùng App Password làm EMAIL_HOST_PASSWORD
- Kiểm tra firewall/network

**Outlook.com:**
- Đảm bảo IMAP đã được bật trong cài đặt tài khoản
- Vào Settings → Mail → Sync email → Enable IMAP
- Kiểm tra EMAIL_IMAP_HOST=imap-mail.outlook.com
- Có thể cần dùng App Password nếu bật 2FA

**Office 365:**
- Kiểm tra IMAP đã được enable trong Exchange Admin Center
- Kiểm tra EMAIL_IMAP_HOST=outlook.office365.com
- Có thể cần Modern Authentication (OAuth2) thay vì password
- Liên hệ IT admin nếu không kết nối được

### Không match được replies
- Kiểm tra Message-ID có được lưu trong email_logs không
- Kiểm tra email reply có In-Reply-To header không
- Thử check inbox lại
- Kiểm tra email có được gửi từ cùng tài khoản không

### Duplicate replies
- Hệ thống tự động check Message-ID để tránh duplicate
- Nếu vẫn bị, có thể do email có nhiều Message-ID
- Kiểm tra xem có nhiều email cùng In-Reply-To không

