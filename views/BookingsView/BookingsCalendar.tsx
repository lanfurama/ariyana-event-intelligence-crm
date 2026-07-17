import type React from 'react';
import type { Venue } from '../../types';
import type { AvailabilityBlock } from '../../services/apiService';
import {
  BOOKING_STATUS_BLOCK_CLASSES,
  blocksForVenueDay,
  formatDayNumber,
  formatTimeRange,
  formatWeekdayShort,
  isSameDay,
} from './calendarHelpers';

interface BookingsCalendarProps {
  venues: Venue[];
  days: Date[];
  blocks: AvailabilityBlock[];
  canEdit: boolean;
  onBlockClick: (bookingId: string) => void;
  onCellClick: (venueId: string, day: Date) => void;
}

/** Resource grid: one row per venue, one column per day of the visible week. */
export const BookingsCalendar: React.FC<BookingsCalendarProps> = ({
  venues,
  days,
  blocks,
  canEdit,
  onBlockClick,
  onCellClick,
}) => {
  const today = new Date();

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
      <div className="min-w-[920px]">
        <div className="grid grid-cols-[170px_repeat(7,minmax(0,1fr))] border-b border-slate-200 bg-slate-50/70">
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 self-center">
            Venue
          </div>
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={`px-2 py-2 text-center border-l border-slate-100 ${
                isSameDay(day, today) ? 'bg-brand-50/60' : ''
              }`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {formatWeekdayShort(day)}
              </div>
              <div
                className={`text-sm font-bold ${
                  isSameDay(day, today) ? 'text-brand-700' : 'text-slate-900'
                }`}
              >
                {formatDayNumber(day)}
              </div>
            </div>
          ))}
        </div>

        {venues.map((venue) => (
          <div
            key={venue.id}
            className="grid grid-cols-[170px_repeat(7,minmax(0,1fr))] border-b border-slate-100 last:border-b-0"
          >
            <div className="px-3 py-2 self-center">
              <div className="text-sm font-semibold text-slate-900 truncate" title={venue.name}>
                {venue.name}
              </div>
              <div className="text-[11px] text-slate-400">
                {venue.floor ? `${venue.floor}` : ''}
                {venue.floor && venue.capacities.theatre ? ' · ' : ''}
                {venue.capacities.theatre ? `${venue.capacities.theatre} pax` : ''}
              </div>
            </div>
            {days.map((day) => {
              const dayBlocks = blocksForVenueDay(blocks, venue.id, day);
              return (
                <div
                  key={day.toISOString()}
                  onClick={() => canEdit && onCellClick(venue.id, day)}
                  className={`border-l border-slate-100 p-1 min-h-[56px] space-y-1 ${
                    isSameDay(day, today) ? 'bg-brand-50/30' : ''
                  } ${canEdit ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                >
                  {dayBlocks.map((block) => (
                    <button
                      key={block.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onBlockClick(block.booking_id);
                      }}
                      title={`${block.code} — ${block.title} (${block.booking_status})`}
                      className={`w-full text-left px-1.5 py-1 rounded border text-[11px] leading-tight ${
                        BOOKING_STATUS_BLOCK_CLASSES[block.booking_status]
                      }`}
                    >
                      <div className="font-semibold truncate">{block.title}</div>
                      <div className="opacity-75">
                        {formatTimeRange(block.start_at, block.end_at)}
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
