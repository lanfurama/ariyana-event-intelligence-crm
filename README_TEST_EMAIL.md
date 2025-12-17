# Test Email cho Lead ECINEQ

## Mục đích
File test để gửi email đến **youngbuffaok2@gmail.com** với nội dung của lead **"Society for the Study of Economic Inequality -ECINEQ-"**.

## Files đã tạo

### 1. `test_email_ecineq.html`
- File HTML preview email
- Mở bằng browser để xem trước nội dung email
- Có styling đẹp, responsive

### 2. `test_email_ecineq.json`
- File JSON chứa lead data và email content
- Có thể dùng để test API hoặc import vào hệ thống

### 3. `test_send_email_ecineq.js`
- Script Node.js để gửi email thực tế
- Cần cấu hình SMTP trong `.env` file

## Thông tin Lead

- **Company Name:** Society for the Study of Economic Inequality -ECINEQ-
- **Industry:** Economics
- **Location:** Rome, Italy
- **Website:** https://www.ecineq.org/
- **Key Person:** Flaviana Palmisano (Secretariat)
- **Email:** flaviana.palmisano@uniroma1.it
- **Delegates:** 250+
- **Event Type:** Biennial, World/International rotation

## Cách sử dụng

### Option 1: Xem preview HTML
```bash
# Mở file HTML trong browser
open test_email_ecineq.html
# hoặc
start test_email_ecineq.html  # Windows
```

### Option 2: Gửi email thực tế
1. Cấu hình SMTP trong `.env` file:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=marketing@furamavietnam.com
```

2. Chạy script:
```bash
cd api
node ../test_send_email_ecineq.js
```

### Option 3: Sử dụng API
```bash
# POST to /api/leads/send-emails với lead data từ test_email_ecineq.json
curl -X POST http://localhost:3001/api/leads/send-emails \
  -H "Content-Type: application/json" \
  -d @test_email_ecineq.json
```

## Nội dung Email

**Subject:** Proposal to host Society for the Study of Economic Inequality -ECINEQ- event at Ariyana Convention Centre

**Body:**
- Greeting với tên contact person
- Giới thiệu về organization và industry
- Mời tổ chức event tại Danang
- Highlight về venue (APEC 2017, facilities, delegates capacity)
- Call to action: arrange a call

## Lưu ý

- Email sẽ được gửi đến: **youngbuffaok2@gmail.com**
- Đây là email test, không phải email thực của lead
- Lead thực có email: flaviana.palmisano@uniroma1.it


