# Phân tích Logic và Prompt của Backend Scoring Engine

## Tổng quan

Hệ thống hiện tại có **3 lớp logic scoring** khác nhau:
1. **Backend Scoring Engine** (`api/src/utils/eventScoring.ts`) - Logic tính điểm tự động
2. **AI Prompts** (`api/src/routes/excelImport.ts`, `gemini.ts`, `gpt.ts`) - Hướng dẫn AI tính điểm
3. **Frontend Display** (`App.tsx`) - Hiển thị và mô tả cho người dùng

---

## 🔴 VẤN ĐỀ NGHIÊM TRỌNG

### 1. **Mâu thuẫn giữa UI và Logic thực tế**

**UI mô tả (App.tsx:3435-3436):**
```
Backend Scoring Engine tự động phân tích và xếp hạng events dựa trên 4 tiêu chí:
History (25đ), Region (25đ), Contact (25đ), và Delegates (25đ).
```

**AI Prompt mô tả (excelImport.ts:509-514):**
```
- History Score: If they have organized events in Vietnam or Southeast Asia before
- Region Score: If Organization Name contains "ASEAN", "Asia", "Pacific", "Eastern"
- Contact Score: Must have valid contact information (email, phone, or contact person)
- Event Size Score: Higher delegate/attendee count (>= 300)
- Frequency Score: Regular event organizers (annual, biennial) are more valuable
```

**Vấn đề:**
- UI nói **4 tiêu chí**, nhưng prompt đề cập **5 tiêu chí** (có thêm Frequency Score)
- **Frequency Score KHÔNG được implement** trong backend scoring engine
- Prompt không rõ ràng về cách tính Frequency Score

---

### 2. **Mâu thuẫn giữa AI Prompt và Backend Logic**

#### 2.1. History Score

**AI Prompt (excelImport.ts:542):**
```
History Score (0-25): 25 if VN events >= 1, 15 if SEA events, 0 otherwise
```

**Backend Logic (eventScoring.ts:16-37):**
```typescript
if (vietnamCount >= 1) return 25;
if (seaCount >= 1) return 15;
return 0;
```

✅ **Nhất quán** - Logic này đúng

#### 2.2. Region Score

**AI Prompt (excelImport.ts:543):**
```
Region Score (0-25): 25 if name contains "ASEAN/Asia/Pacific", 15 if Asian location, 0 otherwise
```

**Backend Logic (eventScoring.ts:42-63):**
```typescript
// Check name
if (nameLower.includes('asean') || nameLower.includes('asia') || 
    nameLower.includes('pacific') || nameLower.includes('apac')) {
  return 25;
}
// Check Asian countries
const asianCountries = ['china', 'japan', 'korea', 'india', 'thailand', 
  'singapore', 'malaysia', 'indonesia', 'philippines', 'vietnam', 
  'taiwan', 'hong kong'];
```

**Vấn đề:**
- Prompt nói "Eastern" nhưng backend không check "eastern"
- Prompt không rõ "Asian location" nghĩa là gì (tất cả editions? hay chỉ 1 edition?)
- Backend check `country.includes(ac) || ac.includes(country)` - logic này có thể match sai (ví dụ: "china" includes "china" nhưng "united kingdom" không match "kingdom")

#### 2.3. Contact Score

**AI Prompt (excelImport.ts:544):**
```
Contact Score (0-25): 25 if has email+phone, 15 if email only, 0 otherwise
```

**Backend Logic (eventScoring.ts:68-104):**
```typescript
if (hasEmail && hasPhone) return 25;
if (hasEmail) return 15;
return 0;
```

**Vấn đề:**
- Prompt nói "email, phone, or contact person" nhưng logic chỉ check email+phone
- **Không check keyPersonName** - nếu có tên người liên hệ nhưng không có email/phone thì vẫn 0 điểm
- Logic không validate email format đúng cách (chỉ check có "@")

#### 2.4. Delegates Score

**AI Prompt (excelImport.ts:545):**
```
Delegates Score (0-25): 25 if >= 500, 20 if >= 300, 10 if >= 100, 0 otherwise
```

**Backend Logic (eventScoring.ts:109-132):**
```typescript
if (maxDelegates >= 500) return 25;
if (maxDelegates >= 300) return 20;
if (maxDelegates >= 100) return 10;
return 0;
```

**Vấn đề:**
- ✅ Logic đúng, nhưng **sử dụng MAX delegates** thay vì average hoặc recent trend
- Nếu event có 1 năm 1000 delegates nhưng các năm khác chỉ 50, vẫn được 25 điểm
- Nên cân nhắc sử dụng **average** hoặc **weighted average** (năm gần đây có trọng số cao hơn)

---

### 3. **Priority Classification không nhất quán**

**UI mô tả (App.tsx:3473-3478):**
```
High (≥50): Contact immediately
Medium (30-49): Follow up
Low (<30): Monitor
```

**Code filter (App.tsx:1399):**
```typescript
const qualifiedEvents = sortedResults.filter(event => (event.totalScore || 0) >= 40);
```

**Vấn đề:**
- UI nói Medium là 30-49, nhưng code filter ở ≥40
- Events có score 30-39 sẽ không được hiển thị mặc dù UI nói là "Medium priority - Follow up"
- **Logic filter và UI description không khớp**

---

### 4. **Frequency Score được đề cập nhưng không implement**

**AI Prompt (excelImport.ts:514):**
```
Frequency Score: Regular event organizers (annual, biennial) are more valuable than one-time events
```

**Vấn đề:**
- Được đề cập trong prompt nhưng **KHÔNG có trong scoring logic**
- Không có hàm `calculateFrequencyScore()`
- Không được tính vào totalScore
- Nếu muốn implement, cần:
  - Phân tích `pastEventsHistory` để xác định frequency
  - Thêm vào scoring (có thể thay thế một phần của Delegates Score hoặc thêm vào)
  - Cập nhật UI description

---

### 5. **Vấn đề về Data Quality và Validation**

#### 5.1. Email Validation không đầy đủ
```typescript
if (eventData[field] && String(eventData[field]).includes('@')) {
  hasEmail = true;
}
```
- Chỉ check có "@" → có thể match sai (ví dụ: "test@", "@domain", "not@an@email")
- Nên sử dụng regex validation hoặc email validator library

#### 5.2. Country Matching Logic có thể sai
```typescript
if (asianCountries.some(ac => country.includes(ac) || ac.includes(country))) {
  return 15;
}
```
- `country.includes(ac)` → "united kingdom" includes "kingdom" → có thể match sai
- `ac.includes(country)` → "china" includes "china" → đúng, nhưng "china" includes "chin" → có thể match sai
- Nên sử dụng exact match hoặc fuzzy matching có kiểm soát

#### 5.3. Delegates Score sử dụng MAX thay vì Average
- Nếu event có 1 năm đặc biệt lớn (1000 delegates) nhưng các năm khác nhỏ (50-100), vẫn được điểm cao
- Nên cân nhắc:
  - Average delegates
  - Weighted average (năm gần đây có trọng số cao hơn)
  - Recent trend (xu hướng tăng/giảm)

---

### 6. **Vấn đề về Prompt Engineering**

#### 6.1. Prompt quá dài và phức tạp
- Prompt trong `excelImport.ts` có **~120 dòng**
- Nhiều task lồng nhau (Task 1, 2, 3, 4)
- AI có thể bỏ sót một số yêu cầu

#### 6.2. Mâu thuẫn trong yêu cầu
- Prompt yêu cầu AI "MUST research and fill ALL fields" nhưng cũng nói "DO NOT leave fields as null/empty if you can reasonably infer"
- Có thể dẫn đến AI "hallucinate" data thay vì để trống

#### 6.3. Scoring rules trong prompt không khớp với backend
- AI được yêu cầu tính điểm theo prompt, nhưng backend cũng tính điểm
- Nếu AI và backend tính khác nhau → kết quả không nhất quán
- **Nên để backend tính điểm, AI chỉ enrich data**

---

### 7. **Vấn đề về Architecture**

#### 7.1. Dual Scoring System
- Có 2 hệ thống scoring:
  1. **Backend Scoring** (`eventScoring.ts`) - Tính điểm tự động
  2. **AI Scoring** (trong prompts) - AI tính điểm dựa trên prompt
- Nếu cả 2 đều chạy → có thể có kết quả khác nhau
- **Nên chỉ dùng 1 hệ thống**: Backend tính điểm, AI chỉ enrich data

#### 7.2. Missing Integration
- Backend scoring functions (`calculateHistoryScore`, etc.) được define trong `App.tsx` (frontend)
- Cũng có trong `api/src/utils/eventScoring.ts` (backend)
- **Code duplication** → khó maintain
- Nên centralize scoring logic ở backend, frontend chỉ gọi API

---

## ✅ ĐIỂM TỐT

1. **Scoring logic cơ bản hợp lý**: 4 tiêu chí quan trọng (History, Region, Contact, Delegates)
2. **Có backend scoring engine**: Không phụ thuộc hoàn toàn vào AI
3. **Có validation và error handling**: Check null/undefined, có problems array
4. **Có documentation**: Comments trong code giải thích logic

---

## 🔧 KHUYẾN NGHỊ

### Priority 1: Critical Fixes

1. **Thống nhất UI và Logic**
   - Sửa filter threshold từ 40 → 30 (để match với Medium priority)
   - Hoặc sửa UI description để match với code (Medium: 40-49)

2. **Loại bỏ Frequency Score khỏi prompt**
   - Xóa mention về Frequency Score trong prompt
   - Hoặc implement nó đầy đủ nếu thực sự cần

3. **Thống nhất Scoring System**
   - Chỉ để backend tính điểm
   - AI chỉ enrich data, không tính điểm
   - Backend trả về scores, AI chỉ fill missing fields

### Priority 2: Important Improvements

4. **Cải thiện Contact Score Logic**
   - Thêm check `keyPersonName` vào scoring
   - Có thể: 25 điểm = email+phone, 20 điểm = email+name, 15 điểm = email only, 10 điểm = name only, 0 điểm = không có gì

5. **Cải thiện Email/Phone Validation**
   - Sử dụng regex hoặc validator library
   - Validate email format đúng cách
   - Validate phone format (có country code, đúng format)

6. **Cải thiện Country Matching**
   - Sử dụng exact match hoặc fuzzy matching có kiểm soát
   - Có thể dùng country code (ISO 3166) thay vì country name

7. **Cải thiện Delegates Score**
   - Sử dụng average thay vì max
   - Hoặc weighted average (năm gần đây có trọng số cao hơn)
   - Hoặc recent trend analysis

### Priority 3: Nice to Have

8. **Simplify Prompts**
   - Tách prompt thành các phần nhỏ hơn
   - Rõ ràng hơn về yêu cầu
   - Loại bỏ mâu thuẫn

9. **Centralize Scoring Logic**
   - Move scoring functions từ frontend → backend
   - Frontend chỉ gọi API để tính điểm
   - Tránh code duplication

10. **Add Unit Tests**
    - Test các scoring functions với edge cases
    - Test validation logic
    - Test country matching logic

---

## 📊 TÓM TẮT ĐÁNH GIÁ

| Tiêu chí | Đánh giá | Ghi chú |
|----------|----------|---------|
| **Logic cơ bản** | ⚠️ Tốt nhưng có vấn đề | 4 tiêu chí hợp lý nhưng có inconsistency |
| **Implementation** | ⚠️ Cần cải thiện | Code duplication, validation chưa đầy đủ |
| **Prompt Engineering** | ❌ Có vấn đề | Quá dài, mâu thuẫn, không khớp với backend |
| **UI Consistency** | ❌ Không nhất quán | Filter threshold không khớp với description |
| **Architecture** | ⚠️ Cần refactor | Dual scoring system, code duplication |

**Kết luận:** Logic cơ bản hợp lý nhưng có nhiều vấn đề về consistency, validation, và architecture. Cần refactor để thống nhất và cải thiện chất lượng.

