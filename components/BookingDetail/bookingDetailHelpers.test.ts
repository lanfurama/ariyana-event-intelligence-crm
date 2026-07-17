import { describe, expect, it } from 'vitest';
import type { Booking } from '../../types';
import {
  draftFromBooking,
  draftToPayload,
  emptyBookingDraft,
  fromDatetimeLocalValue,
  newSpaceDraft,
  toDatetimeLocalValue,
  validateBookingDraft,
} from './bookingDetailHelpers';

describe('datetime-local conversions', () => {
  it('formats a local Date as YYYY-MM-DDTHH:mm', () => {
    expect(toDatetimeLocalValue(new Date(2026, 8, 10, 8, 5))).toBe('2026-09-10T08:05');
  });

  it('round-trips through fromDatetimeLocalValue', () => {
    const iso = fromDatetimeLocalValue('2026-09-10T08:00');
    expect(toDatetimeLocalValue(iso)).toBe('2026-09-10T08:00');
  });
});

describe('newSpaceDraft', () => {
  it('defaults to 08:00–17:00 on the given day with zero buffers', () => {
    const draft = newSpaceDraft('k1', 'venue-a', new Date(2026, 8, 10, 15, 44));
    expect(draft.start_local).toBe('2026-09-10T08:00');
    expect(draft.end_local).toBe('2026-09-10T17:00');
    expect(draft.venue_id).toBe('venue-a');
    expect(draft.setup_minutes).toBe('0');
  });
});

describe('draftFromBooking', () => {
  const booking: Booking = {
    id: 'booking-1',
    code: 'ARY-2026-0001',
    lead_id: 'lead-9',
    title: 'ACME Conference',
    event_type: 'conference',
    status: 'hold',
    expected_guests: 800,
    layout: 'theatre',
    notes: 'VIP',
    source: 'manual',
    spaces: [
      {
        id: 5,
        booking_id: 'booking-1',
        venue_id: 'venue-a',
        start_at: new Date(2026, 8, 10, 8, 0).toISOString(),
        end_at: new Date(2026, 8, 10, 17, 0).toISOString(),
        setup_minutes: 120,
        teardown_minutes: 60,
      },
    ],
  };

  it('maps fields and spaces into input-friendly strings', () => {
    const draft = draftFromBooking(booking);
    expect(draft.title).toBe('ACME Conference');
    expect(draft.expected_guests).toBe('800');
    expect(draft.lead_id).toBe('lead-9');
    expect(draft.spaces).toHaveLength(1);
    expect(draft.spaces[0].key).toBe('existing-5');
    expect(draft.spaces[0].start_local).toBe('2026-09-10T08:00');
    expect(draft.spaces[0].setup_minutes).toBe('120');
  });

  it('renders missing optionals as empty strings', () => {
    const sparse = draftFromBooking({
      ...booking,
      lead_id: undefined,
      event_type: undefined,
      expected_guests: undefined,
      notes: undefined,
      layout: undefined,
    });
    expect(sparse.lead_id).toBe('');
    expect(sparse.event_type).toBe('');
    expect(sparse.expected_guests).toBe('');
  });
});

describe('validateBookingDraft', () => {
  const valid = () => {
    const draft = emptyBookingDraft();
    draft.title = 'Test';
    draft.spaces = [newSpaceDraft('k1', 'venue-a', new Date(2026, 8, 10))];
    return draft;
  };

  it('accepts a valid draft', () => {
    expect(validateBookingDraft(valid())).toHaveLength(0);
  });

  it('requires a title', () => {
    const draft = valid();
    draft.title = '   ';
    expect(validateBookingDraft(draft)[0]).toContain('Title');
  });

  it('requires at least one space', () => {
    const draft = valid();
    draft.spaces = [];
    expect(validateBookingDraft(draft)[0]).toContain('at least one space');
  });

  it('requires a venue per space', () => {
    const draft = valid();
    draft.spaces[0].venue_id = '';
    expect(validateBookingDraft(draft)[0]).toContain('pick a venue');
  });

  it('rejects end before start', () => {
    const draft = valid();
    draft.spaces[0].end_local = draft.spaces[0].start_local;
    expect(validateBookingDraft(draft)[0]).toContain('end must be after start');
  });

  it('rejects fractional or negative buffers', () => {
    const draft = valid();
    draft.spaces[0].setup_minutes = '-5';
    draft.spaces[0].teardown_minutes = '1.5';
    expect(validateBookingDraft(draft)).toHaveLength(2);
  });

  it('rejects non-integer expected guests', () => {
    const draft = valid();
    draft.expected_guests = '12.5';
    expect(validateBookingDraft(draft)[0]).toContain('Expected guests');
  });
});

describe('draftToPayload', () => {
  it('trims strings, nulls empty optionals, and parses numbers', () => {
    const draft = emptyBookingDraft();
    draft.title = '  ACME Conference  ';
    draft.status = 'hold';
    draft.expected_guests = '800';
    draft.spaces = [newSpaceDraft('k1', 'venue-a', new Date(2026, 8, 10))];
    draft.spaces[0].setup_minutes = '120';

    const payload = draftToPayload(draft);
    expect(payload.title).toBe('ACME Conference');
    expect(payload.status).toBe('hold');
    expect(payload.expected_guests).toBe(800);
    expect(payload.lead_id).toBeNull();
    expect(payload.event_type).toBeUndefined();
    expect(payload.source).toBe('manual');
    expect(payload.spaces[0].setup_minutes).toBe(120);
    expect(payload.spaces[0].venue_id).toBe('venue-a');
    expect(new Date(payload.spaces[0].start_at).getTime()).toBe(
      new Date(2026, 8, 10, 8, 0).getTime(),
    );
  });

  it('blank buffers default to 0 in the payload', () => {
    const draft = emptyBookingDraft();
    draft.title = 'X';
    draft.spaces = [newSpaceDraft('k1', 'venue-a')];
    draft.spaces[0].setup_minutes = '';
    expect(draftToPayload(draft).spaces[0].setup_minutes).toBe(0);
  });
});
