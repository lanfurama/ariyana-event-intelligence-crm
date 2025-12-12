# Thuật Toán Scoring Events - Backend Logic (Không dùng AI)

## 🎯 Mục tiêu
Tự động chấm điểm và xếp hạng các events từ file Excel/CSV import để tìm ra events phù hợp nhất cho Danang/Vietnam.

## 📊 Hệ thống chấm điểm (Tổng 100 điểm)

### 1. **History Score** (0-25 điểm)
**Mục đích**: Ưu tiên events đã từng tổ chức tại Vietnam hoặc Southeast Asia

- **25 điểm**: Đã có ít nhất 1 edition tại Vietnam
- **15 điểm**: Đã có edition tại Southeast Asia (Thailand, Singapore, Malaysia, Indonesia, Philippines, Myanmar, Cambodia, Laos, Brunei)
- **0 điểm**: Chưa từng tổ chức tại khu vực

**Logic implementation**: 
```javascript
calculateHistoryScore(editions) {
  - Kiểm tra từng edition
  - Nếu country = 'vietnam' hoặc 'vn' → return 25
  - Nếu country thuộc SEA countries → return 15
  - Còn lại → return 0
}
```

### 2. **Region Score** (0-25 điểm)
**Mục đích**: Ưu tiên events có tính chất khu vực châu Á

- **25 điểm**: Tên event chứa "ASEAN", "Asia", "Pacific", hoặc "APAC"
- **15 điểm**: Đã từng tổ chức tại các nước châu Á (China, Japan, Korea, India, Thailand, Singapore, Malaysia, Indonesia, Philippines, Vietnam, Taiwan, Hong Kong)
- **0 điểm**: Không có liên quan đến châu Á

**Logic implementation**:
```javascript
calculateRegionScore(eventName, editions) {
  - Check event name contains: asean, asia, pacific, apac → return 25
  - Check editions có country thuộc Asian countries → return 15
  - Còn lại → return 0
}
```

### 3. **Contact Score** (0-25 điểm)
**Mục đích**: Ưu tiên events có đầy đủ thông tin liên hệ

- **25 điểm**: Có cả email VÀ phone number
- **15 điểm**: Chỉ có email
- **0 điểm**: Không có thông tin liên hệ

**Logic implementation**:
```javascript
calculateContactScore(eventData, relatedContacts) {
  - Check các field: EMAIL, Email, email, keyPersonEmail, CONTACT_EMAIL
  - Check các field: PHONE, Phone, phone, keyPersonPhone, CONTACT_PHONE, TEL
  - Có cả 2 → return 25
  - Chỉ có email → return 15
  - Không có gì → return 0
}
```

### 4. **Delegates Score** (0-25 điểm)
**Mục đích**: Ưu tiên events quy mô lớn

- **25 điểm**: ≥ 500 delegates
- **20 điểm**: ≥ 300 delegates
- **10 điểm**: ≥ 100 delegates
- **0 điểm**: < 100 hoặc không có data

**Logic implementation**:
```javascript
calculateDelegatesScore(editions) {
  - Tìm max delegates từ các field: TOTATTEND, REGATTEND, Delegates, Attendees, Attendance
  - >= 500 → return 25
  - >= 300 → return 20
  - >= 100 → return 10
  - Còn lại → return 0
}
```

## 🏆 Phân loại kết quả

### High Priority (≥ 50 điểm)
- **Chiến lược**: Contact immediately
- **Ý nghĩa**: Event rất phù hợp với Danang, nên liên hệ ngay

### Medium Priority (30-49 điểm)
- **Chiến lược**: Follow up
- **Ý nghĩa**: Event có tiềm năng, theo dõi và liên hệ

### Low Priority (< 30 điểm)
- **Chiến lược**: Monitor
- **Ý nghĩa**: Event ít phù hợp, chỉ theo dõi

## 📝 Notes tự động

Hệ thống tự động generate notes dựa trên điểm:

- `historyScore >= 25`: "Has Vietnam events"
- `historyScore >= 15`: "Has Southeast Asia events"
- `regionScore >= 25`: "Regional event (ASEAN/Asia/Pacific)"
- `regionScore >= 15`: "Asian location"
- `delegatesScore >= 25`: "Large event (500+ delegates)"
- `delegatesScore >= 20`: "Medium event (300+ delegates)"
- `delegatesScore >= 10`: "Small event (100+ delegates)"

## ⚠️ Problems tự động detect

- `contactScore === 0`: "Missing contact information"
- `contactScore < 25`: "Missing phone number"
- `delegatesScore === 0`: "No delegate count data"
- `historyScore === 0 && regionScore === 0`: "No Asia/Vietnam history"

## 📊 Output Format

```json
{
  "companyName": "Event Name",
  "industry": "Medical/Technology/etc",
  "country": "Current location",
  "city": "Current city",
  "totalScore": 75,
  "historyScore": 25,
  "regionScore": 25,
  "contactScore": 15,
  "delegatesScore": 10,
  "vietnamEvents": 2,
  "totalEvents": 15,
  "numberOfDelegates": 450,
  "problems": ["Missing phone number"],
  "notes": "Has Vietnam events, Regional event (ASEAN/Asia/Pacific), Medium event (300+ delegates)",
  "nextStepStrategy": "High priority - Contact immediately",
  "pastEventsHistory": "2023: Bangkok, 2022: Singapore, 2021: Hanoi (Vietnam), ...",
  "status": "New"
}
```

## 🔄 Flow xử lý

1. **Import Excel/CSV** → Parse events từ sheet "Editions"
2. **Extract editions** → Mỗi event có nhiều editions (lịch sử tổ chức)
3. **Calculate scores** → Chạy 4 hàm scoring cho từng event
4. **Sort by totalScore** → Xếp hạng descending
5. **Generate report** → Tạo markdown table + JSON structured data
6. **Display results** → Hiển thị table với expandable details

## ✅ Không sử dụng AI

- ❌ **KHÔNG** call Gemini API
- ❌ **KHÔNG** call GPT API
- ✅ **CHỈ** dùng pure JavaScript logic
- ✅ Backend scoring algorithms
- ✅ Rule-based classification

## 🚀 Performance

- Xử lý ~10-20 events/giây
- Không bị rate limit
- Không tốn tiền API
- Kết quả instant, không cần chờ AI response
