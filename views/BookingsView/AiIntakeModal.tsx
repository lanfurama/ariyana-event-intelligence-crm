import { useState } from 'react';
import type React from 'react';
import { AlertTriangle, Loader2, Send, Sparkles, X } from 'lucide-react';
import type { Venue } from '../../types';
import { Button, inputClass, labelClass, selectClass, textareaClass } from '../../components/ui';
import { bookingsApi } from '../../services/apiService';
import { parseRfp } from '../../services/geminiService';
import { useEscapeKey } from '../../hooks/useEscapeKey';

// AI intake: paste an inbound RFP email -> Gemini extracts the fields ->
// Sales reviews/corrects -> Lead + inquiry Booking (source 'email_ai').

interface AiIntakeModalProps {
  venues: Venue[];
  onClose: () => void;
  onCreated: (bookingId: string) => void;
}

interface IntakeFormState {
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  event_type: string;
  expected_guests: string;
  venue_id: string;
  preferred_date: string;
  message: string;
}

const EMPTY_FORM: IntakeFormState = {
  company_name: '',
  contact_name: '',
  email: '',
  phone: '',
  event_type: '',
  expected_guests: '',
  venue_id: '',
  preferred_date: '',
  message: '',
};

export const AiIntakeModal: React.FC<AiIntakeModalProps> = ({ venues, onClose, onCreated }) => {
  const [step, setStep] = useState<'paste' | 'review'>('paste');
  const [text, setText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [notRfp, setNotRfp] = useState(false);
  const [form, setForm] = useState<IntakeFormState>({ ...EMPTY_FORM });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(true, onClose);

  const setField = (field: keyof IntakeFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAnalyze = async () => {
    if (text.trim() === '' || analyzing) return;
    setAnalyzing(true);
    setError(null);
    try {
      const extraction = await parseRfp(text);
      setNotRfp(!extraction.is_rfp);
      setForm({
        company_name: extraction.company_name || '',
        contact_name: extraction.contact_name || '',
        email: extraction.email || '',
        phone: extraction.phone || '',
        event_type: extraction.event_type || '',
        expected_guests:
          extraction.expected_guests !== undefined ? String(extraction.expected_guests) : '',
        venue_id: '',
        preferred_date: extraction.preferred_date || '',
        message: extraction.summary || '',
      });
      setStep('review');
    } catch (e: any) {
      console.error('Error analyzing RFP:', e);
      setError(e.message || 'AI analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreate = async () => {
    setError(null);
    if (!form.company_name.trim() || !form.contact_name.trim() || !form.email.trim()) {
      setError('Company, contact name and email are required.');
      return;
    }
    setCreating(true);
    try {
      const guests = Number(form.expected_guests);
      const result = await bookingsApi.intake({
        company_name: form.company_name.trim(),
        contact_name: form.contact_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        event_type: form.event_type.trim() || undefined,
        message: form.message.trim() || undefined,
        expected_guests: Number.isInteger(guests) && guests > 0 ? guests : undefined,
        venue_id: form.venue_id || undefined,
        preferred_date: form.preferred_date || undefined,
      });
      onCreated(result.booking.id);
    } catch (e: any) {
      console.error('Error creating intake booking:', e);
      setError(e.message || 'Failed to create the inquiry');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-brand-600" />
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">AI Intake</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 p-1.5 rounded-lg hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-3 py-2 mb-4">
              {error}
            </div>
          )}

          {step === 'paste' ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">
                Paste an inbound inquiry email (or any request text). Gemini extracts the company,
                contact, dates and headcount — you review before anything is saved.
              </p>
              <textarea
                rows={12}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the email text here…"
                className={textareaClass}
                autoFocus
              />
              <div className="flex justify-end">
                <Button onClick={handleAnalyze} disabled={analyzing || text.trim() === ''}>
                  {analyzing ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Analyzing…
                    </>
                  ) : (
                    <>
                      <Sparkles size={15} /> Analyze with AI
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {notRfp && (
                <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-3 py-2">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <span>
                    The AI does not think this is a venue inquiry — review carefully (you can still
                    create it).
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Company *</label>
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
                    type="text"
                    value={form.phone}
                    onChange={(e) => setField('phone', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Event type</label>
                  <input
                    type="text"
                    value={form.event_type}
                    onChange={(e) => setField('event_type', e.target.value)}
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
                  <label className={labelClass}>Venue (optional)</label>
                  <select
                    value={form.venue_id}
                    onChange={(e) => setField('venue_id', e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Not decided</option>
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
                <div className="col-span-2">
                  <label className={labelClass}>Summary / notes</label>
                  <textarea
                    rows={3}
                    value={form.message}
                    onChange={(e) => setField('message', e.target.value)}
                    className={textareaClass}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center">
                <Button variant="ghost" size="sm" onClick={() => setStep('paste')}>
                  ← Back to text
                </Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Creating…
                    </>
                  ) : (
                    <>
                      <Send size={15} /> Create inquiry
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
