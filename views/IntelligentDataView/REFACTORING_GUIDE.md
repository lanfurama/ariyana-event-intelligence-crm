# IntelligentDataView Refactoring Guide

## ✅ Đã Hoàn Thành

Đã tách được 3 components chính từ `IntelligentDataView.tsx`:

1. **ScoringCriteriaPanel.tsx** - Panel điều khiển scoring criteria
2. **FileUploadSection.tsx** - Section upload file và hiển thị status
3. **EventFilters.tsx** - Filters và search bar

## 📋 Các Components Còn Cần Tạo

### 1. EventList Component (Ưu tiên: CAO)

**File:** `views/IntelligentDataView/EventList.tsx`

**Chức năng:**

- Hiển thị bảng danh sách events
- Hiển thị status, score, actions cho mỗi event
- Xử lý click để mở modal

**Props cần:**

```typescript
interface EventListProps {
  events: Array<{
    name: string;
    data: string;
    id?: string;
    rawData?: any;
    dataQualityScore?: number;
    issues?: any[];
    eventHistory?: string;
    editions?: any[];
    organizationName?: string;
  }>;
  organizationProgress: OrganizationProgress[];
  savedToDatabase: Set<string>;
  researchingEditions: Set<string>;
  onEventClick: (event: any) => void;
  onResearchEditions: (eventName: string, editions: any[]) => void;
}
```

**Vị trí trong code gốc:** Dòng 3003-3194

---

### 2. EventModal Component (Ưu tiên: CAO)

**File:** `views/IntelligentDataView/EventModal.tsx`

**Chức năng:**

- Modal hiển thị chi tiết event
- Hiển thị raw data, related data, data quality issues
- Rất lớn (~450 dòng code)

**Props cần:**

```typescript
interface EventModalProps {
  event: {
    name: string;
    data: string;
    id?: string;
    dataQualityScore?: number;
    issues?: any[];
    rawData?: any;
  } | null;
  allExcelData: string;
  onClose: () => void;
}
```

**Vị trí trong code gốc:** Dòng 4872-5318

---

### 3. BatchAnalysisControls Component (Ưu tiên: TRUNG BÌNH)

**File:** `views/IntelligentDataView/BatchAnalysisControls.tsx`

**Chức năng:**

- Button "Analyze Events"
- Hiển thị progress và status
- Rate limit countdown

**Props cần:**

```typescript
interface BatchAnalysisControlsProps {
  eventsCount: number;
  loading: boolean;
  researchingEditions: Set<string>;
  rateLimitCountdown: number | null;
  onAnalyze: () => void;
}
```

**Vị trí trong code gốc:** Dòng 3216-3252

---

### 4. ScoringUtils Helper (Ưu tiên: TRUNG BÌNH)

**File:** `views/IntelligentDataView/scoringUtils.ts`

**Chức năng:**

- Tách các helper functions ra khỏi component
- `calculateHistoryScore`
- `calculateRegionScore`
- `calculateContactScore`
- `calculateDelegatesScore`
- `formatEventHistory`
- `isValidEmail`
- `isValidPhone`

**Vị trí trong code gốc:** Dòng 867-1032

---

### 5. ErrorDisplay Component (Ưu tiên: THẤP)

**File:** `views/IntelligentDataView/ErrorDisplay.tsx`

**Chức năng:**

- Hiển thị error messages
- Rate limit warnings

**Vị trí trong code gốc:** Dòng 2821-2858

---

## 🔄 Cách Refactor IntelligentDataView

### Bước 1: Import các components đã tạo

```typescript
import { ScoringCriteriaPanel, FileUploadSection, EventFilters } from './IntelligentDataView';
```

### Bước 2: Thay thế các sections

**Thay Scoring Criteria Panel:**

```typescript
// Thay dòng 2664-2744
<ScoringCriteriaPanel
  scoringCriteria={scoringCriteria}
  onCriteriaChange={setScoringCriteria}
/>
```

**Thay File Upload Section:**

```typescript
// Thay dòng 2747-2819
<FileUploadSection
  uploadingExcel={uploadingExcel}
  excelFile={excelFile}
  excelSummary={excelSummary}
  emailSendSummary={emailSendSummary}
  onFileChange={handleFileImport}
  onClearFile={() => {
    setExcelFile(null);
    setExcelSummary(null);
    setEventsList([]);
    setImportData('');
    setEmailSendSummary(null);
  }}
/>
```

**Thay Event Filters:**

```typescript
// Thay dòng 2876-3001
<EventFilters
  searchTerm={searchTerm}
  countryFilter={countryFilter}
  industryFilter={industryFilter}
  statusFilter={statusFilter}
  priorityFilter={priorityFilter}
  sortBy={sortBy}
  sortOrder={sortOrder}
  availableCountries={availableCountries}
  availableIndustries={availableIndustries}
  filteredCount={filteredAndSortedEvents.length}
  totalCount={eventsList.length}
  analyzedCount={analyzedCount}
  notAnalyzedCount={notAnalyzedCount}
  onSearchChange={setSearchTerm}
  onCountryFilterChange={setCountryFilter}
  onIndustryFilterChange={setIndustryFilter}
  onStatusFilterChange={setStatusFilter}
  onPriorityFilterChange={setPriorityFilter}
  onSortByChange={setSortBy}
  onSortOrderToggle={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
  onClearFilters={() => {
    setSearchTerm('');
    setCountryFilter('all');
    setIndustryFilter('all');
    setStatusFilter('all');
    setPriorityFilter('all');
  }}
/>
```

### Bước 3: Tạo các components còn lại

Làm tương tự như đã làm với 3 components đầu tiên.

---

## 📊 Lợi Ích

Sau khi refactor hoàn tất:

1. **Giảm kích thước file:** Từ 5,321 dòng → ~1,500 dòng
2. **Dễ maintain:** Mỗi component có trách nhiệm riêng
3. **Dễ test:** Có thể test từng component độc lập
4. **Có thể lazy load:** Có thể lazy load EventModal khi cần
5. **Tái sử dụng:** Các components có thể dùng ở nơi khác

---

## ⚠️ Lưu Ý

- Giữ nguyên logic và state management
- Đảm bảo tất cả props được truyền đúng
- Test kỹ sau mỗi lần refactor
- Commit từng component một để dễ rollback nếu có lỗi

---

## 🎯 Kế Hoạch Tiếp Theo

1. Tạo `EventList.tsx` (quan trọng nhất)
2. Tạo `EventModal.tsx` (lớn nhất)
3. Tạo `BatchAnalysisControls.tsx`
4. Tạo `scoringUtils.ts`
5. Refactor `IntelligentDataView.tsx` để sử dụng tất cả components
6. Test và fix bugs
