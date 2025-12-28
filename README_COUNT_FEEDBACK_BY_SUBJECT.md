# Đếm số lượng feedback từ Outlook theo Subject

## Tổng quan

Tính năng này cho phép bạn đếm số lượng emails trong inbox (Outlook/Gmail) dựa trên subject tùy chỉnh. Ví dụ: đếm tất cả emails có subject chứa "abc".

## API Endpoint

### GET /api/email-replies/count-by-subject

Đếm số lượng emails trong inbox theo subject filter.

**Query Parameters:**
- `subject` (required): Từ khóa để tìm trong subject (case-insensitive, partial match)
- `since` (optional): Chỉ đếm emails sau ngày này (ISO format: `2024-01-01T00:00:00Z`)
- `includeRead` (optional): `true` để đếm cả emails đã đọc, mặc định chỉ đếm unread

**Ví dụ:**

```bash
# Đếm emails có subject chứa "abc"
GET /api/email-replies/count-by-subject?subject=abc

# Đếm emails có subject chứa "abc" từ ngày 1/1/2024
GET /api/email-replies/count-by-subject?subject=abc&since=2024-01-01T00:00:00Z

# Đếm cả emails đã đọc và chưa đọc
GET /api/email-replies/count-by-subject?subject=abc&includeRead=true
```

**Response:**
```json
{
  "success": true,
  "count": 5,
  "subjectFilter": "abc",
  "message": "Found 5 email(s) with subject containing \"abc\""
}
```

## Sử dụng trong Frontend

### JavaScript/TypeScript

```typescript
import { emailRepliesApi } from './services/apiService';

// Đếm emails có subject chứa "abc"
const result = await emailRepliesApi.countBySubject('abc');
console.log(`Có ${result.count} emails với subject chứa "abc"`);

// Đếm từ ngày cụ thể
const result2 = await emailRepliesApi.countBySubject('abc', {
  since: '2024-01-01T00:00:00Z'
});

// Đếm cả emails đã đọc
const result3 = await emailRepliesApi.countBySubject('abc', {
  includeRead: true
});
```

### React Component Example

```tsx
import { useState } from 'react';
import { emailRepliesApi } from './services/apiService';

function FeedbackCounter() {
  const [subject, setSubject] = useState('abc');
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCount = async () => {
    setLoading(true);
    try {
      const result = await emailRepliesApi.countBySubject(subject);
      setCount(result.count);
    } catch (error) {
      console.error('Error counting emails:', error);
      alert('Lỗi khi đếm emails');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="text"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Nhập subject filter (ví dụ: abc)"
      />
      <button onClick={handleCount} disabled={loading}>
        {loading ? 'Đang đếm...' : 'Đếm emails'}
      </button>
      {count !== null && (
        <p>Có {count} email(s) với subject chứa "{subject}"</p>
      )}
    </div>
  );
}
```

## Cách hoạt động

1. Kết nối đến inbox qua IMAP (Outlook/Gmail)
2. Tìm tất cả emails (hoặc chỉ unread nếu không set `includeRead=true`)
3. Lọc emails có subject chứa từ khóa (case-insensitive)
4. Trả về số lượng emails match

## Lưu ý

- **Case-insensitive**: Tìm kiếm không phân biệt hoa thường
- **Partial match**: Chỉ cần subject chứa từ khóa, không cần khớp chính xác
- **Mặc định chỉ đếm unread**: Set `includeRead=true` để đếm cả emails đã đọc
- **Performance**: Nếu inbox có nhiều emails, có thể mất thời gian. Nên dùng `since` để giới hạn phạm vi tìm kiếm

## Ví dụ sử dụng thực tế

### Đếm feedback cho campaign "Summer 2024"

```typescript
// Tất cả emails có subject chứa "Summer 2024"
const count = await emailRepliesApi.countBySubject('Summer 2024');
```

### Đếm feedback trong tháng này

```typescript
const firstDayOfMonth = new Date();
firstDayOfMonth.setDate(1);
firstDayOfMonth.setHours(0, 0, 0, 0);

const count = await emailRepliesApi.countBySubject('abc', {
  since: firstDayOfMonth.toISOString()
});
```

### Đếm tất cả feedback (cả đã đọc và chưa đọc)

```typescript
const count = await emailRepliesApi.countBySubject('abc', {
  includeRead: true
});
```

