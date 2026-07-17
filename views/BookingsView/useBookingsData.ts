import { useCallback, useEffect, useState } from 'react';
import type { Booking, Venue } from '../../types';
import type { AvailabilityBlock } from '../../services/apiService';
import { bookingsApi, venuesApi } from '../../services/apiService';
import { addDays, getWeekStart } from './calendarHelpers';

/** Loads venues + the visible week's availability blocks + the full bookings list. */
export function useBookingsData(weekAnchor: Date) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stable primitive dependency: refetch only when the visible week actually changes.
  const weekStartMs = getWeekStart(weekAnchor).getTime();

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const weekStart = new Date(weekStartMs);
      const weekEnd = addDays(weekStart, 7);
      const [venuesResult, blocksResult, bookingsResult] = await Promise.all([
        venuesApi.getAll(),
        bookingsApi.getAvailability(weekStart.toISOString(), weekEnd.toISOString()),
        bookingsApi.getAll(),
      ]);
      setVenues(venuesResult);
      setBlocks(blocksResult);
      setBookings(bookingsResult);
    } catch (e: any) {
      console.error('Error loading bookings data:', e);
      setError(e.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [weekStartMs]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { venues, blocks, bookings, loading, error, refetch };
}
