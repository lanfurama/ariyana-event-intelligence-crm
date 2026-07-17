import { useState } from 'react';
import type React from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, List, Plus } from 'lucide-react';
import type { Booking, Lead, User } from '../types';
import { bookingsApi } from '../services/apiService';
import { Button, PageHeader } from '../components/ui';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { BookingDetail } from '../components/BookingDetail';
import type { CreatePrefill } from '../components/BookingDetail/useBookingForm';
import { BookingsCalendar } from './BookingsView/BookingsCalendar';
import { BookingsList } from './BookingsView/BookingsList';
import { useBookingsData } from './BookingsView/useBookingsData';
import { addDays, formatWeekRangeLabel, getWeekDays } from './BookingsView/calendarHelpers';

type DrawerState =
  | { mode: 'create'; prefill: CreatePrefill | null }
  | { mode: 'edit'; booking: Booking }
  | null;

interface BookingsViewProps {
  user: User;
  leads: Lead[];
}

export const BookingsView: React.FC<BookingsViewProps> = ({ user, leads }) => {
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [drawer, setDrawer] = useState<DrawerState>(null);

  const { venues, blocks, bookings, loading, error, refetch } = useBookingsData(weekAnchor);
  const canEdit = user.role === 'Director' || user.role === 'Sales';
  const days = getWeekDays(weekAnchor);

  const openBooking = async (bookingId: string) => {
    try {
      const booking = await bookingsApi.getById(bookingId);
      setDrawer({ mode: 'edit', booking });
    } catch (e: any) {
      console.error('Error loading booking:', e);
      alert(e.message || 'Failed to load booking');
    }
  };

  const handleSavedOrDeleted = () => {
    setDrawer(null);
    refetch();
  };

  const toggleClass = (active: boolean) =>
    `px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors ${
      active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
    }`;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Bookings"
        subtitle="Venue rentals — calendar & pipeline"
        actions={
          <>
            <div className="flex items-center rounded-lg border border-slate-300 overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                className={toggleClass(viewMode === 'calendar')}
              >
                <CalendarDays size={14} /> Calendar
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`${toggleClass(viewMode === 'list')} border-l border-slate-300`}
              >
                <List size={14} /> List
              </button>
            </div>
            {canEdit && (
              <Button size="sm" onClick={() => setDrawer({ mode: 'create', prefill: null })}>
                <Plus size={15} /> New Booking
              </Button>
            )}
          </>
        }
      />

      {viewMode === 'calendar' && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setWeekAnchor((prev) => addDays(prev, -7))}
              aria-label="Previous week"
            >
              <ChevronLeft size={15} />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setWeekAnchor(new Date())}>
              Today
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setWeekAnchor((prev) => addDays(prev, 7))}
              aria-label="Next week"
            >
              <ChevronRight size={15} />
            </Button>
          </div>
          <div className="text-sm font-semibold text-slate-700">
            {formatWeekRangeLabel(weekAnchor)}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-3 py-2 flex items-center justify-between">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={refetch}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <div className="py-16">
          <LoadingSpinner />
        </div>
      ) : viewMode === 'calendar' ? (
        <BookingsCalendar
          venues={venues}
          days={days}
          blocks={blocks}
          canEdit={canEdit}
          onBlockClick={openBooking}
          onCellClick={(venueId, day) => setDrawer({ mode: 'create', prefill: { venueId, day } })}
        />
      ) : (
        <BookingsList bookings={bookings} venues={venues} onOpen={openBooking} />
      )}

      {viewMode === 'calendar' && !loading && (
        <p className="text-xs text-slate-400">
          Calendar shows hold / quoted / confirmed bookings (setup & teardown included in block
          times shown on hover). Inquiries and closed bookings live in the List view.
          {canEdit ? ' Click an empty cell to create a booking for that venue and day.' : ''}
        </p>
      )}

      {drawer && (
        <BookingDetail
          booking={drawer.mode === 'edit' ? drawer.booking : null}
          prefill={drawer.mode === 'create' ? drawer.prefill : null}
          venues={venues}
          leads={leads}
          user={user}
          onClose={() => setDrawer(null)}
          onSaved={handleSavedOrDeleted}
          onDeleted={handleSavedOrDeleted}
        />
      )}
    </div>
  );
};
