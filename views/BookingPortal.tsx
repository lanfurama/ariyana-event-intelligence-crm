import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { Building2, CalendarDays, CheckCircle2, Loader2, MapPin, Search, Send } from 'lucide-react';
import type { VenueCapacities } from '../types';

// Standalone customer page (book.html) — no auth, no sidebar. Talks only to
// the sanitized /api/v1/public endpoints. English-only MVP (VN toggle later).

interface PublicVenue {
  id: string;
  name: string;
  slug: string;
  floor?: string;
  area_sqm?: number;
  ceiling_height_m?: number;
  capacities: VenueCapacities;
  description?: string;
  images: string[];
  amenities: string[];
}

interface BusyBlock {
  venue_id: string;
  block_start_at: string;
  block_end_at: string;
}

const API = '/api/v1/public';

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || `HTTP ${response.status}`);
  }
  return data as T;
}

const CAPACITY_LABELS: Array<[keyof VenueCapacities, string]> = [
  ['theatre', 'Theatre'],
  ['classroom', 'Classroom'],
  ['banquet', 'Banquet'],
  ['cocktail', 'Cocktail'],
  ['ushape', 'U-shape'],
  ['boardroom', 'Boardroom'],
];

const toDateInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const fmtRange = (start: string, end: string) => {
  const s = new Date(start);
  const e = new Date(end);
  const day = s.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  const time = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time(s)} – ${time(e)}`;
};

const inputClass =
  'w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg placeholder:text-slate-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500';
const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5';

const EMPTY_FORM = {
  company_name: '',
  contact_name: '',
  email: '',
  phone: '',
  country: '',
  event_type: '',
  expected_guests: '',
  venue_id: '',
  preferred_date: '',
  message: '',
  website_hp: '',
};

export const BookingPortal = () => {
  const [venues, setVenues] = useState<PublicVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [availFrom, setAvailFrom] = useState(() => toDateInput(new Date()));
  const [availTo, setAvailTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return toDateInput(d);
  });
  const [busy, setBusy] = useState<BusyBlock[] | null>(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  useEffect(() => {
    getJson<PublicVenue[]>(`${API}/venues`)
      .then(setVenues)
      .catch((e: any) => setLoadError(e.message || 'Failed to load venues'))
      .finally(() => setLoading(false));
  }, []);

  const busyByVenue = useMemo(() => {
    if (!busy) return {};
    const map: Record<string, BusyBlock[]> = {};
    busy.forEach((block) => {
      (map[block.venue_id] = map[block.venue_id] || []).push(block);
    });
    return map;
  }, [busy]);

  const setField = (field: keyof typeof EMPTY_FORM, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const checkAvailability = async () => {
    setAvailLoading(true);
    setAvailError(null);
    setBusy(null);
    try {
      const from = encodeURIComponent(`${availFrom}T00:00:00+07:00`);
      const to = encodeURIComponent(`${availTo}T23:59:00+07:00`);
      setBusy(await getJson<BusyBlock[]>(`${API}/availability?from=${from}&to=${to}`));
    } catch (e: any) {
      setAvailError(e.message || 'Failed to check availability');
    } finally {
      setAvailLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!form.company_name.trim() || !form.contact_name.trim() || !form.email.trim()) {
      setSubmitError('Please fill in your company, contact name and email.');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        company_name: form.company_name.trim(),
        contact_name: form.contact_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        country: form.country.trim() || undefined,
        event_type: form.event_type.trim() || undefined,
        message: form.message.trim() || undefined,
        venue_id: form.venue_id || undefined,
        preferred_date: form.preferred_date || undefined,
        website_hp: form.website_hp,
      };
      if (form.expected_guests.trim() !== '') {
        payload.expected_guests = Number(form.expected_guests);
      }
      const response = await fetch(`${API}/booking-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || `HTTP ${response.status}`);
      }
      setReference((data as { reference?: string }).reference || null);
    } catch (e: any) {
      setSubmitError(e.message || 'Failed to submit your request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <header className="bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-4 py-12 md:py-16">
          <div className="flex items-center gap-2 text-brand-400 text-sm font-semibold uppercase tracking-widest mb-3">
            <Building2 size={16} /> Ariyana Convention Centre Danang
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            Host your next event by the beach
          </h1>
          <p className="text-slate-300 max-w-2xl">
            Vietnam&apos;s premier convention venue — home of APEC 2017. Browse our spaces, check
            availability and send a booking request; our sales team will get back to you within one
            business day.
          </p>
          <div className="flex items-center gap-1.5 text-slate-400 text-sm mt-4">
            <MapPin size={14} /> 105 Vo Nguyen Giap St., Danang City, Vietnam
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-12">
        {/* Venues */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Our spaces</h2>
          {loading ? (
            <div className="text-center py-10 text-slate-400">
              <Loader2 className="animate-spin mx-auto mb-2" size={22} /> Loading venues…
            </div>
          ) : loadError ? (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-4 py-3">
              {loadError}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {venues.map((venue) => (
                <div
                  key={venue.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-base font-bold text-slate-900">{venue.name}</h3>
                    <span className="text-xs text-slate-400 shrink-0">
                      {venue.floor}
                      {venue.floor && venue.area_sqm ? ' · ' : ''}
                      {venue.area_sqm ? `${venue.area_sqm} m²` : ''}
                    </span>
                  </div>
                  {venue.description && (
                    <p className="text-sm text-slate-500 mt-1.5">{venue.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {CAPACITY_LABELS.filter(([key]) => venue.capacities[key]).map(
                      ([key, label]) => (
                        <span
                          key={key}
                          className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-brand-50 text-brand-700 border border-brand-200"
                        >
                          {label} {venue.capacities[key]}
                        </span>
                      ),
                    )}
                  </div>
                  {venue.amenities.length > 0 && (
                    <p className="text-xs text-slate-400 mt-3">{venue.amenities.join(' · ')}</p>
                  )}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <a
                      href="#request"
                      onClick={() => setField('venue_id', venue.id)}
                      className="text-sm font-semibold text-brand-700 hover:text-brand-800"
                    >
                      Request this venue →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Availability */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Check availability</h2>
          <p className="text-sm text-slate-500 mb-4">
            See when our spaces are already reserved (up to 62 days at a time).
          </p>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className={labelClass}>From</label>
                <input
                  type="date"
                  value={availFrom}
                  onChange={(e) => setAvailFrom(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>To</label>
                <input
                  type="date"
                  value={availTo}
                  onChange={(e) => setAvailTo(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button
                type="button"
                onClick={checkAvailability}
                disabled={availLoading}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 disabled:opacity-50"
              >
                {availLoading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Search size={15} />
                )}
                Check
              </button>
            </div>

            {availError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-4 py-3 mt-4">
                {availError}
              </div>
            )}

            {busy && !availError && (
              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                {venues.map((venue) => {
                  const blocks = busyByVenue[venue.id] || [];
                  return (
                    <div key={venue.id} className="border border-slate-100 rounded-lg p-3">
                      <div className="text-sm font-semibold text-slate-900">{venue.name}</div>
                      {blocks.length === 0 ? (
                        <div className="text-xs text-emerald-700 mt-1 flex items-center gap-1">
                          <CheckCircle2 size={13} /> Fully available in this window
                        </div>
                      ) : (
                        <ul className="text-xs text-slate-500 mt-1 space-y-0.5">
                          {blocks.map((block, index) => (
                            <li key={index}>
                              Reserved: {fmtRange(block.block_start_at, block.block_end_at)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Request form */}
        <section id="request">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Request a booking</h2>
          <p className="text-sm text-slate-500 mb-4">
            No account needed — tell us about your event and we&apos;ll take it from there.
          </p>

          {reference !== null ? (
            <div className="bg-white border border-emerald-200 rounded-xl p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Request received!</h3>
              {reference && (
                <p className="text-sm text-slate-600 mt-2">
                  Your reference: <span className="font-mono font-bold">{reference}</span>
                </p>
              )}
              <p className="text-sm text-slate-500 mt-2">
                Our sales team will contact you within one business day.
              </p>
              <button
                type="button"
                onClick={() => {
                  setForm({ ...EMPTY_FORM });
                  setReference(null);
                }}
                className="mt-5 text-sm font-semibold text-brand-700 hover:text-brand-800"
              >
                Send another request
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="bg-white border border-slate-200 rounded-xl p-5 md:p-6"
            >
              {submitError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-4 py-3 mb-4">
                  {submitError}
                </div>
              )}

              {/* Honeypot — humans never see or fill this field */}
              <input
                type="text"
                value={form.website_hp}
                onChange={(e) => setField('website_hp', e.target.value)}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Company / Organization *</label>
                  <input
                    type="text"
                    value={form.company_name}
                    onChange={(e) => setField('company_name', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Contact name *</label>
                  <input
                    type="text"
                    value={form.contact_name}
                    onChange={(e) => setField('contact_name', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setField('email', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setField('phone', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Country</label>
                  <input
                    type="text"
                    value={form.country}
                    onChange={(e) => setField('country', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Event type</label>
                  <input
                    type="text"
                    value={form.event_type}
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
                    value={form.expected_guests}
                    onChange={(e) => setField('expected_guests', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Preferred venue</label>
                  <select
                    value={form.venue_id}
                    onChange={(e) => setField('venue_id', e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Not sure yet</option>
                    {venues.map((venue) => (
                      <option key={venue.id} value={venue.id}>
                        {venue.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Preferred date</label>
                  <input
                    type="date"
                    value={form.preferred_date}
                    onChange={(e) => setField('preferred_date', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Tell us about your event</label>
                  <textarea
                    rows={4}
                    value={form.message}
                    onChange={(e) => setField('message', e.target.value)}
                    className={`${inputClass} resize-y`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-5 w-full md:w-auto px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg inline-flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    <Send size={16} /> Send booking request
                  </>
                )}
              </button>
            </form>
          )}
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-6 text-sm text-slate-500 flex flex-wrap items-center gap-2 justify-between">
          <span className="flex items-center gap-1.5">
            <CalendarDays size={14} /> Ariyana Convention Centre Danang — venue booking
          </span>
          <span>www.ariyanacentre.com</span>
        </div>
      </footer>
    </div>
  );
};
