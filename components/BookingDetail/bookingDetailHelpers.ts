import type { Booking, BookingStatus } from '../../types';
import type { BookingPayload, BookingSpacePayload } from '../../services/apiService';

// Pure draft <-> payload helpers for the BookingDetail drawer.
// Drafts keep numeric fields as strings (they back controlled inputs);
// parsing/validation happens once at save time.

export interface SpaceDraft {
  key: string;
  venue_id: string;
  /** 'YYYY-MM-DDTHH:mm' local, for <input type="datetime-local"> */
  start_local: string;
  end_local: string;
  setup_minutes: string;
  teardown_minutes: string;
}

export interface BookingDraft {
  title: string;
  event_type: string;
  status: BookingStatus;
  expected_guests: string;
  layout: string;
  notes: string;
  /** '' = not linked to a lead */
  lead_id: string;
  spaces: SpaceDraft[];
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Date/ISO → local 'YYYY-MM-DDTHH:mm' for datetime-local inputs. */
export function toDatetimeLocalValue(value: string | Date): string {
  const d = new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local 'YYYY-MM-DDTHH:mm' → ISO string (interpreted in browser-local time). */
export function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}

/** Fresh space row — defaults to 08:00–17:00 on `day` (or today). */
export function newSpaceDraft(key: string, venueId = '', day?: Date): SpaceDraft {
  const start = day ? new Date(day) : new Date();
  start.setHours(8, 0, 0, 0);
  const end = new Date(start);
  end.setHours(17, 0, 0, 0);
  return {
    key,
    venue_id: venueId,
    start_local: toDatetimeLocalValue(start),
    end_local: toDatetimeLocalValue(end),
    setup_minutes: '0',
    teardown_minutes: '0',
  };
}

export function emptyBookingDraft(): BookingDraft {
  return {
    title: '',
    event_type: '',
    status: 'inquiry',
    expected_guests: '',
    layout: '',
    notes: '',
    lead_id: '',
    spaces: [],
  };
}

export function draftFromBooking(booking: Booking): BookingDraft {
  return {
    title: booking.title,
    event_type: booking.event_type || '',
    status: booking.status,
    expected_guests: booking.expected_guests != null ? String(booking.expected_guests) : '',
    layout: booking.layout || '',
    notes: booking.notes || '',
    lead_id: booking.lead_id || '',
    spaces: booking.spaces.map((space, index) => ({
      key: `existing-${space.id ?? index}`,
      venue_id: space.venue_id,
      start_local: toDatetimeLocalValue(space.start_at),
      end_local: toDatetimeLocalValue(space.end_at),
      setup_minutes: String(space.setup_minutes),
      teardown_minutes: String(space.teardown_minutes),
    })),
  };
}

function parseBufferMinutes(value: string): number | null {
  if (value.trim() === '') return 0;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export function validateBookingDraft(draft: BookingDraft): string[] {
  const errors: string[] = [];
  if (draft.title.trim() === '') errors.push('Title is required');
  if (draft.expected_guests.trim() !== '') {
    const guests = Number(draft.expected_guests);
    if (!Number.isInteger(guests) || guests < 0) {
      errors.push('Expected guests must be a non-negative whole number');
    }
  }
  if (draft.spaces.length === 0) errors.push('Add at least one space');
  draft.spaces.forEach((space, index) => {
    const label = `Space ${index + 1}`;
    if (!space.venue_id) errors.push(`${label}: pick a venue`);
    const start = new Date(space.start_local);
    const end = new Date(space.end_local);
    const startValid = space.start_local !== '' && !isNaN(start.getTime());
    const endValid = space.end_local !== '' && !isNaN(end.getTime());
    if (!startValid) errors.push(`${label}: start time is invalid`);
    if (!endValid) errors.push(`${label}: end time is invalid`);
    if (startValid && endValid && end.getTime() <= start.getTime()) {
      errors.push(`${label}: end must be after start`);
    }
    if (parseBufferMinutes(space.setup_minutes) === null) {
      errors.push(`${label}: setup minutes must be a non-negative integer`);
    }
    if (parseBufferMinutes(space.teardown_minutes) === null) {
      errors.push(`${label}: teardown minutes must be a non-negative integer`);
    }
  });
  return errors;
}

export function spaceDraftToPayload(space: SpaceDraft): BookingSpacePayload {
  return {
    venue_id: space.venue_id,
    start_at: fromDatetimeLocalValue(space.start_local),
    end_at: fromDatetimeLocalValue(space.end_local),
    setup_minutes: parseBufferMinutes(space.setup_minutes) ?? 0,
    teardown_minutes: parseBufferMinutes(space.teardown_minutes) ?? 0,
  };
}

export function draftToPayload(draft: BookingDraft): BookingPayload {
  return {
    title: draft.title.trim(),
    event_type: draft.event_type.trim() || undefined,
    status: draft.status,
    expected_guests: draft.expected_guests.trim() === '' ? null : Number(draft.expected_guests),
    layout: draft.layout || undefined,
    notes: draft.notes.trim() || undefined,
    lead_id: draft.lead_id || null,
    source: 'manual',
    spaces: draft.spaces.map(spaceDraftToPayload),
  };
}
