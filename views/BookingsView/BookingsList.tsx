import { useMemo, useState } from 'react';
import type React from 'react';
import { CalendarDays } from 'lucide-react';
import type { Booking, BookingStatus, Venue } from '../../types';
import { Badge, EmptyState } from '../../components/ui';
import {
  BOOKING_STATUSES,
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_TONES,
  summarizeSpaces,
} from './calendarHelpers';

interface BookingsListProps {
  bookings: Booking[];
  venues: Venue[];
  onOpen: (bookingId: string) => void;
}

/** Pipeline list: status filter chips + one row per booking. */
export const BookingsList: React.FC<BookingsListProps> = ({ bookings, venues, onOpen }) => {
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');

  const venueNameById = useMemo(
    () => Object.fromEntries(venues.map((venue) => [venue.id, venue.name])),
    [venues],
  );

  const countsByStatus = useMemo(() => {
    const counts: Partial<Record<BookingStatus, number>> = {};
    bookings.forEach((booking) => {
      counts[booking.status] = (counts[booking.status] || 0) + 1;
    });
    return counts;
  }, [bookings]);

  const visible =
    statusFilter === 'all'
      ? bookings
      : bookings.filter((booking) => booking.status === statusFilter);

  const chipClass = (active: boolean) =>
    `px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
      active
        ? 'bg-slate-900 text-white border-slate-900'
        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
    }`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={chipClass(statusFilter === 'all')}
        >
          All ({bookings.length})
        </button>
        {BOOKING_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={chipClass(statusFilter === status)}
          >
            {BOOKING_STATUS_LABELS[status]} ({countsByStatus[status] || 0})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={22} />}
          title="No bookings"
          description="Create the first booking from the calendar or the New Booking button."
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {visible.map((booking) => (
            <button
              key={booking.id}
              type="button"
              onClick={() => onOpen(booking.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 truncate">
                    {booking.title}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">
                    {booking.code}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">
                  {summarizeSpaces(booking.spaces, venueNameById)}
                  {booking.expected_guests ? ` · ${booking.expected_guests} pax` : ''}
                  {booking.event_type ? ` · ${booking.event_type}` : ''}
                </div>
              </div>
              <Badge tone={BOOKING_STATUS_TONES[booking.status]} className="shrink-0">
                {BOOKING_STATUS_LABELS[booking.status]}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
