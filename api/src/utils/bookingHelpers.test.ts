import { describe, expect, it } from 'vitest';
import {
  computeBlockRange,
  computeQuoteTotals,
  findSpaceConflicts,
  formatBookingCode,
  rangesOverlap,
  slugifyVenueName,
  validateBookingSpacesPayload,
  type SpaceWindowRow,
} from './bookingHelpers';

const d = (iso: string) => new Date(iso);

describe('rangesOverlap', () => {
  it('detects a plain overlap', () => {
    expect(
      rangesOverlap(
        d('2026-09-10T08:00:00Z'),
        d('2026-09-10T12:00:00Z'),
        d('2026-09-10T10:00:00Z'),
        d('2026-09-10T14:00:00Z'),
      ),
    ).toBe(true);
  });

  it('returns false for disjoint ranges', () => {
    expect(
      rangesOverlap(
        d('2026-09-10T08:00:00Z'),
        d('2026-09-10T10:00:00Z'),
        d('2026-09-10T11:00:00Z'),
        d('2026-09-10T12:00:00Z'),
      ),
    ).toBe(false);
  });

  it('half-open: a ending exactly when b starts does not overlap', () => {
    expect(
      rangesOverlap(
        d('2026-09-10T08:00:00Z'),
        d('2026-09-10T12:00:00Z'),
        d('2026-09-10T12:00:00Z'),
        d('2026-09-10T16:00:00Z'),
      ),
    ).toBe(false);
  });

  it('half-open: b ending exactly when a starts does not overlap', () => {
    expect(
      rangesOverlap(
        d('2026-09-10T12:00:00Z'),
        d('2026-09-10T16:00:00Z'),
        d('2026-09-10T08:00:00Z'),
        d('2026-09-10T12:00:00Z'),
      ),
    ).toBe(false);
  });

  it('detects containment', () => {
    expect(
      rangesOverlap(
        d('2026-09-10T08:00:00Z'),
        d('2026-09-10T18:00:00Z'),
        d('2026-09-10T10:00:00Z'),
        d('2026-09-10T11:00:00Z'),
      ),
    ).toBe(true);
  });

  it('detects identical ranges', () => {
    expect(
      rangesOverlap(
        d('2026-09-10T08:00:00Z'),
        d('2026-09-10T12:00:00Z'),
        d('2026-09-10T08:00:00Z'),
        d('2026-09-10T12:00:00Z'),
      ),
    ).toBe(true);
  });
});

describe('computeBlockRange', () => {
  it('returns the event range untouched with zero buffers', () => {
    const { blockStartAt, blockEndAt } = computeBlockRange(
      d('2026-09-10T08:00:00Z'),
      d('2026-09-10T17:00:00Z'),
      0,
      0,
    );
    expect(blockStartAt.toISOString()).toBe('2026-09-10T08:00:00.000Z');
    expect(blockEndAt.toISOString()).toBe('2026-09-10T17:00:00.000Z');
  });

  it('widens the start by setup minutes', () => {
    const { blockStartAt } = computeBlockRange(
      d('2026-09-10T08:00:00Z'),
      d('2026-09-10T17:00:00Z'),
      120,
      0,
    );
    expect(blockStartAt.toISOString()).toBe('2026-09-10T06:00:00.000Z');
  });

  it('widens the end by teardown minutes', () => {
    const { blockEndAt } = computeBlockRange(
      d('2026-09-10T08:00:00Z'),
      d('2026-09-10T17:00:00Z'),
      0,
      90,
    );
    expect(blockEndAt.toISOString()).toBe('2026-09-10T18:30:00.000Z');
  });
});

describe('findSpaceConflicts', () => {
  const row = (overrides: Partial<SpaceWindowRow>): SpaceWindowRow => ({
    booking_id: 'booking-other',
    venue_id: 'venue-grand-ballroom',
    block_start_at: '2026-09-10T08:00:00Z',
    block_end_at: '2026-09-10T12:00:00Z',
    booking_status: 'hold',
    ...overrides,
  });

  const candidate = {
    venueId: 'venue-grand-ballroom',
    blockStartAt: d('2026-09-10T10:00:00Z'),
    blockEndAt: d('2026-09-10T14:00:00Z'),
  };

  it('classifies a confirmed overlap as hard', () => {
    const result = findSpaceConflicts(candidate, [row({ booking_status: 'confirmed' })]);
    expect(result.hard).toHaveLength(1);
    expect(result.soft).toHaveLength(0);
  });

  it('classifies hold and quoted overlaps as soft', () => {
    const result = findSpaceConflicts(candidate, [
      row({ booking_status: 'hold' }),
      row({ booking_status: 'quoted' }),
    ]);
    expect(result.hard).toHaveLength(0);
    expect(result.soft).toHaveLength(2);
  });

  it('ignores inquiry, completed and cancelled overlaps', () => {
    const result = findSpaceConflicts(candidate, [
      row({ booking_status: 'inquiry' }),
      row({ booking_status: 'completed' }),
      row({ booking_status: 'cancelled' }),
    ]);
    expect(result.hard).toHaveLength(0);
    expect(result.soft).toHaveLength(0);
  });

  it('ignores rows of a different venue', () => {
    const result = findSpaceConflicts(candidate, [
      row({ venue_id: 'venue-summit-hall', booking_status: 'confirmed' }),
    ]);
    expect(result.hard).toHaveLength(0);
  });

  it('excludes rows of the booking being edited', () => {
    const result = findSpaceConflicts({ ...candidate, excludeBookingId: 'booking-mine' }, [
      row({ booking_id: 'booking-mine', booking_status: 'confirmed' }),
      row({ booking_id: 'booking-other', booking_status: 'confirmed' }),
    ]);
    expect(result.hard).toHaveLength(1);
    expect(result.hard[0].booking_id).toBe('booking-other');
  });

  it('ignores non-overlapping confirmed rows (half-open boundary)', () => {
    const result = findSpaceConflicts(candidate, [
      row({
        booking_status: 'confirmed',
        block_start_at: '2026-09-10T14:00:00Z',
        block_end_at: '2026-09-10T18:00:00Z',
      }),
    ]);
    expect(result.hard).toHaveLength(0);
  });

  it('accepts Date objects as well as ISO strings in rows', () => {
    const result = findSpaceConflicts(candidate, [
      row({
        booking_status: 'confirmed',
        block_start_at: d('2026-09-10T09:00:00Z'),
        block_end_at: d('2026-09-10T11:00:00Z'),
      }),
    ]);
    expect(result.hard).toHaveLength(1);
  });
});

describe('validateBookingSpacesPayload', () => {
  const validSpace = {
    venue_id: 'venue-grand-ballroom',
    start_at: '2026-09-10T08:00:00+07:00',
    end_at: '2026-09-10T17:00:00+07:00',
  };

  it('accepts a valid space and defaults buffers to 0', () => {
    const result = validateBookingSpacesPayload([validSpace]);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.spaces).toHaveLength(1);
    expect(result.spaces[0].setup_minutes).toBe(0);
    expect(result.spaces[0].teardown_minutes).toBe(0);
    expect(result.spaces[0].start_at).toBeInstanceOf(Date);
  });

  it('accepts explicit integer buffers', () => {
    const result = validateBookingSpacesPayload([
      { ...validSpace, setup_minutes: 120, teardown_minutes: 60 },
    ]);
    expect(result.ok).toBe(true);
    expect(result.spaces[0].setup_minutes).toBe(120);
    expect(result.spaces[0].teardown_minutes).toBe(60);
  });

  it('rejects a non-array payload', () => {
    const result = validateBookingSpacesPayload({ venue_id: 'x' });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('non-empty array');
  });

  it('rejects an empty array', () => {
    const result = validateBookingSpacesPayload([]);
    expect(result.ok).toBe(false);
  });

  it('rejects a missing venue_id', () => {
    const result = validateBookingSpacesPayload([{ ...validSpace, venue_id: '  ' }]);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('venue_id');
  });

  it('rejects an unparseable start_at', () => {
    const result = validateBookingSpacesPayload([{ ...validSpace, start_at: 'not-a-date' }]);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('start_at');
  });

  it('rejects end_at not after start_at', () => {
    const result = validateBookingSpacesPayload([
      { ...validSpace, end_at: '2026-09-10T08:00:00+07:00' },
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('after start_at');
  });

  it('rejects negative or non-integer buffers', () => {
    const result = validateBookingSpacesPayload([
      { ...validSpace, setup_minutes: -5, teardown_minutes: 1.5 },
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  it('labels errors with the item index and still parses the valid item', () => {
    const result = validateBookingSpacesPayload([validSpace, { venue_id: '' }]);
    expect(result.ok).toBe(false);
    expect(result.errors.every((e) => e.startsWith('spaces[1]'))).toBe(true);
    expect(result.spaces).toHaveLength(1);
  });
});

describe('computeQuoteTotals', () => {
  it('sums line items with no discount and no VAT', () => {
    const totals = computeQuoteTotals(
      [
        { quantity: 1, unit_price: 120000000 },
        { quantity: 2, unit_price: 4000000 },
      ],
      0,
      0,
    );
    expect(totals).toEqual({
      subtotal: 128000000,
      discountAmount: 0,
      vatAmount: 0,
      total: 128000000,
    });
  });

  it('applies discount then VAT on the discounted base', () => {
    const totals = computeQuoteTotals([{ quantity: 1, unit_price: 1000000 }], 12.5, 8);
    expect(totals.subtotal).toBe(1000000);
    expect(totals.discountAmount).toBe(125000);
    expect(totals.vatAmount).toBe(70000);
    expect(totals.total).toBe(945000);
  });

  it('rounds fractional quantities per line to whole VND', () => {
    const totals = computeQuoteTotals([{ quantity: 2.5, unit_price: 333333 }], 0, 0);
    expect(totals.subtotal).toBe(833333);
    expect(Number.isInteger(totals.total)).toBe(true);
  });

  it('returns zeros for an empty item list', () => {
    expect(computeQuoteTotals([], 10, 8)).toEqual({
      subtotal: 0,
      discountAmount: 0,
      vatAmount: 0,
      total: 0,
    });
  });

  it('handles a 100 percent discount', () => {
    const totals = computeQuoteTotals([{ quantity: 1, unit_price: 5000000 }], 100, 8);
    expect(totals.discountAmount).toBe(5000000);
    expect(totals.total).toBe(0);
  });
});

describe('formatBookingCode', () => {
  it('pads the sequence to four digits', () => {
    expect(formatBookingCode(2026, 1)).toBe('ARY-2026-0001');
  });

  it('formats a mid-range sequence', () => {
    expect(formatBookingCode(2026, 42)).toBe('ARY-2026-0042');
  });

  it('does not truncate sequences past 9999', () => {
    expect(formatBookingCode(2027, 12345)).toBe('ARY-2027-12345');
  });
});

describe('slugifyVenueName', () => {
  it('lowercases and dashes plain names', () => {
    expect(slugifyVenueName('Grand Ballroom')).toBe('grand-ballroom');
  });

  it('strips Vietnamese diacritics including the d-bar', () => {
    expect(slugifyVenueName('Phòng Đà Nẵng')).toBe('phong-da-nang');
  });

  it('trims and collapses separators', () => {
    expect(slugifyVenueName('  Hội An 1  ')).toBe('hoi-an-1');
  });

  it('collapses runs of punctuation into a single dash', () => {
    expect(slugifyVenueName('A --- B!!')).toBe('a-b');
  });
});
