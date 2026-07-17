import type { Venue, VenueCapacities } from '../../types';

// Deterministic venue suggestion — capacity fit + free/busy. Deliberately NOT
// an LLM call: this is arithmetic over structured data (see the P4 plan).

export interface BusyBlockLike {
  venue_id: string;
  block_start_at: string | Date;
  block_end_at: string | Date;
}

export interface VenueFitCriteria {
  guests?: number;
  /** One of the VenueCapacities keys; unknown/empty -> best capacity of any layout. */
  layout?: string;
  /** The time window the space is needed for (used against busy blocks). */
  windowStart?: Date;
  windowEnd?: Date;
}

export interface VenueSuggestion {
  venue: Venue;
  /** Capacity for the requested layout (max capacity when no layout given); null if unknown. */
  capacity: number | null;
  fits: boolean;
  /** null when no window was provided. */
  free: boolean | null;
  conflicts: number;
}

const isCapacityKey = (layout: string): layout is keyof VenueCapacities =>
  ['theatre', 'classroom', 'banquet', 'cocktail', 'ushape', 'boardroom'].includes(layout);

export function capacityFor(venue: Venue, layout?: string): number | null {
  if (layout && isCapacityKey(layout)) {
    return venue.capacities[layout] ?? null;
  }
  const values = Object.values(venue.capacities).filter(
    (value): value is number => typeof value === 'number',
  );
  return values.length > 0 ? Math.max(...values) : null;
}

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart < bEnd && bStart < aEnd;

/**
 * Rank venues for a request: fitting + free first (smallest adequate room
 * first — don't burn the Grand Ballroom on 40 people), then fitting-but-busy,
 * then everything else by capacity descending.
 */
export function suggestVenues(
  venues: Venue[],
  busyBlocks: BusyBlockLike[],
  criteria: VenueFitCriteria,
): VenueSuggestion[] {
  const hasWindow = !!(criteria.windowStart && criteria.windowEnd);

  const suggestions = venues.map((venue): VenueSuggestion => {
    const capacity = capacityFor(venue, criteria.layout);
    const fits =
      capacity !== null && (criteria.guests === undefined || capacity >= criteria.guests);

    let conflicts = 0;
    if (hasWindow) {
      const start = criteria.windowStart!.getTime();
      const end = criteria.windowEnd!.getTime();
      conflicts = busyBlocks.filter(
        (block) =>
          block.venue_id === venue.id &&
          overlaps(
            start,
            end,
            new Date(block.block_start_at).getTime(),
            new Date(block.block_end_at).getTime(),
          ),
      ).length;
    }

    return {
      venue,
      capacity,
      fits,
      free: hasWindow ? conflicts === 0 : null,
      conflicts,
    };
  });

  const rank = (s: VenueSuggestion) => {
    if (s.fits && s.free !== false) return 0;
    if (s.fits) return 1;
    return 2;
  };

  return suggestions.sort((a, b) => {
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    const aCap = a.capacity ?? 0;
    const bCap = b.capacity ?? 0;
    // Within fitting groups: smallest adequate first; otherwise biggest first.
    return rank(a) < 2 ? aCap - bCap : bCap - aCap;
  });
}
