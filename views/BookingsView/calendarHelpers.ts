import type { BookingStatus } from '../../types';
import type { BadgeTone } from '../../components/ui';

// Pure calendar/formatting helpers for the Bookings UI. Day boundaries are
// browser-local time (operations run in Asia/Ho_Chi_Minh; the tool is internal).

export const BOOKING_STATUSES: BookingStatus[] = [
  'inquiry',
  'hold',
  'quoted',
  'confirmed',
  'completed',
  'cancelled',
];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  inquiry: 'Inquiry',
  hold: 'Hold',
  quoted: 'Quoted',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const BOOKING_STATUS_TONES: Record<BookingStatus, BadgeTone> = {
  inquiry: 'slate',
  hold: 'amber',
  quoted: 'sky',
  confirmed: 'emerald',
  completed: 'violet',
  cancelled: 'rose',
};

/** Solid chip classes for calendar blocks (Badge tones are too faint at cell size). */
export const BOOKING_STATUS_BLOCK_CLASSES: Record<BookingStatus, string> = {
  inquiry: 'bg-slate-100 text-slate-700 border-slate-300',
  hold: 'bg-amber-100 text-amber-800 border-amber-300',
  quoted: 'bg-sky-100 text-sky-800 border-sky-300',
  confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  completed: 'bg-violet-100 text-violet-800 border-violet-300',
  cancelled: 'bg-rose-100 text-rose-700 border-rose-300 line-through',
};

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Monday 00:00 (local) of the week containing `anchor`. */
export function getWeekStart(anchor: Date): Date {
  const day = startOfDay(anchor);
  const mondayOffset = (day.getDay() + 6) % 7;
  return addDays(day, -mondayOffset);
}

/** The 7 local days (Mon–Sun) of the week containing `anchor`. */
export function getWeekDays(anchor: Date): Date[] {
  const weekStart = getWeekStart(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Minimal structural view of an availability block for the grid. */
export interface CalendarBlockLike {
  venue_id: string;
  block_start_at: string | Date;
  block_end_at: string | Date;
}

/**
 * Does the block occupy any part of the local day starting at `day` 00:00?
 * Half-open on both sides: a block ending exactly at 00:00 does not bleed
 * into the next day, mirroring the tstzrange('[)') semantics of the API.
 */
export function blockOverlapsDay(block: CalendarBlockLike, day: Date): boolean {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = addDays(startOfDay(day), 1).getTime();
  const blockStart = new Date(block.block_start_at).getTime();
  const blockEnd = new Date(block.block_end_at).getTime();
  return blockStart < dayEnd && dayStart < blockEnd;
}

/** Blocks of one venue overlapping one day, ordered by start time. */
export function blocksForVenueDay<T extends CalendarBlockLike>(
  blocks: T[],
  venueId: string,
  day: Date,
): T[] {
  return blocks
    .filter((block) => block.venue_id === venueId && blockOverlapsDay(block, day))
    .sort((a, b) => new Date(a.block_start_at).getTime() - new Date(b.block_start_at).getTime());
}

/** '08:00 – 17:00' in local time. */
export function formatTimeRange(startAt: string | Date, endAt: string | Date): string {
  const fmt = (value: string | Date) =>
    new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${fmt(startAt)} – ${fmt(endAt)}`;
}

/** '17/07' style short date for day headers. */
export function formatDayNumber(day: Date): string {
  return day.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
}

/** 'Mon' / 'Tue' … for day headers. */
export function formatWeekdayShort(day: Date): string {
  return day.toLocaleDateString('en-GB', { weekday: 'short' });
}

/** '14 – 20 Jul 2026' label for the visible week. */
export function formatWeekRangeLabel(anchor: Date): string {
  const days = getWeekDays(anchor);
  const first = days[0];
  const last = days[6];
  const monthYear = last.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  if (first.getMonth() === last.getMonth()) {
    return `${first.getDate()} – ${last.getDate()} ${monthYear}`;
  }
  const firstMonth = first.toLocaleDateString('en-GB', { month: 'short' });
  return `${first.getDate()} ${firstMonth} – ${last.getDate()} ${monthYear}`;
}

/** '120,000,000 ₫' — deterministic grouping, no Intl currency dependence. */
export function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('en-US')} ₫`;
}

/** Summarize a booking's spaces for list rows: 'Grand Ballroom · 10/09 +2 more'. */
export function summarizeSpaces(
  spaces: Array<{ venue_id: string; start_at: string | Date }>,
  venueNameById: Record<string, string>,
): string {
  if (spaces.length === 0) return 'No spaces';
  const first = spaces[0];
  const name = venueNameById[first.venue_id] || first.venue_id;
  const date = new Date(first.start_at).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
  });
  const more = spaces.length > 1 ? ` +${spaces.length - 1} more` : '';
  return `${name} · ${date}${more}`;
}
