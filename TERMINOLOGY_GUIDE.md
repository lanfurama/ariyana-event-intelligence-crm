# Terminology Guide

## ⚠️ IMPORTANT: Events vs Organizations

### Correct Terminology

Hệ thống đang làm việc với **EVENTS/SERIES** (từ ICCA Editions sheet), **KHÔNG PHẢI Organizations**.

#### ICCA Data Structure
```
Organizations (Sheet "Orgs")
  └─ Series (Sheet "Series") 
      └─ Editions (Sheet "Editions") ← WE WORK WITH THIS
```

### What We're Actually Processing

1. **Input:** Excel file với Editions sheet
   - Mỗi row = 1 edition (1 lần tổ chức event)
   - Nhiều editions cùng SeriesName = 1 event/series

2. **Grouping Logic:**
   - Group các editions theo **SeriesName**
   - Mỗi unique SeriesName = 1 Event duy nhất
   - VD: 47 editions → 3 events (3 series)

3. **Output:** List of Events
   - Mỗi event có nhiều editions (history)
   - Event = Conference Series (VD: "World Congress of ISPO")
   - Editions = Past occurrences (2019, 2021, 2023...)

### Code Terminology (Updated)

#### ✅ CORRECT (After Fix)
```typescript
// Backend
response.events = [...] // ✅ Field name: "events"
console.log('Extracted X events') // ✅ 

// Frontend  
result.events.map(eventData => ...) // ✅ Variable: eventData
console.log('Scoring event:', event.name) // ✅
```

#### ❌ INCORRECT (Before Fix)
```typescript
// Backend
response.organizations = [...] // ❌ Misleading!
console.log('Extracted X organizations') // ❌

// Frontend
result.organizations.map(org => ...) // ❌ Should be eventData
console.log('Analyzing organization') // ❌
```

### Why This Matters

**Context:**
- User imports ICCA BI Export với Editions sheet
- System scores **events/series** (not organizations)
- Output shows "Top Events" for sales team to contact

**Impact:**
- Console logs hiển thị "Processing organizations" → gây nhầm lẫn
- Sales team nghĩ đang analyze organizations → thực ra là events
- Reports/UI cần clarify: "Events" = Conference Series

### Field Mapping

| Excel Field | Purpose | Usage in Scoring |
|-------------|---------|------------------|
| **SeriesName** | Series/Event name | Group editions, primary identifier |
| SeriesID | Series unique ID | Alternative grouping key |
| ECODE | Edition code | Unique per edition (skip this!) |
| COUNTRY | Event location | Region score calculation |
| CITY | Event location | Region score calculation |
| REGATTEND | Delegates count | Delegates score calculation |
| Year/Date | Edition year | Event history timeline |

### Console Log Standards

```typescript
// ✅ DO
console.log('📊 [Excel Import] Extracted 3 events (47 editions)')
console.log('🤖 [Agent 1] Scoring event: ISPO World Congress')
console.log('✅ [Strategic Analysis] Completed scoring 3 events')

// ❌ DON'T  
console.log('Extracted 3 organizations')
console.log('Analyzing organization: ISPO')
console.log('Failed to analyze organization')
```

### UI/Report Language

```typescript
// ✅ DO
"Top Events for Sales Outreach"
"Event Series: ISPO World Congress"
"3 events found (47 editions total)"

// ❌ DON'T
"Top Organizations to Contact"  
"Organization: ISPO World Congress"
"3 organizations found"
```

---

## Summary

- **We process:** Event Series/Conferences (from Editions sheet)
- **Not processing:** Organizations (that's a different sheet)
- **Code should say:** "events", "event data", "scoring events"
- **Code should NOT say:** "organizations", "org", "analyzing organizations"

**Key takeaway:** ICCA Organizations ≠ Events. We're analyzing Events (conference series), not Organizations (associations/companies).
