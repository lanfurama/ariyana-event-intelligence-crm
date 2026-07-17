import { useState } from 'react';
import type React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import type { Booking, Lead, User, Venue } from '../types';
import { Badge, Button, inputClass, labelClass, selectClass, textareaClass } from './ui';
import { useEscapeKey } from '../hooks/useEscapeKey';
import {
  BOOKING_STATUSES,
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_TONES,
  formatTimeRange,
} from '../views/BookingsView/calendarHelpers';
import type { CreatePrefill } from './BookingDetail/useBookingForm';
import { useBookingForm } from './BookingDetail/useBookingForm';
import { LeadPicker } from './BookingDetail/LeadPicker';
import { useQuotes } from './BookingDetail/useQuotes';
import { QuotesTab } from './BookingDetail/QuotesTab';

const LAYOUT_OPTIONS = ['theatre', 'classroom', 'banquet', 'cocktail', 'ushape', 'boardroom'];

interface BookingDetailProps {
  booking: Booking | null; // null = create mode
  prefill: CreatePrefill | null;
  venues: Venue[];
  leads: Lead[];
  user: User;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

export const BookingDetail: React.FC<BookingDetailProps> = ({
  booking,
  prefill,
  venues,
  leads,
  user,
  onClose,
  onSaved,
  onDeleted,
}) => {
  const form = useBookingForm(booking, prefill, onSaved, onDeleted);
  const {
    draft,
    isEditing,
    saving,
    error,
    conflicts,
    checkingConflicts,
    suggestions,
    suggesting,
    setField,
    updateSpace,
    addSpace,
    removeSpace,
    handleSuggestVenues,
    applySuggestion,
    handleCheckConflicts,
    handleSave,
    handleDelete,
  } = form;

  const canEdit = user.role === 'Director' || user.role === 'Sales';
  const [activeTab, setActiveTab] = useState<'details' | 'quotes'>('details');
  const quotes = useQuotes(booking?.id ?? null, activeTab === 'quotes', booking, leads);

  useEscapeKey(true, onClose);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-slide-in-right border-l border-slate-200">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight truncate">
              {isEditing ? draft.title || 'Booking' : 'New Booking'}
            </h2>
            {booking && (
              <span className="text-xs font-mono text-slate-400 shrink-0">{booking.code}</span>
            )}
            <Badge tone={BOOKING_STATUS_TONES[draft.status]} className="shrink-0">
              {BOOKING_STATUS_LABELS[draft.status]}
            </Badge>
          </div>
          <button onClick={onClose} className="text-slate-400 p-1.5 rounded-lg hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {/* Tabs — quotes exist only for saved bookings */}
        {booking && (
          <div className="flex border-b border-slate-200 bg-white">
            <button
              onClick={() => setActiveTab('details')}
              className={`flex-1 py-2 font-semibold text-xs flex justify-center items-center gap-1.5 ${
                activeTab === 'details'
                  ? 'text-brand-700 border-b-2 border-brand-500 bg-brand-50/50'
                  : 'text-slate-500'
              }`}
            >
              <span>Details</span>
            </button>
            <button
              onClick={() => setActiveTab('quotes')}
              className={`flex-1 py-2 font-semibold text-xs flex justify-center items-center gap-1.5 ${
                activeTab === 'quotes'
                  ? 'text-brand-700 border-b-2 border-brand-500 bg-brand-50/50'
                  : 'text-slate-500'
              }`}
            >
              <FileText size={14} />
              <span>Quotes{quotes.quotes.length > 0 ? ` (${quotes.quotes.length})` : ''}</span>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-4 flex-1 overflow-y-auto">
          {activeTab === 'quotes' && booking ? (
            <QuotesTab quotes={quotes} user={user} canEdit={canEdit} />
          ) : (
            <fieldset disabled={!canEdit || saving} className="space-y-5">
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={labelClass}>Title *</label>
                  <input
                    type="text"
                    value={draft.title}
                    onChange={(e) => setField('title', e.target.value)}
                    placeholder="e.g. ACME Annual Conference 2026"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select
                    value={draft.status}
                    onChange={(e) => setField('status', e.target.value as Booking['status'])}
                    className={selectClass}
                  >
                    {BOOKING_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {BOOKING_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Event type</label>
                  <input
                    type="text"
                    value={draft.event_type}
                    onChange={(e) => setField('event_type', e.target.value)}
                    placeholder="conference / banquet / exhibition…"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Expected guests</label>
                  <input
                    type="number"
                    min={0}
                    value={draft.expected_guests}
                    onChange={(e) => setField('expected_guests', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Layout</label>
                  <select
                    value={draft.layout}
                    onChange={(e) => setField('layout', e.target.value)}
                    className={selectClass}
                  >
                    <option value="">—</option>
                    {LAYOUT_OPTIONS.map((layout) => (
                      <option key={layout} value={layout}>
                        {layout}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Linked lead</label>
                  <LeadPicker
                    leads={leads}
                    value={draft.lead_id}
                    onChange={(leadId) => setField('lead_id', leadId)}
                    disabled={!canEdit || saving}
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Notes</label>
                  <textarea
                    rows={3}
                    value={draft.notes}
                    onChange={(e) => setField('notes', e.target.value)}
                    className={textareaClass}
                  />
                </div>
              </div>

              {/* Spaces */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-900">Spaces & times</h3>
                  {canEdit && (
                    <Button variant="secondary" size="sm" onClick={addSpace}>
                      <Plus size={14} /> Add space
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {draft.spaces.length === 0 && (
                    <p className="text-sm text-slate-400 italic">
                      No spaces yet — add at least one.
                    </p>
                  )}
                  {draft.spaces.map((space, index) => (
                    <div
                      key={space.key}
                      className="border border-slate-200 rounded-lg p-3 grid grid-cols-12 gap-2 items-end bg-slate-50/50"
                    >
                      <div className="col-span-12 md:col-span-4">
                        <label className={labelClass}>Venue</label>
                        <select
                          value={space.venue_id}
                          onChange={(e) => updateSpace(space.key, { venue_id: e.target.value })}
                          className={selectClass}
                        >
                          <option value="">-- Select venue --</option>
                          {venues.map((venue) => (
                            <option key={venue.id} value={venue.id}>
                              {venue.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-6 md:col-span-3">
                        <label className={labelClass}>Start</label>
                        <input
                          type="datetime-local"
                          value={space.start_local}
                          onChange={(e) => updateSpace(space.key, { start_local: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                      <div className="col-span-6 md:col-span-3">
                        <label className={labelClass}>End</label>
                        <input
                          type="datetime-local"
                          value={space.end_local}
                          onChange={(e) => updateSpace(space.key, { end_local: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                      <div className="col-span-5 md:col-span-1">
                        <label className={labelClass} title="Setup minutes">
                          Setup
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={space.setup_minutes}
                          onChange={(e) =>
                            updateSpace(space.key, { setup_minutes: e.target.value })
                          }
                          className={inputClass}
                          title={`Space ${index + 1} setup minutes`}
                        />
                      </div>
                      <div className="col-span-5 md:col-span-1">
                        <label className={labelClass} title="Teardown minutes">
                          Down
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={space.teardown_minutes}
                          onChange={(e) =>
                            updateSpace(space.key, { teardown_minutes: e.target.value })
                          }
                          className={inputClass}
                        />
                      </div>
                      <div className="col-span-2 md:col-span-12 md:justify-self-end">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => removeSpace(space.key)}
                            className="text-slate-400 hover:text-rose-600 p-2"
                            title="Remove space"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Venue suggestions (deterministic capacity + free/busy fit) */}
                {canEdit && (
                  <div className="mt-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleSuggestVenues(venues)}
                      disabled={suggesting}
                    >
                      {suggesting ? (
                        <>
                          <Loader2 size={14} className="animate-spin" /> Ranking…
                        </>
                      ) : (
                        <>
                          <Wand2 size={14} /> Suggest venues
                        </>
                      )}
                    </Button>
                    {suggestions && (
                      <div className="mt-2 border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
                        {suggestions.slice(0, 5).map((s) => (
                          <div key={s.venue.id} className="flex items-center gap-2 px-3 py-2">
                            <div className="flex-1 min-w-0">
                              <span
                                className={`text-sm font-semibold ${
                                  s.fits ? 'text-slate-900' : 'text-slate-400'
                                }`}
                              >
                                {s.venue.name}
                              </span>
                              <span className="text-xs text-slate-500 ml-2">
                                {s.capacity !== null
                                  ? `${draft.layout || 'max'} ${s.capacity} pax`
                                  : 'no capacity data'}
                                {!s.fits && ' · too small'}
                              </span>
                            </div>
                            {s.free !== null && (
                              <Badge tone={s.free ? 'emerald' : 'amber'} className="shrink-0">
                                {s.free ? 'Free' : `Busy (${s.conflicts})`}
                              </Badge>
                            )}
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => applySuggestion(s.venue.id)}
                            >
                              Use
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Conflict check */}
                {canEdit && draft.spaces.length > 0 && (
                  <div className="mt-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCheckConflicts}
                      disabled={checkingConflicts}
                    >
                      {checkingConflicts ? (
                        <>
                          <Loader2 size={14} className="animate-spin" /> Checking…
                        </>
                      ) : (
                        'Check conflicts'
                      )}
                    </Button>
                    {conflicts && (
                      <div className="mt-2 space-y-2">
                        {conflicts.every(
                          (report) =>
                            report.result.hard.length === 0 && report.result.soft.length === 0,
                        ) ? (
                          <div className="flex items-center gap-1.5 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                            <CheckCircle2 size={15} /> All spaces are free — no overlapping
                            bookings.
                          </div>
                        ) : (
                          conflicts.map((report) => (
                            <div key={report.label} className="space-y-1.5">
                              {report.result.hard.map((block) => (
                                <div
                                  key={`hard-${block.id}`}
                                  className="flex items-start gap-1.5 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2"
                                >
                                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                                  <span>
                                    {report.label}: confirmed booking <b>{block.code}</b> (
                                    {block.title}) occupies{' '}
                                    {formatTimeRange(block.block_start_at, block.block_end_at)} —
                                    saving as confirmed will be rejected.
                                  </span>
                                </div>
                              ))}
                              {report.result.soft.map((block) => (
                                <div
                                  key={`soft-${block.id}`}
                                  className="flex items-start gap-1.5 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
                                >
                                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                                  <span>
                                    {report.label}: tentative booking <b>{block.code}</b> (
                                    {block.title}) holds{' '}
                                    {formatTimeRange(block.block_start_at, block.block_end_at)} —
                                    overlap is allowed but coordinate before confirming.
                                  </span>
                                </div>
                              ))}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </fieldset>
          )}
        </div>

        {/* Footer (booking form actions — the Quotes tab saves itself) */}
        {activeTab === 'details' && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              {canEdit && isEditing && (
                <Button variant="danger" size="sm" onClick={handleDelete} disabled={saving}>
                  <Trash2 size={14} /> Delete
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
                {canEdit ? 'Cancel' : 'Close'}
              </Button>
              {canEdit && (
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Saving…
                    </>
                  ) : isEditing ? (
                    'Save changes'
                  ) : (
                    'Create booking'
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
