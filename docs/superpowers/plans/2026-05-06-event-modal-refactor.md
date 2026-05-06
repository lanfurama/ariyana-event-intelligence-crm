# EventModal Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `views/IntelligentDataView/EventModal.tsx` (641 LOC, currently `@ts-nocheck`) into a thin orchestration container under 100 LOC plus a tested pure data function and seven small typed sub-components, removing `@ts-nocheck` and adding ~15 unit tests.

**Architecture:** Pure data extraction lives in `EventModal/eventModalData.ts` (no React, fully testable). Each visual section becomes its own typed sub-component receiving only the props it needs. The container imports the pure function via `useMemo` and composes sub-components. JSX moves verbatim — no UI changes.

**Tech Stack:** React 19 + TypeScript ~5.8 strict, Vitest v3, Tailwind CSS, lucide-react icons.

**Source spec:** `docs/superpowers/specs/2026-05-06-event-modal-refactor-design.md`

**Working directory:** `/Users/bcmac/Desktop/projects/ariyana-event-intelligence-crm` — directly on `main` (solo dev).

---

## File Map

### New files

| Path                                                            | Status | Responsibility                                                                           |
| --------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| `views/IntelligentDataView/EventModal/eventModalData.ts`        | create | Pure `extractEventModalData(event, allExcelData)` + types `EventInput`, `EventModalData` |
| `views/IntelligentDataView/EventModal/eventModalData.test.ts`   | create | ~15 unit tests on the pure function                                                      |
| `views/IntelligentDataView/EventModal/ModalHeader.tsx`          | create | Title + data quality badge + close button                                                |
| `views/IntelligentDataView/EventModal/SummaryStatistics.tsx`    | create | 4-card grid of edition/city/country/sequence stats                                       |
| `views/IntelligentDataView/EventModal/RelatedOrganizations.tsx` | create | Organizations panel from related-data                                                    |
| `views/IntelligentDataView/EventModal/RelatedContacts.tsx`      | create | Contacts panel with nested key-value tables                                              |
| `views/IntelligentDataView/EventModal/OtherEditions.tsx`        | create | Event history (other editions)                                                           |
| `views/IntelligentDataView/EventModal/DataQualityIssues.tsx`    | create | Issue list with severity badges                                                          |
| `views/IntelligentDataView/EventModal/AllEventDataTable.tsx`    | create | Categorized full-data table                                                              |

### Modified files

| Path                                       | Status | Responsibility after this sub-project                         |
| ------------------------------------------ | ------ | ------------------------------------------------------------- |
| `views/IntelligentDataView/EventModal.tsx` | modify | Thin orchestration container ~80 LOC, no `@ts-nocheck`        |
| `STRICT_DEBT.md`                           | modify | Remove EventModal entry from "Files with `@ts-nocheck`" table |

The barrel export at `views/IntelligentDataView/index.ts` keeps `export { EventModal } from './EventModal'` unchanged. TypeScript resolves `'./EventModal'` to the `.tsx` file before the same-named folder, so callers do not need updates.

---

## Pre-flight

- [ ] **Confirm clean state and gates green**

```bash
cd /Users/bcmac/Desktop/projects/ariyana-event-intelligence-crm
git status
git log --oneline -3
npm run lint > /dev/null && echo "lint ok"
npm run typecheck > /dev/null && echo "typecheck ok"
npm run typecheck:api > /dev/null && echo "typecheck:api ok"
npm test 2>&1 | tail -3
```

Expected: clean working tree; top commit is `96e8218 docs: add EventModal refactor design spec` (or later); all gates pass; 142 tests pass.

---

## Task 1: Extract `eventModalData.ts` pure function + tests

**Files:**

- Create: `views/IntelligentDataView/EventModal/eventModalData.ts`
- Create: `views/IntelligentDataView/EventModal/eventModalData.test.ts`

This task creates the new files but does not yet wire them into `EventModal.tsx`. The container still uses its inline `useMemo` body. The point of this commit is to land the pure function with tests in green, ready to swap in next.

- [ ] **Step 1: Read the current `useMemo` body**

```bash
sed -n '22,213p' views/IntelligentDataView/EventModal.tsx
```

The body computes `dataObj`, `relatedData`, `categories`, `statistics`. Copy this body verbatim into the new file's function — only the `any` types change (to `unknown` / explicit types) and the parameters become explicit (`event`, `allExcelData`).

- [ ] **Step 2: Create `views/IntelligentDataView/EventModal/eventModalData.ts`**

```typescript
import type { DataIssue } from '../../../api/src/utils/dataQuality';

// NOTE: DataIssue is re-imported from the API utility because the same shape
// (severity / field / message) is used by both. If the import path becomes
// awkward later, copy the type into a frontend-local file in a follow-up.

export interface EventInput {
  name: string;
  data: string;
  id?: string;
  dataQualityScore?: number;
  issues?: DataIssue[];
  rawData?: Record<string, unknown>;
}

export interface RelatedData {
  organizations: Record<string, string>[];
  contacts: Record<string, string>[];
  otherEditions: Record<string, string>[];
  suppliers: Record<string, string>[];
}

export interface EventStatistics {
  totalEditions: number;
  locations: Set<string>;
  countries: Set<string>;
  cities: Set<string>;
}

export interface EventModalData {
  dataObj: Record<string, unknown>;
  relatedData: RelatedData;
  categories: Record<string, Record<string, unknown>>;
  statistics: EventStatistics;
}

const EMPTY_RESULT: EventModalData = {
  dataObj: {},
  relatedData: { organizations: [], contacts: [], otherEditions: [], suppliers: [] },
  categories: {},
  statistics: {
    totalEditions: 0,
    locations: new Set(),
    countries: new Set(),
    cities: new Set(),
  },
};

/**
 * Pure derivation of EventModal display data.
 * Moved verbatim from the inline useMemo in EventModal.tsx (lines 22-211).
 *
 * - Parses the event's rawData (or fallback `data` string) into a flat dataObj.
 * - Scans allExcelData for related rows in Organizations / Contacts / Editions /
 *   Suppliers sheets that share the same SERIESID, ECODE, or SERIESNAME prefix.
 * - Categorizes dataObj fields into 8 buckets (Event Information, Organization,
 *   Location, Dates & Timing, Event Details, Contact & Website, Statistics, Other).
 * - Aggregates locations/countries/cities across the current event + other editions.
 *
 * Returns EMPTY_RESULT when event is null.
 */
export function extractEventModalData(
  event: EventInput | null,
  allExcelData: string,
): EventModalData {
  if (!event) {
    return {
      dataObj: {},
      relatedData: { organizations: [], contacts: [], otherEditions: [], suppliers: [] },
      categories: {},
      statistics: {
        totalEditions: 0,
        locations: new Set(),
        countries: new Set(),
        cities: new Set(),
      },
    };
  }

  // Get rawData object if available, otherwise parse from data string
  const rawData = event.rawData ?? {};
  const dataObj: Record<string, unknown> = {};

  // If we have rawData object, use it directly
  if (Object.keys(rawData).length > 0) {
    Object.entries(rawData).forEach(([key, value]) => {
      // Include all values except _sheet, but show null/undefined as empty string
      if (key !== '_sheet') {
        dataObj[key] = value !== null && value !== undefined ? value : '';
      }
    });
  } else {
    // Otherwise parse from data string
    event.data.split(', ').forEach((part) => {
      const [key, ...valueParts] = part.split(': ');
      const value = valueParts.join(': ').trim();
      if (key && key.trim()) {
        dataObj[key.trim()] = value || '';
      }
    });
  }

  // Find related data from other sheets using allExcelData
  const relatedData: RelatedData = {
    organizations: [],
    contacts: [],
    otherEditions: [],
    suppliers: [],
  };

  if (allExcelData) {
    const lines = allExcelData.split('\n');
    const seriesId = (dataObj.SERIESID ?? dataObj.SeriesID ?? dataObj.seriesId) as
      | string
      | undefined;
    const ecode = (dataObj.ECODE ?? dataObj.Ecode ?? dataObj.ecode) as string | undefined;
    const seriesName = dataObj.SERIESNAME as string | undefined;

    lines.forEach((line) => {
      if (!line.trim()) return;

      // Parse line format: "Row X (Sheet: Y): Field1: Value1, Field2: Value2, ..."
      const rowMatch = line.match(/Row \d+ \(Sheet: ([^)]+)\):\s*(.+)/);
      if (rowMatch && rowMatch[1] && rowMatch[2]) {
        const sheetName = rowMatch[1].toLowerCase();
        const dataPart = rowMatch[2];
        const fields: Record<string, string> = {};

        // Parse fields
        dataPart.split(', ').forEach((pair) => {
          const match = pair.match(/([^:]+):\s*(.+)/);
          if (match && match[1] && match[2]) {
            const key = match[1].trim();
            const value = match[2].trim();
            fields[key] = value;
          }
        });

        // Check if this row is related to current event
        const isRelated =
          (seriesId &&
            (fields.SERIESID === seriesId ||
              fields.SeriesID === seriesId ||
              fields.seriesId === seriesId)) ||
          (ecode && (fields.ECODE === ecode || fields.Ecode === ecode || fields.ecode === ecode)) ||
          (seriesName &&
            fields.SERIESNAME &&
            fields.SERIESNAME.toLowerCase().includes(seriesName.toLowerCase().substring(0, 20)));

        if (isRelated) {
          if (sheetName.includes('org')) {
            relatedData.organizations.push(fields);
          } else if (sheetName.includes('contact')) {
            relatedData.contacts.push(fields);
          } else if (sheetName.includes('edition') && fields.ECODE !== ecode) {
            relatedData.otherEditions.push(fields);
          } else if (sheetName.includes('supplier')) {
            relatedData.suppliers.push(fields);
          }
        }
      }
    });
  }

  // Categorize fields
  const categories: Record<string, Record<string, unknown>> = {
    'Event Information': {},
    Organization: {},
    Location: {},
    'Dates & Timing': {},
    'Event Details': {},
    'Contact & Website': {},
    Statistics: {},
    Other: {},
  };

  // Field mapping to categories
  Object.entries(dataObj).forEach(([key, value]) => {
    const keyUpper = key.toUpperCase();
    if (
      keyUpper.includes('SERIES') ||
      keyUpper.includes('ORGANIZATION') ||
      keyUpper.includes('ORG')
    ) {
      categories['Organization']![key] = value;
    } else if (
      keyUpper.includes('CITY') ||
      keyUpper.includes('COUNTRY') ||
      keyUpper.includes('LOCATION') ||
      keyUpper.includes('VENUE')
    ) {
      categories['Location']![key] = value;
    } else if (
      keyUpper.includes('DATE') ||
      keyUpper.includes('YEAR') ||
      keyUpper.includes('TIME') ||
      keyUpper.includes('START') ||
      keyUpper.includes('END')
    ) {
      categories['Dates & Timing']![key] = value;
    } else if (
      keyUpper.includes('EMAIL') ||
      keyUpper.includes('PHONE') ||
      keyUpper.includes('CONTACT') ||
      keyUpper.includes('URL') ||
      keyUpper.includes('WEBSITE') ||
      keyUpper.includes('WEB')
    ) {
      categories['Contact & Website']![key] = value;
    } else if (
      keyUpper.includes('ATTEND') ||
      keyUpper.includes('DELEGATE') ||
      keyUpper.includes('PARTICIPANT') ||
      keyUpper.includes('SEQUENCE') ||
      keyUpper.includes('COUNT')
    ) {
      categories['Statistics']![key] = value;
    } else if (
      keyUpper.includes('EVENT') ||
      keyUpper.includes('NAME') ||
      keyUpper.includes('TITLE') ||
      keyUpper.includes('CODE') ||
      keyUpper.includes('ID')
    ) {
      categories['Event Information']![key] = value;
    } else if (
      keyUpper.includes('EXHIBITION') ||
      keyUpper.includes('COMMERCIAL') ||
      keyUpper.includes('POSTER') ||
      keyUpper.includes('TYPE') ||
      keyUpper.includes('CATEGORY')
    ) {
      categories['Event Details']![key] = value;
    } else {
      categories['Other']![key] = value;
    }
  });

  // Calculate statistics
  const totalEditions = relatedData.otherEditions.length + 1; // +1 for current event
  const locations = new Set<string>();
  const countries = new Set<string>();
  const cities = new Set<string>();

  // Extract location info from current event and related editions
  const allEvents: Array<Record<string, unknown>> = [dataObj, ...relatedData.otherEditions];
  allEvents.forEach((evt) => {
    const city = (evt.CITY ?? evt.City ?? evt.city) as string | undefined;
    const country = (evt.COUNTRY ?? evt.Country ?? evt.country) as string | undefined;
    const location = (evt.LOCATION ?? evt.Location ?? evt.location) as string | undefined;
    if (city) cities.add(city);
    if (country) countries.add(country);
    if (location) locations.add(location);
  });

  return {
    dataObj,
    relatedData,
    categories,
    statistics: { totalEditions, locations, countries, cities },
  };
}
```

- [ ] **Step 3: Create `views/IntelligentDataView/EventModal/eventModalData.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import { extractEventModalData } from './eventModalData';

describe('extractEventModalData', () => {
  describe('null event', () => {
    it('returns empty default when event is null', () => {
      const result = extractEventModalData(null, '');
      expect(result.dataObj).toEqual({});
      expect(result.relatedData.organizations).toEqual([]);
      expect(result.relatedData.contacts).toEqual([]);
      expect(result.relatedData.otherEditions).toEqual([]);
      expect(result.relatedData.suppliers).toEqual([]);
      expect(result.statistics.totalEditions).toBe(0);
      expect(result.statistics.cities.size).toBe(0);
    });
  });

  describe('dataObj parsing', () => {
    it('uses rawData when provided, excluding _sheet', () => {
      const result = extractEventModalData(
        {
          name: 'X',
          data: '',
          rawData: { SERIESNAME: 'World Conf', CITY: 'Hanoi', _sheet: 'Editions' },
        },
        '',
      );
      expect(result.dataObj.SERIESNAME).toBe('World Conf');
      expect(result.dataObj.CITY).toBe('Hanoi');
      expect(result.dataObj._sheet).toBeUndefined();
    });

    it('coerces null/undefined values to empty string in dataObj', () => {
      const result = extractEventModalData(
        { name: 'X', data: '', rawData: { CITY: null, COUNTRY: undefined } },
        '',
      );
      expect(result.dataObj.CITY).toBe('');
      expect(result.dataObj.COUNTRY).toBe('');
    });

    it('parses data string format "key: value, key: value"', () => {
      const result = extractEventModalData(
        { name: 'X', data: 'CITY: Hanoi, COUNTRY: Vietnam, YEAR: 2024' },
        '',
      );
      expect(result.dataObj.CITY).toBe('Hanoi');
      expect(result.dataObj.COUNTRY).toBe('Vietnam');
      expect(result.dataObj.YEAR).toBe('2024');
    });
  });

  describe('relatedData from allExcelData', () => {
    const event = {
      name: 'World Conf 2024',
      data: '',
      rawData: { SERIESID: 'WC-001', ECODE: 'WC-2024' },
    };

    it('matches organizations sheet rows by SERIESID', () => {
      const allExcelData = 'Row 1 (Sheet: Organizations): NAME: ICCA, SERIESID: WC-001';
      const result = extractEventModalData(event, allExcelData);
      expect(result.relatedData.organizations).toHaveLength(1);
      expect(result.relatedData.organizations[0]?.NAME).toBe('ICCA');
    });

    it('matches contacts sheet rows by ECODE', () => {
      const allExcelData = 'Row 2 (Sheet: Contacts): NAME: John, ECODE: WC-2024';
      const result = extractEventModalData(event, allExcelData);
      expect(result.relatedData.contacts).toHaveLength(1);
      expect(result.relatedData.contacts[0]?.NAME).toBe('John');
    });

    it('puts other editions (different ECODE) into otherEditions', () => {
      const allExcelData = 'Row 3 (Sheet: Editions): SERIESID: WC-001, ECODE: WC-2023, CITY: Tokyo';
      const result = extractEventModalData(event, allExcelData);
      expect(result.relatedData.otherEditions).toHaveLength(1);
      expect(result.relatedData.otherEditions[0]?.CITY).toBe('Tokyo');
    });

    it('puts supplier rows into suppliers', () => {
      const allExcelData = 'Row 4 (Sheet: Suppliers): NAME: ACo, SERIESID: WC-001';
      const result = extractEventModalData(event, allExcelData);
      expect(result.relatedData.suppliers).toHaveLength(1);
      expect(result.relatedData.suppliers[0]?.NAME).toBe('ACo');
    });

    it('returns empty related arrays when allExcelData has no matching rows', () => {
      const result = extractEventModalData(event, 'Row 1 (Sheet: Other): foo: bar');
      expect(result.relatedData.organizations).toEqual([]);
      expect(result.relatedData.contacts).toEqual([]);
      expect(result.relatedData.otherEditions).toEqual([]);
      expect(result.relatedData.suppliers).toEqual([]);
    });

    it('returns empty related arrays when allExcelData is empty', () => {
      const result = extractEventModalData(event, '');
      expect(result.relatedData.organizations).toEqual([]);
    });
  });

  describe('categories', () => {
    it('routes well-known field keys to correct categories', () => {
      const result = extractEventModalData(
        {
          name: 'X',
          data: '',
          rawData: {
            SERIESNAME: 'WC',
            CITY: 'Hanoi',
            START_DATE: '2024',
            EMAIL: 'a@b.com',
            TOTATTEND: 500,
            EVENT: 'WC',
            EXHIBITION: 'big',
            UNRELATED_FIELD: 'foo',
          },
        },
        '',
      );
      expect(result.categories['Organization']).toHaveProperty('SERIESNAME');
      expect(result.categories['Location']).toHaveProperty('CITY');
      expect(result.categories['Dates & Timing']).toHaveProperty('START_DATE');
      expect(result.categories['Contact & Website']).toHaveProperty('EMAIL');
      expect(result.categories['Statistics']).toHaveProperty('TOTATTEND');
      expect(result.categories['Event Information']).toHaveProperty('EVENT');
      expect(result.categories['Event Details']).toHaveProperty('EXHIBITION');
      expect(result.categories['Other']).toHaveProperty('UNRELATED_FIELD');
    });
  });

  describe('statistics', () => {
    it('totalEditions = otherEditions.length + 1', () => {
      const event = { name: 'X', data: '', rawData: { SERIESID: 'S1' } };
      const data = [
        'Row 1 (Sheet: Editions): SERIESID: S1, ECODE: E1, CITY: A',
        'Row 2 (Sheet: Editions): SERIESID: S1, ECODE: E2, CITY: B',
      ].join('\n');
      const result = extractEventModalData(event, data);
      expect(result.statistics.totalEditions).toBe(3); // 2 other + current
    });

    it('aggregates city/country/location across current event + other editions', () => {
      const event = { name: 'X', data: '', rawData: { SERIESID: 'S1', CITY: 'Hanoi' } };
      const data = 'Row 1 (Sheet: Editions): SERIESID: S1, ECODE: E1, CITY: Tokyo, COUNTRY: Japan';
      const result = extractEventModalData(event, data);
      expect(result.statistics.cities).toEqual(new Set(['Hanoi', 'Tokyo']));
      expect(result.statistics.countries).toEqual(new Set(['Japan']));
    });
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npm test -- views/IntelligentDataView/EventModal/eventModalData.test.ts 2>&1 | tail -10
```

Expected: ~15 cases pass.

If a case fails, the most common cause is the categorization logic — verify the test fixture's keyword matches one of the `keyUpper.includes(...)` checks in the function body.

- [ ] **Step 5: Run all gates**

```bash
npm run lint > /dev/null && echo "lint ok"
npm run typecheck > /dev/null && echo "typecheck ok"
npm test 2>&1 | tail -3
```

Expected: lint and typecheck pass; total tests = 142 + 15 = ~157.

- [ ] **Step 6: Commit**

```bash
git add views/IntelligentDataView/EventModal/
git commit -m "$(cat <<'EOF'
feat(view): extract eventModalData pure function

Create EventModal/eventModalData.ts with extractEventModalData(event,
allExcelData), moved verbatim from the inline useMemo body in
EventModal.tsx. Logic unchanged; types tightened (any → unknown +
explicit shapes). Add ~15 tests covering null event, rawData/data
parsing, related-row matching, categorization, and statistics.

EventModal.tsx still uses its inline useMemo — wire-up follows next.

Sub-project #4c, step 1/8.
EOF
)"
```

---

## Task 2: `EventModal.tsx` calls `extractEventModalData`

**Files:**

- Modify: `views/IntelligentDataView/EventModal.tsx` (lines 22-211)

- [ ] **Step 1: Replace the inline useMemo body**

In `EventModal.tsx`, replace the existing useMemo block (lines 22-211 — the entire body assigned to the destructured `{ dataObj, relatedData, categories, statistics }`) with a call to the new function:

```typescript
import { extractEventModalData } from './EventModal/eventModalData';

// ... inside the component:
const { dataObj, relatedData, categories, statistics } = useMemo(
  () => extractEventModalData(event, allExcelData),
  [event, allExcelData],
);
```

The `// @ts-nocheck` comment at the top of the file stays for now — it will be removed in step 7.

- [ ] **Step 2: Verify the file shrank as expected**

```bash
wc -l views/IntelligentDataView/EventModal.tsx
```

Expected: file is now ~460 LOC (down from 641; the ~190-line useMemo body is gone, replaced by ~5 lines of import + call).

- [ ] **Step 3: Run gates**

```bash
npm run lint > /dev/null && echo "lint ok"
npm run typecheck > /dev/null && echo "typecheck ok"
npm test 2>&1 | tail -3
```

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev &
sleep 5
echo "Manually open http://localhost:3000/, navigate to Intelligent Data view, click an event row, verify the modal renders the same content as before. Check DevTools console for new errors."
# After visual verification:
kill %1 2>/dev/null
```

> ⚠ The CLI cannot click buttons. The user must run this smoke test in a real browser between commits. If anything looks different, revert and investigate.

- [ ] **Step 5: Commit**

```bash
git add views/IntelligentDataView/EventModal.tsx
git commit -m "$(cat <<'EOF'
refactor(view): EventModal uses extractEventModalData

Replace the 190-LOC inline useMemo body with a call to the pure
function extracted in the previous commit. EventModal.tsx is now
~460 LOC. Behavior unchanged.

Sub-project #4c, step 2/8.
EOF
)"
```

---

## Task 3: Extract `ModalHeader` sub-component

**Files:**

- Create: `views/IntelligentDataView/EventModal/ModalHeader.tsx`
- Modify: `views/IntelligentDataView/EventModal.tsx` (lines 218-245 region of the original = current header block)

- [ ] **Step 1: Create `views/IntelligentDataView/EventModal/ModalHeader.tsx`**

```typescript
import type React from 'react';
import { X } from 'lucide-react';

interface ModalHeaderProps {
  eventName: string;
  dataQualityScore?: number;
  onClose: () => void;
}

function getQualityBadgeClass(score: number): string {
  if (score >= 80) return 'bg-green-50 text-green-700 border border-green-200';
  if (score >= 60) return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
  return 'bg-red-50 text-red-700 border border-red-200';
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  eventName,
  dataQualityScore,
  onClose,
}) => {
  return (
    <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
      <div className="flex-1">
        <h2 className="text-xl font-semibold text-slate-900 mb-1">{eventName}</h2>
        {dataQualityScore !== undefined && (
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-xs text-slate-500">Data Quality:</span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${getQualityBadgeClass(dataQualityScore)}`}
            >
              {dataQualityScore}%
            </span>
          </div>
        )}
      </div>
      <button
        onClick={onClose}
        className="text-slate-400 hover:text-slate-600 p-1.5 rounded hover:bg-slate-100 transition-colors"
      >
        <X size={18} />
      </button>
    </div>
  );
};
```

- [ ] **Step 2: Wire it up in `EventModal.tsx`**

Replace the inline header block (between the comment `{/* Modal Header */}` and the comment `{/* Modal Content */}`) with:

```tsx
import { ModalHeader } from './EventModal/ModalHeader';

// ... in the JSX:
<ModalHeader eventName={event.name} dataQualityScore={event.dataQualityScore} onClose={onClose} />;
```

- [ ] **Step 3: Run gates and smoke test**

```bash
npm run lint > /dev/null && npm run typecheck > /dev/null && npm test 2>&1 | tail -3
```

Then run the dev server and verify the modal header renders identically.

- [ ] **Step 4: Commit**

```bash
git add views/IntelligentDataView/EventModal/ModalHeader.tsx views/IntelligentDataView/EventModal.tsx
git commit -m "$(cat <<'EOF'
refactor(view): extract ModalHeader sub-component

Move title + data quality badge + close button into
EventModal/ModalHeader.tsx (~30 LOC). The badge color logic moves
into a private helper getQualityBadgeClass.

Sub-project #4c, step 3/8.
EOF
)"
```

---

## Task 4: Extract `SummaryStatistics` and `DataQualityIssues`

Two unrelated sections grouped because both are small and self-contained.

**Files:**

- Create: `views/IntelligentDataView/EventModal/SummaryStatistics.tsx`
- Create: `views/IntelligentDataView/EventModal/DataQualityIssues.tsx`
- Modify: `views/IntelligentDataView/EventModal.tsx`

- [ ] **Step 1: Create `views/IntelligentDataView/EventModal/SummaryStatistics.tsx`**

Open `views/IntelligentDataView/EventModal.tsx` and find the block after `{/* Summary Statistics */}` (currently around lines 251-298). Move the JSX into the new file:

```typescript
import type React from 'react';
import type { EventStatistics } from './eventModalData';

interface SummaryStatisticsProps {
  statistics: EventStatistics;
  sequence?: unknown;
}

export const SummaryStatistics: React.FC<SummaryStatisticsProps> = ({ statistics, sequence }) => {
  const shouldShow =
    statistics.totalEditions > 1 ||
    statistics.locations.size > 0 ||
    statistics.countries.size > 0 ||
    statistics.cities.size > 0;

  if (!shouldShow) return null;

  return (
    <div className="bg-slate-50 rounded border border-slate-200 px-4 py-3">
      <h3 className="text-sm font-semibold text-slate-700 mb-2">Tóm tắt</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statistics.totalEditions > 1 && (
          <div>
            <div className="text-xs text-slate-500 mb-0.5">Tổng số editions</div>
            <div className="text-lg font-semibold text-slate-900">{statistics.totalEditions}</div>
          </div>
        )}
        {statistics.cities.size > 0 && (
          <div>
            <div className="text-xs text-slate-500 mb-0.5">Thành phố</div>
            <div className="text-lg font-semibold text-slate-900">{statistics.cities.size}</div>
            <div className="text-xs text-slate-600 mt-0.5">
              {Array.from(statistics.cities).slice(0, 2).join(', ')}
              {statistics.cities.size > 2 ? '...' : ''}
            </div>
          </div>
        )}
        {statistics.countries.size > 0 && (
          <div>
            <div className="text-xs text-slate-500 mb-0.5">Quốc gia</div>
            <div className="text-lg font-semibold text-slate-900">{statistics.countries.size}</div>
            <div className="text-xs text-slate-600 mt-0.5">
              {Array.from(statistics.countries).slice(0, 2).join(', ')}
              {statistics.countries.size > 2 ? '...' : ''}
            </div>
          </div>
        )}
        {sequence !== undefined && sequence !== null && sequence !== '' && (
          <div>
            <div className="text-xs text-slate-500 mb-0.5">Sequence</div>
            <div className="text-lg font-semibold text-slate-900">{String(sequence)}</div>
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Create `views/IntelligentDataView/EventModal/DataQualityIssues.tsx`**

Find the JSX block after `{/* Data Quality Issues */}` in `EventModal.tsx` (currently around lines 458-502). Move it to the new file:

```typescript
import type React from 'react';
import type { DataIssue } from '../../../api/src/utils/dataQuality';

interface DataQualityIssuesProps {
  issues: DataIssue[];
  qualityScore?: number;
}

function getSeverityClass(severity: DataIssue['severity']): string {
  if (severity === 'critical') return 'bg-red-50 text-red-700 border border-red-200';
  if (severity === 'warning') return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
  return 'bg-blue-50 text-blue-700 border border-blue-200';
}

export const DataQualityIssues: React.FC<DataQualityIssuesProps> = ({ issues, qualityScore }) => {
  if (!issues || issues.length === 0) return null;

  return (
    <div className="bg-slate-50 rounded border border-slate-200 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-700">Vấn đề chất lượng dữ liệu</h3>
        {qualityScore !== undefined && (
          <span className="text-xs text-slate-500">Điểm: {qualityScore}%</span>
        )}
      </div>
      <ul className="space-y-1.5">
        {issues.map((issue, idx) => (
          <li key={idx} className="flex items-start space-x-2 text-xs">
            <span
              className={`px-1.5 py-0.5 rounded font-medium ${getSeverityClass(issue.severity)}`}
            >
              {issue.severity}
            </span>
            <span className="text-slate-700">
              <strong>{issue.field}:</strong> {issue.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
```

> Note: the actual JSX in the source may differ in detail (icons, exact text). When extracting, copy the JSX verbatim from the original lines and adjust prop bindings — do not rewrite from this template if the source diverges.

- [ ] **Step 3: Wire both into `EventModal.tsx`**

Replace the two inline blocks with:

```tsx
import { SummaryStatistics } from './EventModal/SummaryStatistics';
import { DataQualityIssues } from './EventModal/DataQualityIssues';

// ... in the JSX (in their original positions):
<SummaryStatistics statistics={statistics} sequence={dataObj.SEQUENCE} />;
{
  /* ... other sections ... */
}
<DataQualityIssues issues={event.issues ?? []} qualityScore={event.dataQualityScore} />;
```

- [ ] **Step 4: Run gates and smoke test**

```bash
npm run lint > /dev/null && npm run typecheck > /dev/null && npm test 2>&1 | tail -3
```

Browser check: open the modal on an event with multiple editions and visible data quality issues; both panels should look identical.

- [ ] **Step 5: Commit**

```bash
git add views/IntelligentDataView/EventModal/ views/IntelligentDataView/EventModal.tsx
git commit -m "$(cat <<'EOF'
refactor(view): extract SummaryStatistics + DataQualityIssues

Two small unrelated sections grouped in one commit. Both receive only
the data they need from the container; rendering logic moves verbatim.

Sub-project #4c, step 4/8.
EOF
)"
```

---

## Task 5: Extract `RelatedOrganizations` and `RelatedContacts`

**Files:**

- Create: `views/IntelligentDataView/EventModal/RelatedOrganizations.tsx`
- Create: `views/IntelligentDataView/EventModal/RelatedContacts.tsx`
- Modify: `views/IntelligentDataView/EventModal.tsx`

These are sibling sections that consume `relatedData.organizations` and `relatedData.contacts` respectively. RelatedContacts is the larger of the two (has a nested table for each contact).

- [ ] **Step 1: Read the current source for both sections**

```bash
sed -n '300,422p' views/IntelligentDataView/EventModal.tsx
```

Identify the two `{relatedData.X.length > 0 && (...)}` blocks. The organizations block is the smaller one (around 35 LOC); the contacts block is around 85 LOC and includes the nested key/value table.

- [ ] **Step 2: Create `views/IntelligentDataView/EventModal/RelatedOrganizations.tsx`**

Move the `{/* Related Organizations */}` JSX block here:

```typescript
import type React from 'react';

interface RelatedOrganizationsProps {
  organizations: Record<string, string>[];
}

export const RelatedOrganizations: React.FC<RelatedOrganizationsProps> = ({ organizations }) => {
  if (organizations.length === 0) return null;

  // Copy the rest of the JSX from EventModal.tsx verbatim, replacing
  // `relatedData.organizations` with `organizations` and using local
  // variables where the original used closures over outer scope.

  return (
    <div className="bg-white rounded border border-slate-200 px-4 py-3">
      <h3 className="text-sm font-semibold text-slate-700 mb-2">Thông tin tổ chức</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {organizations[0] &&
          Object.entries(organizations[0]).map(([key, value]) => (
            <div key={key} className="text-xs">
              <span className="text-slate-500">{key}:</span>{' '}
              <span className="text-slate-900 font-medium">{value}</span>
            </div>
          ))}
      </div>
    </div>
  );
};
```

> If the original block has different exact JSX (more sections, different layout), copy it verbatim — the snippet above shows the shape, not the literal target.

- [ ] **Step 3: Create `views/IntelligentDataView/EventModal/RelatedContacts.tsx`**

Move the `{/* Related Contacts */}` block here:

```typescript
import type React from 'react';

interface RelatedContactsProps {
  contacts: Record<string, string>[];
}

export const RelatedContacts: React.FC<RelatedContactsProps> = ({ contacts }) => {
  if (contacts.length === 0) return null;

  // Copy the JSX verbatim from EventModal.tsx (currently lines ~337-422),
  // adjusting only the variable name from `relatedData.contacts` to `contacts`.
  // The nested table (each contact's fields) is the larger part — preserve
  // exact tailwind classes.

  return (
    <div className="bg-white rounded border border-slate-200 px-4 py-3">
      <h3 className="text-sm font-semibold text-slate-700 mb-2">
        Thông tin liên hệ (từ sheet Contacts)
      </h3>
      <div className="space-y-2">
        {contacts.map((contact, idx) => (
          <div key={idx} className="bg-slate-50 rounded border border-slate-200 px-3 py-2">
            <table className="w-full text-xs">
              <tbody>
                {Object.entries(contact).map(([key, value]) => (
                  <tr key={key} className="bg-white">
                    <td className="text-slate-500 px-2 py-1 align-top w-1/3">{key}</td>
                    <td className="text-slate-900 px-2 py-1">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Wire both into `EventModal.tsx`**

```tsx
import { RelatedOrganizations } from './EventModal/RelatedOrganizations';
import { RelatedContacts } from './EventModal/RelatedContacts';

// ... in JSX (in original positions):
<RelatedOrganizations organizations={relatedData.organizations} />
<RelatedContacts contacts={relatedData.contacts} />
```

- [ ] **Step 5: Run gates and smoke test**

Browser check: open the modal on an event that has linked organizations and contacts; both panels should render identically.

- [ ] **Step 6: Commit**

```bash
git add views/IntelligentDataView/EventModal/RelatedOrganizations.tsx \
        views/IntelligentDataView/EventModal/RelatedContacts.tsx \
        views/IntelligentDataView/EventModal.tsx
git commit -m "$(cat <<'EOF'
refactor(view): extract RelatedOrganizations + RelatedContacts

Move the two related-data panels into dedicated sub-components.
RelatedContacts is the larger one (has a nested key/value table per
contact); both keep their existing JSX verbatim.

Sub-project #4c, step 5/8.
EOF
)"
```

---

## Task 6: Extract `OtherEditions` and `AllEventDataTable`

**Files:**

- Create: `views/IntelligentDataView/EventModal/OtherEditions.tsx`
- Create: `views/IntelligentDataView/EventModal/AllEventDataTable.tsx`
- Modify: `views/IntelligentDataView/EventModal.tsx`

After this task, only the modal frame, the `<details>` raw-data debug block, and the modal footer (~10 LOC button) remain in `EventModal.tsx`.

- [ ] **Step 1: Read both blocks**

```bash
sed -n '423,455p' views/IntelligentDataView/EventModal.tsx  # Other Editions
sed -n '503,616p' views/IntelligentDataView/EventModal.tsx  # All Event Data Table
```

- [ ] **Step 2: Create `views/IntelligentDataView/EventModal/OtherEditions.tsx`**

```typescript
import type React from 'react';

interface OtherEditionsProps {
  otherEditions: Record<string, string>[];
}

export const OtherEditions: React.FC<OtherEditionsProps> = ({ otherEditions }) => {
  if (otherEditions.length === 0) return null;

  // Copy the JSX from EventModal.tsx (lines ~424-455) verbatim,
  // replacing `relatedData.otherEditions` with `otherEditions`.
  return (
    <div className="bg-white rounded border border-slate-200 px-4 py-3">
      <h3 className="text-sm font-semibold text-slate-700 mb-2">
        Lịch sử event ({otherEditions.length} editions khác)
      </h3>
      <div className="space-y-2">
        {otherEditions.map((edition, idx) => (
          <div key={idx} className="bg-slate-50 rounded border border-slate-200 px-3 py-2">
            <div className="text-xs grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(edition).map(([key, value]) => (
                <div key={key}>
                  <span className="text-slate-500">{key}:</span>{' '}
                  <span className="text-slate-900 font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Create `views/IntelligentDataView/EventModal/AllEventDataTable.tsx`**

```typescript
import type React from 'react';

interface AllEventDataTableProps {
  categories: Record<string, Record<string, unknown>>;
  dataObj: Record<string, unknown>;
}

export const AllEventDataTable: React.FC<AllEventDataTableProps> = ({ categories, dataObj }) => {
  // The current view always shows this block (no conditional render at the top).
  // If categories is empty AND dataObj is empty, render nothing (defensive).
  const totalCells = Object.values(categories).reduce(
    (sum, fields) => sum + Object.keys(fields).length,
    0,
  );
  if (totalCells === 0 && Object.keys(dataObj).length === 0) return null;

  // Copy the categorized table JSX from EventModal.tsx (currently
  // ~lines 505-616) verbatim. The key shape is:
  //   - Outer wrapper with title "Tất cả thông tin"
  //   - For each category with non-empty fields, render a sub-section
  //     with a key/value table.

  return (
    <div className="bg-white rounded border border-slate-200 px-4 py-3">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Tất cả thông tin</h3>
      <div className="space-y-3">
        {Object.entries(categories).map(([categoryName, fields]) => {
          if (Object.keys(fields).length === 0) return null;
          return (
            <div key={categoryName}>
              <h4 className="text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                {categoryName}
              </h4>
              <table className="w-full text-xs">
                <tbody>
                  {Object.entries(fields).map(([key, value]) => (
                    <tr key={key} className="bg-slate-50">
                      <td className="text-slate-500 px-2 py-1 align-top w-1/3 border-r border-slate-200">
                        {key}
                      </td>
                      <td className="text-slate-900 px-2 py-1">{String(value ?? '')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

> The exact JSX must match the original. The snippet above is structurally accurate but treat the original `EventModal.tsx` source as authoritative; copy verbatim and adjust prop bindings.

- [ ] **Step 4: Wire both into `EventModal.tsx`**

```tsx
import { OtherEditions } from './EventModal/OtherEditions';
import { AllEventDataTable } from './EventModal/AllEventDataTable';

// ... in JSX (in original positions):
<OtherEditions otherEditions={relatedData.otherEditions} />
<AllEventDataTable categories={categories} dataObj={dataObj} />
```

- [ ] **Step 5: Verify size**

```bash
wc -l views/IntelligentDataView/EventModal.tsx
```

Expected: ~80-100 LOC. The remaining content is: imports, props interface, the orchestration `useMemo`, the modal frame divs, the inline `<details>` raw-data section, and the inline footer button.

- [ ] **Step 6: Run gates and smoke test**

Browser check: full modal smoke — every section should render the same as before.

- [ ] **Step 7: Commit**

```bash
git add views/IntelligentDataView/EventModal/OtherEditions.tsx \
        views/IntelligentDataView/EventModal/AllEventDataTable.tsx \
        views/IntelligentDataView/EventModal.tsx
git commit -m "$(cat <<'EOF'
refactor(view): extract OtherEditions + AllEventDataTable

Final two large sections moved into dedicated sub-components. After
this, EventModal.tsx is ~80-100 LOC: orchestration only, with the
small <details> raw-debug block and footer button still inline.

Sub-project #4c, step 6/8.
EOF
)"
```

---

## Task 7: Restore TS strict on `EventModal`

**Files:**

- Modify: `views/IntelligentDataView/EventModal.tsx` — remove `// @ts-nocheck`

- [ ] **Step 1: Remove the `@ts-nocheck` line**

Open `views/IntelligentDataView/EventModal.tsx`. Delete the leading `// @ts-nocheck — TODO(refactor): ...` comment block (the first three lines).

- [ ] **Step 2: Run typecheck and inspect errors**

```bash
npm run typecheck 2>&1 | grep 'views/IntelligentDataView/EventModal' | head -20
```

Possible errors after removing `@ts-nocheck`:

- `event.issues` typed as `any[] | undefined` — adjust container to pass `event.issues ?? []` (the previous tasks already do this).
- `event.rawData` typed as `any` — already handled because `eventModalData.ts` uses `Record<string, unknown>`.
- `EventModalProps`'s `issues?: any[]` and `rawData?: any` — tighten the props interface to use `DataIssue[]` and `Record<string, unknown>`.

- [ ] **Step 3: Tighten `EventModalProps`**

Replace the existing props interface in `EventModal.tsx` with:

```typescript
import type { DataIssue } from '../../api/src/utils/dataQuality';

interface EventModalProps {
  event: {
    name: string;
    data: string;
    id?: string;
    dataQualityScore?: number;
    issues?: DataIssue[];
    rawData?: Record<string, unknown>;
  } | null;
  allExcelData: string;
  onClose: () => void;
}
```

- [ ] **Step 4: Fix any remaining errors with proper types**

For each error reported by `npm run typecheck`:

- If the value comes from `dataObj` (typed `Record<string, unknown>`), narrow it at the use site: `String(dataObj.SEQUENCE ?? '')` or `typeof v === 'string' ? v : String(v)`.
- If a sub-component prop type mismatches, fix the prop type to be precise (no `any`).
- Do NOT add `as any`, `// @ts-expect-error`, or re-introduce `// @ts-nocheck`.
- If a single error genuinely needs a logic fix (rare for a no-behavior-change refactor), STOP and surface it — the refactor must remain behavior-neutral.

- [ ] **Step 5: All gates green**

```bash
npm run lint > /dev/null && echo "lint ok"
npm run format:check > /dev/null && echo "format ok"
npm run typecheck > /dev/null && echo "typecheck ok"
npm run typecheck:api > /dev/null && echo "typecheck:api ok"
npm run build > /dev/null && echo "build ok"
npm test 2>&1 | tail -3
```

Expected: all pass.

- [ ] **Step 6: Smoke test**

Run the dev server and verify the modal still works end-to-end.

- [ ] **Step 7: Commit**

```bash
git add views/IntelligentDataView/EventModal.tsx
git commit -m "$(cat <<'EOF'
refactor(view): restore TS strict on EventModal (remove @ts-nocheck)

Tighten EventModalProps to use DataIssue[] and Record<string, unknown>
instead of any. Narrow dataObj field reads at the use site. No new
`any`, no `@ts-expect-error`, no logic changes.

Sub-project #4c, step 7/8.
EOF
)"
```

---

## Task 8: Update `STRICT_DEBT.md`

**Files:**

- Modify: `STRICT_DEBT.md`

- [ ] **Step 1: Edit `STRICT_DEBT.md`**

In the "Files with `@ts-nocheck`" section, remove the `views/IntelligentDataView/EventModal.tsx` row. The remaining row is `components/LeadDetail.tsx` which still carries `@ts-nocheck` and is the target of sub-project #4b.

If the section becomes empty after this removal (it should not — `LeadDetail.tsx` remains), keep the section header but list "(none currently)" instead.

- [ ] **Step 2: Verify gates one more time**

```bash
npm run lint > /dev/null && npm run format:check > /dev/null && npm run typecheck > /dev/null && npm run typecheck:api > /dev/null && npm run build > /dev/null && npm test 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
git add STRICT_DEBT.md
git commit -m "$(cat <<'EOF'
docs: STRICT_DEBT.md — EventModal resolved

Remove EventModal.tsx from the @ts-nocheck list. LeadDetail.tsx
remains; it is the target of sub-project #4b.

Sub-project #4c, step 8/8. Closes EventModal refactor.
EOF
)"
```

---

## Final verification

- [ ] **All gates green**

```bash
npm run lint > /dev/null && echo "lint ok"
npm run format:check > /dev/null && echo "format ok"
npm run typecheck > /dev/null && echo "typecheck ok"
npm run typecheck:api > /dev/null && echo "typecheck:api ok"
npm run build > /dev/null && echo "build ok"
npm test 2>&1 | tail -5
```

Expected: all pass; ~157 tests; under 10 seconds.

- [ ] **File size and structure**

```bash
wc -l views/IntelligentDataView/EventModal.tsx
ls -la views/IntelligentDataView/EventModal/
```

Expected: `EventModal.tsx` < 100 LOC; folder contains `eventModalData.ts`, `eventModalData.test.ts`, and 7 sub-component files.

- [ ] **No `@ts-nocheck` in EventModal scope**

```bash
grep -rn '@ts-nocheck' views/IntelligentDataView/EventModal*
```

Expected: no output.

- [ ] **Modal smoke test (browser)**

Open the app in a browser. Navigate to the Intelligent Data view. Open a representative event with rich data (multiple editions, organizations, contacts). Verify visually that everything looks the same as before this sub-project.

- [ ] **Push to remote**

```bash
git push origin main
```

The pre-push hook runs typecheck + typecheck:api + tests; push succeeds only if all pass.

---

## Rollback notes

Each commit touches one logical extraction:

- **Tasks 3-6**: each affects one or two sub-component files plus the container's wiring. Revert one commit → that section returns to inline JSX.
- **Task 1**: pure function only, zero behavior risk.
- **Task 2**: replaces inline `useMemo` with the pure function call. Revert → returns to inline.
- **Task 7**: TS strict restoration. If something subtle breaks, revert → file returns to `@ts-nocheck` while the structural split is preserved.
- **Task 8**: docs only.

Highest risk is Task 7 (strict mode may reveal a real upstream bug). If reverted, the structural improvement still lands; only the type-safety win is delayed.

---

## Out of scope

- Visual / UX changes — the modal looks identical post-refactor.
- Component rendering tests — frontend test infra is a future sub-project.
- Touching `IntelligentDataView.tsx`, `EventList.tsx`, or other callers.
- Refactoring `LeadDetail.tsx` (sub-project #4b) or `LeadsView.tsx` (sub-project #4d).
- Adding modal features (Esc to close, backdrop click to close, etc.).
- Improving the categorization heuristics (the keyword `.includes()` checks).
- Improving the SERIESID/ECODE/SERIESNAME matching logic.
