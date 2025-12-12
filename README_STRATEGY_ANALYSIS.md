# 🎯 Ariyana Event Intelligence CRM - Strategy Analysis

## ✅ Tóm tắt chức năng hiện tại

### 📊 **Strategy Analysis (Backend Logic - NO AI)**

Hệ thống tự động phân tích và xếp hạng events từ Excel/CSV để tìm ra events phù hợp nhất cho Danang Convention Centre.

## 🚀 Quick Start

### 1. Import Data
```
- Click "Upload Excel/CSV"
- Chọn file ICCA format (phải có sheet "Editions")
- Hoặc paste data vào text area
```

### 2. Run Analysis
```
- Click "Run Strategy Analysis"
- Chờ hệ thống xử lý (instant, không cần AI)
- Xem kết quả real-time
```

### 3. View Results
```
- Bảng xếp hạng events theo điểm
- Click tên event để xem chi tiết
- Export results nếu cần
```

## 📊 Thuật toán Scoring (100 điểm)

### Breakdown:
- **History Score** (25 điểm): Ưu tiên events đã tổ chức VN/SEA
- **Region Score** (25 điểm): Ưu tiên events Asia/Pacific
- **Contact Score** (25 điểm): Ưu tiên events có email + phone
- **Delegates Score** (25 điểm): Ưu tiên events quy mô lớn (>500)

### Priority Classification:
- 🔴 **High (≥50)**: Contact immediately
- 🟡 **Medium (30-49)**: Follow up
- ⚪ **Low (<30)**: Monitor

## ✅ Ưu điểm Backend Logic

| Feature | AI-based | Backend Logic |
|---------|----------|---------------|
| Speed | Slow (5-10s/event) | ⚡ Instant |
| Cost | 💰 Expensive | ✅ Free |
| Rate Limit | ❌ Yes | ✅ No |
| Consistency | ⚠️ Variable | ✅ 100% |
| Reliability | ⚠️ API dependent | ✅ Always works |

## 📁 Project Structure

```
ariyana-event-intelligence-crm/
├── App.tsx                          # Main application
├── SCORING_LOGIC.md                 # Chi tiết thuật toán scoring
├── STRATEGY_ANALYSIS_GUIDE.md       # Hướng dẫn sử dụng
└── README_STRATEGY_ANALYSIS.md      # File này
```

## 🔧 Technical Details

### Scoring Functions

```typescript
// 1. History Score (0-25)
calculateHistoryScore(editions) → number
// Kiểm tra lịch sử tổ chức VN/SEA

// 2. Region Score (0-25)
calculateRegionScore(eventName, editions) → number
// Kiểm tra tính chất khu vực châu Á

// 3. Contact Score (0-25)
calculateContactScore(eventData, contacts) → number
// Kiểm tra thông tin liên hệ

// 4. Delegates Score (0-25)
calculateDelegatesScore(editions) → number
// Kiểm tra quy mô event
```

### Main Function

```typescript
scoreEventLocally(event, allExcelData) → Promise<ScoredEvent>
// Tổng hợp 4 scores + extract data → return structured result
```

## 📊 Output Format

```json
{
  "companyName": "Event Name",
  "totalScore": 75,
  "historyScore": 25,
  "regionScore": 25,
  "contactScore": 15,
  "delegatesScore": 10,
  "vietnamEvents": 2,
  "numberOfDelegates": 450,
  "nextStepStrategy": "High priority - Contact immediately",
  "notes": "Has Vietnam events, Regional event...",
  "problems": ["Missing phone number"]
}
```

## 🎯 Use Cases

### ✅ Phù hợp cho:
- Phân tích nhanh 10-1000 events
- Scoring consistent, không thay đổi
- Không cần explain logic (rule-based)
- Không tốn budget API

### ⚠️ Limitations:
- Không hiểu ngữ cảnh phức tạp
- Không thể reason về special cases
- Fixed rules, không adaptive

## 🔄 Future Enhancements (Optional)

### Có thể thêm AI cho:
1. **Email generation**: AI viết email personalized
2. **Data enrichment**: AI tìm thêm thông tin missing
3. **Industry insights**: AI phân tích trend industry
4. **Smart recommendations**: AI suggest strategy

### NHƯNG:
- ✅ Backend scoring vẫn là main engine
- ✅ AI chỉ là addon, không phải core
- ✅ System vẫn chạy được nếu AI fail

## 📝 Example Workflow

```
1. User uploads ICCA-2024-Events.xlsx
   └─ System parses 500 events

2. User clicks "Run Strategy Analysis"
   └─ Backend scores all 500 events in 25 seconds
   
3. Results displayed:
   ├─ Top 50 events (score ≥ 50)
   ├─ Medium 100 events (score 30-49)
   └─ Low 350 events (score < 30)

4. User clicks top event:
   └─ Modal shows full details + history + problems

5. User clicks "Export Event Brief"
   └─ System generates Word doc with event info
```

## 🐛 Debugging

### Console logs khi chạy analysis:

```
🔵 [Strategic Analysis] Starting analysis...
📊 [Strategic Analysis] Input mode: import
📊 [Strategic Analysis] Events list: 500
🤖 [Scoring Method] Using BACKEND LOGIC (No AI)
📝 [Scoring Criteria] History(25) + Region(25) + Contact(25) + Delegates(25) = Total(100)

📊 [Local Scoring] Scoring event: APAC Medical Congress
  └─ Editions found: 15
  ├─ History Score: 25/25 (Vietnam/SEA events)
  ├─ Region Score: 25/25 (Asia/Pacific relevance)
  ├─ Contact Score: 25/25 (Email/Phone availability)
  ├─ Delegates Score: 25/25 (Event size)
  └─ TOTAL SCORE: 100/100

✅ [Agent 1] Completed scoring for: APAC Medical Congress (Score: 100)
```

## 📞 Support

Nếu có vấn đề:
1. Check console logs
2. Xem file SCORING_LOGIC.md
3. Verify Excel format (phải có sheet "Editions")

---

**Version**: 2.0 - Backend Logic Only (No AI)  
**Last Updated**: 2025-01-12  
**Status**: ✅ Production Ready
