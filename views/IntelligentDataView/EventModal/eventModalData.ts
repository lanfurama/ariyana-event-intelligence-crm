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
 * Returns the empty default when event is null.
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
