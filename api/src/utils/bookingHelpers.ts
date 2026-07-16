import type { BookingStatus } from '../types/index.js';

// Status classes shared by BookingModel, the bookings routes, and (later) the UI.
// confirmed = hard block (also enforced by the DB exclusion constraint);
// hold/quoted = tentative options that may overlap (MICE 1st/2nd option practice)
// and surface as warnings; inquiry/completed/cancelled never block.
export const HARD_BLOCK_STATUSES: readonly BookingStatus[] = ['confirmed'];
export const SOFT_BLOCK_STATUSES: readonly BookingStatus[] = ['hold', 'quoted'];

const MS_PER_MINUTE = 60_000;

/**
 * Half-open [start, end) overlap: back-to-back ranges (a ends exactly when b
 * starts) do NOT overlap. Mirrors the tstzrange('[)') semantics of the
 * booking_spaces exclusion constraint.
 */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

export interface BlockRange {
  blockStartAt: Date;
  blockEndAt: Date;
}

/** Widen the event range by setup/teardown buffers → the range a venue is actually occupied. */
export function computeBlockRange(
  startAt: Date,
  endAt: Date,
  setupMinutes: number,
  teardownMinutes: number,
): BlockRange {
  return {
    blockStartAt: new Date(startAt.getTime() - setupMinutes * MS_PER_MINUTE),
    blockEndAt: new Date(endAt.getTime() + teardownMinutes * MS_PER_MINUTE),
  };
}

/** Shape of a booking_spaces row joined with its booking status (as returned by BookingModel). */
export interface SpaceWindowRow {
  booking_id: string;
  venue_id: string;
  block_start_at: Date | string;
  block_end_at: Date | string;
  booking_status: string;
}

export interface ConflictCandidate {
  venueId: string;
  blockStartAt: Date;
  blockEndAt: Date;
  /** When editing an existing booking, its own spaces must not count as conflicts. */
  excludeBookingId?: string;
}

export interface SpaceConflicts<T extends SpaceWindowRow> {
  hard: T[];
  soft: T[];
}

/** Classify existing space rows against a candidate window into hard/soft conflicts. */
export function findSpaceConflicts<T extends SpaceWindowRow>(
  candidate: ConflictCandidate,
  existing: T[],
): SpaceConflicts<T> {
  const hard: T[] = [];
  const soft: T[] = [];
  for (const row of existing) {
    if (row.venue_id !== candidate.venueId) continue;
    if (candidate.excludeBookingId && row.booking_id === candidate.excludeBookingId) continue;
    const overlaps = rangesOverlap(
      candidate.blockStartAt,
      candidate.blockEndAt,
      new Date(row.block_start_at),
      new Date(row.block_end_at),
    );
    if (!overlaps) continue;
    if ((HARD_BLOCK_STATUSES as readonly string[]).includes(row.booking_status)) {
      hard.push(row);
    } else if ((SOFT_BLOCK_STATUSES as readonly string[]).includes(row.booking_status)) {
      soft.push(row);
    }
  }
  return { hard, soft };
}

export interface BookingSpaceInput {
  venue_id: string;
  start_at: Date;
  end_at: Date;
  setup_minutes: number;
  teardown_minutes: number;
}

export interface SpacesValidationResult {
  ok: boolean;
  errors: string[];
  spaces: BookingSpaceInput[];
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function parseBufferMinutes(value: unknown, label: string, errors: string[]): number | null {
  if (value === undefined || value === null) return 0;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    errors.push(`${label} must be a non-negative integer (minutes)`);
    return null;
  }
  return value;
}

/** Validate + normalize the `spaces` array of a POST/PUT bookings payload. */
export function validateBookingSpacesPayload(input: unknown): SpacesValidationResult {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, errors: ['spaces must be a non-empty array'], spaces: [] };
  }

  const errors: string[] = [];
  const spaces: BookingSpaceInput[] = [];

  input.forEach((raw, index) => {
    const label = `spaces[${index}]`;
    if (typeof raw !== 'object' || raw === null) {
      errors.push(`${label} must be an object`);
      return;
    }
    const record = raw as Record<string, unknown>;

    const venueId = typeof record.venue_id === 'string' ? record.venue_id.trim() : '';
    if (venueId === '') errors.push(`${label}.venue_id is required`);

    const startAt = parseDate(record.start_at);
    if (!startAt) errors.push(`${label}.start_at must be a valid ISO date`);
    const endAt = parseDate(record.end_at);
    if (!endAt) errors.push(`${label}.end_at must be a valid ISO date`);
    if (startAt && endAt && endAt.getTime() <= startAt.getTime()) {
      errors.push(`${label}.end_at must be after start_at`);
    }

    const setupMinutes = parseBufferMinutes(record.setup_minutes, `${label}.setup_minutes`, errors);
    const teardownMinutes = parseBufferMinutes(
      record.teardown_minutes,
      `${label}.teardown_minutes`,
      errors,
    );

    if (
      venueId !== '' &&
      startAt &&
      endAt &&
      endAt.getTime() > startAt.getTime() &&
      setupMinutes !== null &&
      teardownMinutes !== null
    ) {
      spaces.push({
        venue_id: venueId,
        start_at: startAt,
        end_at: endAt,
        setup_minutes: setupMinutes,
        teardown_minutes: teardownMinutes,
      });
    }
  });

  return { ok: errors.length === 0, errors, spaces };
}

export interface QuoteItemInput {
  quantity: number;
  unit_price: number;
}

export interface QuoteTotals {
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  total: number;
}

/** VND money math: integers only, rounded per line and per aggregate. */
export function computeQuoteTotals(
  items: QuoteItemInput[],
  discountPct: number,
  vatPct: number,
): QuoteTotals {
  const subtotal = items.reduce((sum, item) => sum + Math.round(item.quantity * item.unit_price), 0);
  const discountAmount = Math.round((subtotal * discountPct) / 100);
  const taxable = subtotal - discountAmount;
  const vatAmount = Math.round((taxable * vatPct) / 100);
  return { subtotal, discountAmount, vatAmount, total: taxable + vatAmount };
}

/** 'ARY-2026-0042' — seq comes from the booking_code_seq Postgres sequence. */
export function formatBookingCode(year: number, seq: number): string {
  return `ARY-${year}-${String(seq).padStart(4, '0')}`;
}

/** 'Phòng Đà Nẵng' → 'phong-da-nang'. đ/Đ do not decompose under NFD, hence the explicit replace. */
export function slugifyVenueName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
