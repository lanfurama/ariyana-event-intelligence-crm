import { describe, expect, it } from 'vitest';
import type { Venue } from '../../types';
import { capacityFor, suggestVenues } from './venueFitHelpers';

const venue = (id: string, capacities: Venue['capacities']): Venue => ({
  id,
  name: id,
  slug: id,
  capacities,
  images: [],
  base_rates: {},
  amenities: [],
  is_active: true,
  display_order: 0,
});

const ballroom = venue('ballroom', { theatre: 2500, banquet: 1200, cocktail: 2000 });
const summit = venue('summit', { theatre: 500, banquet: 350, boardroom: 60 });
const meeting = venue('meeting', { theatre: 120, ushape: 45 });

describe('capacityFor', () => {
  it('returns the capacity of the requested layout', () => {
    expect(capacityFor(summit, 'banquet')).toBe(350);
  });

  it('returns null when the venue lacks that layout', () => {
    expect(capacityFor(meeting, 'banquet')).toBeNull();
  });

  it('falls back to the max capacity when no layout is given', () => {
    expect(capacityFor(ballroom)).toBe(2500);
    expect(capacityFor(venue('empty', {}))).toBeNull();
  });
});

describe('suggestVenues', () => {
  const window = {
    windowStart: new Date('2026-11-05T01:00:00Z'),
    windowEnd: new Date('2026-11-05T10:00:00Z'),
  };

  it('puts the smallest adequate free venue first', () => {
    const result = suggestVenues([ballroom, summit, meeting], [], {
      guests: 300,
      layout: 'theatre',
      ...window,
    });
    expect(result.map((s) => s.venue.id)).toEqual(['summit', 'ballroom', 'meeting']);
    expect(result[0].fits).toBe(true);
    expect(result[2].fits).toBe(false);
  });

  it('demotes fitting venues that are busy in the window', () => {
    const busy = [
      {
        venue_id: 'summit',
        block_start_at: '2026-11-05T02:00:00Z',
        block_end_at: '2026-11-05T05:00:00Z',
      },
    ];
    const result = suggestVenues([ballroom, summit], busy, {
      guests: 300,
      layout: 'theatre',
      ...window,
    });
    expect(result[0].venue.id).toBe('ballroom');
    expect(result[1].venue.id).toBe('summit');
    expect(result[1].free).toBe(false);
    expect(result[1].conflicts).toBe(1);
  });

  it('busy blocks outside the window do not count', () => {
    const busy = [
      {
        venue_id: 'summit',
        block_start_at: '2026-11-06T02:00:00Z',
        block_end_at: '2026-11-06T05:00:00Z',
      },
    ];
    const result = suggestVenues([summit], busy, { guests: 300, layout: 'theatre', ...window });
    expect(result[0].free).toBe(true);
  });

  it('free is null when no window is given', () => {
    const result = suggestVenues([summit], [], { guests: 300, layout: 'theatre' });
    expect(result[0].free).toBeNull();
  });

  it('without guests, any venue with a capacity fits', () => {
    const result = suggestVenues([meeting, ballroom], [], { layout: 'theatre' });
    expect(result.every((s) => s.fits)).toBe(true);
    expect(result[0].venue.id).toBe('meeting'); // smallest first
  });

  it('when nothing fits, ranks biggest capacity first', () => {
    const result = suggestVenues([meeting, summit], [], { guests: 5000, layout: 'theatre' });
    expect(result[0].venue.id).toBe('summit');
    expect(result.every((s) => !s.fits)).toBe(true);
  });
});
