import { describe, expect, it } from 'vitest';
import {
  addDays,
  blockOverlapsDay,
  blocksForVenueDay,
  formatDayNumber,
  formatTimeRange,
  formatVnd,
  formatWeekRangeLabel,
  formatWeekdayShort,
  getWeekDays,
  getWeekStart,
  isSameDay,
  startOfDay,
  summarizeSpaces,
} from './calendarHelpers';

// 2026-07-17 is a Friday; 2026-07-13 the Monday of that week.
const friday = new Date(2026, 6, 17, 15, 30);

describe('week math', () => {
  it('startOfDay zeroes the time', () => {
    const d = startOfDay(friday);
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([0, 0, 0]);
    expect(d.getDate()).toBe(17);
  });

  it('addDays crosses month boundaries', () => {
    const d = addDays(new Date(2026, 6, 31), 1);
    expect([d.getMonth(), d.getDate()]).toEqual([7, 1]);
  });

  it('getWeekStart returns the Monday of a mid-week date', () => {
    const monday = getWeekStart(friday);
    expect(monday.getDay()).toBe(1);
    expect([monday.getMonth(), monday.getDate()]).toEqual([6, 13]);
  });

  it('getWeekStart of a Sunday returns the preceding Monday', () => {
    const monday = getWeekStart(new Date(2026, 6, 19));
    expect([monday.getMonth(), monday.getDate()]).toEqual([6, 13]);
  });

  it('getWeekStart of a Monday returns the same day', () => {
    const monday = getWeekStart(new Date(2026, 6, 13, 23, 59));
    expect([monday.getMonth(), monday.getDate()]).toEqual([6, 13]);
  });

  it('getWeekDays returns Mon..Sun', () => {
    const days = getWeekDays(friday);
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(1);
    expect(days[6].getDay()).toBe(0);
    expect(days[6].getDate()).toBe(19);
  });

  it('isSameDay ignores time of day', () => {
    expect(isSameDay(new Date(2026, 6, 17, 1), new Date(2026, 6, 17, 23))).toBe(true);
    expect(isSameDay(new Date(2026, 6, 17), new Date(2026, 6, 18))).toBe(false);
  });
});

describe('blockOverlapsDay', () => {
  const day = new Date(2026, 8, 10); // 2026-09-10 local

  const block = (start: string, end: string) => ({
    venue_id: 'venue-grand-ballroom',
    block_start_at: start,
    block_end_at: end,
  });

  it('detects a block inside the day', () => {
    expect(
      blockOverlapsDay(block('2026-09-10T08:00:00+07:00', '2026-09-10T17:00:00+07:00'), day),
    ).toBe(true);
  });

  it('detects a multi-day block spanning the day', () => {
    expect(
      blockOverlapsDay(block('2026-09-09T08:00:00+07:00', '2026-09-12T17:00:00+07:00'), day),
    ).toBe(true);
  });

  it('half-open: a block ending exactly at local midnight does not bleed into the day', () => {
    expect(
      blockOverlapsDay(block('2026-09-09T20:00:00+07:00', '2026-09-10T00:00:00+07:00'), day),
    ).toBe(false);
  });

  it('half-open: a block starting exactly at local midnight belongs to the day', () => {
    expect(
      blockOverlapsDay(block('2026-09-10T00:00:00+07:00', '2026-09-10T02:00:00+07:00'), day),
    ).toBe(true);
  });

  it('rejects blocks on other days', () => {
    expect(
      blockOverlapsDay(block('2026-09-11T08:00:00+07:00', '2026-09-11T17:00:00+07:00'), day),
    ).toBe(false);
  });
});

describe('blocksForVenueDay', () => {
  const day = new Date(2026, 8, 10);
  const rows = [
    {
      venue_id: 'venue-a',
      block_start_at: '2026-09-10T13:00:00+07:00',
      block_end_at: '2026-09-10T17:00:00+07:00',
    },
    {
      venue_id: 'venue-a',
      block_start_at: '2026-09-10T08:00:00+07:00',
      block_end_at: '2026-09-10T12:00:00+07:00',
    },
    {
      venue_id: 'venue-b',
      block_start_at: '2026-09-10T08:00:00+07:00',
      block_end_at: '2026-09-10T12:00:00+07:00',
    },
    {
      venue_id: 'venue-a',
      block_start_at: '2026-09-11T08:00:00+07:00',
      block_end_at: '2026-09-11T12:00:00+07:00',
    },
  ];

  it('filters by venue and day, sorted by start time', () => {
    const result = blocksForVenueDay(rows, 'venue-a', day);
    expect(result).toHaveLength(2);
    expect(result[0].block_start_at).toBe('2026-09-10T08:00:00+07:00');
    expect(result[1].block_start_at).toBe('2026-09-10T13:00:00+07:00');
  });

  it('returns empty for a venue with no blocks that day', () => {
    expect(blocksForVenueDay(rows, 'venue-c', day)).toHaveLength(0);
  });
});

describe('formatting', () => {
  it('formatTimeRange renders local HH:mm', () => {
    expect(formatTimeRange(new Date(2026, 8, 10, 8, 0), new Date(2026, 8, 10, 17, 30))).toBe(
      '08:00 – 17:30',
    );
  });

  it('formatDayNumber / formatWeekdayShort', () => {
    expect(formatDayNumber(new Date(2026, 6, 17))).toBe('17/07');
    expect(formatWeekdayShort(new Date(2026, 6, 17))).toBe('Fri');
  });

  it('formatWeekRangeLabel within one month', () => {
    expect(formatWeekRangeLabel(friday)).toBe('13 – 19 Jul 2026');
  });

  it('formatWeekRangeLabel across months', () => {
    expect(formatWeekRangeLabel(new Date(2026, 7, 1))).toBe('27 Jul – 2 Aug 2026');
  });

  it('formatVnd groups with commas and rounds', () => {
    expect(formatVnd(120000000)).toBe('120,000,000 ₫');
    expect(formatVnd(1234.6)).toBe('1,235 ₫');
  });

  it('summarizeSpaces names the first space and counts the rest', () => {
    const names = { 'venue-a': 'Grand Ballroom' };
    expect(
      summarizeSpaces(
        [
          { venue_id: 'venue-a', start_at: '2026-09-10T08:00:00+07:00' },
          { venue_id: 'venue-a', start_at: '2026-09-11T08:00:00+07:00' },
          { venue_id: 'venue-b', start_at: '2026-09-12T08:00:00+07:00' },
        ],
        names,
      ),
    ).toBe('Grand Ballroom · 10/09 +2 more');
    expect(summarizeSpaces([], names)).toBe('No spaces');
  });
});
