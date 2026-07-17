import { BookingModel } from '../models/BookingModel.js';
import { LeadModel } from '../models/LeadModel.js';
import { VenueModel } from '../models/VenueModel.js';
import { sendTestEmail } from '../utils/emailSender/index.js';
import { env } from '../config/env.js';
import type { BookingWithSpaces, Lead } from '../types/index.js';

// Shared "inbound booking request -> Lead + inquiry Booking" pipeline, used by
// the public portal form and the authed AI-intake flow.

export interface BookingRequestInput {
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  country?: string;
  event_type?: string;
  message?: string;
  expected_guests?: number;
  venue_id?: string;
  /** YYYY-MM-DD */
  preferred_date?: string;
  source: 'portal' | 'email_ai';
  created_by: string;
  /** Send the sales-inbox notification email (default true). */
  notify?: boolean;
}

export interface BookingRequestResult {
  booking: BookingWithSpaces;
  lead: Lead;
}

export class BookingRequestError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function submitBookingRequest(
  input: BookingRequestInput,
): Promise<BookingRequestResult> {
  if (input.venue_id) {
    const venue = await VenueModel.getById(input.venue_id);
    if (!venue) {
      throw new BookingRequestError('Unknown venue');
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const requestLabel = input.source === 'portal' ? 'Portal booking request' : 'AI intake request';
  const noteLines = [
    `[${requestLabel} ${today}]`,
    input.event_type ? `Event type: ${input.event_type}` : '',
    input.expected_guests !== undefined ? `Expected guests: ${input.expected_guests}` : '',
    input.preferred_date ? `Preferred date: ${input.preferred_date}` : '',
    input.phone ? `Phone: ${input.phone}` : '',
    input.message ? `Message: ${input.message}` : '',
  ].filter(Boolean);

  // Reuse an existing lead with the same contact email; otherwise create one.
  let lead = await LeadModel.getByKeyPersonEmail(input.email);
  if (!lead) {
    lead = await LeadModel.create({
      id: `lead-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      company_name: input.company_name,
      industry: 'Unknown',
      country: input.country || 'Unknown',
      city: '',
      key_person_name: input.contact_name,
      key_person_email: input.email,
      key_person_phone: input.phone || undefined,
      total_events: 0,
      vietnam_events: 0,
      notes: noteLines.join('\n'),
      status: 'New',
    } as any);
  }

  const spaces =
    input.venue_id && input.preferred_date
      ? [
          {
            venue_id: input.venue_id,
            // Operations run in Asia/Ho_Chi_Minh — pin the offset explicitly.
            start_at: new Date(`${input.preferred_date}T08:00:00+07:00`),
            end_at: new Date(`${input.preferred_date}T17:00:00+07:00`),
            setup_minutes: 0,
            teardown_minutes: 0,
          },
        ]
      : [];

  const booking = await BookingModel.create(
    {
      id: `booking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      lead_id: lead.id,
      title: `${input.source === 'portal' ? 'Portal request' : 'AI intake'} — ${input.company_name}`,
      event_type: input.event_type || undefined,
      status: 'inquiry',
      expected_guests: input.expected_guests,
      notes: noteLines.join('\n'),
      source: input.source,
      created_by: input.created_by,
    } as any,
    spaces,
  );

  if (input.notify !== false) {
    // Fire-and-forget — the request is already saved.
    const summaryHtml =
      `<p><b>New venue booking request</b> (${booking.code})</p>` +
      `<p>${input.company_name} — ${input.contact_name} (${input.email})${input.phone ? `, ${input.phone}` : ''}</p>` +
      `<p>${noteLines.slice(1).join('<br/>') || 'No details provided.'}</p>` +
      `<p>Open Ariyana Mail → Bookings to follow up.</p>`;
    void sendTestEmail(
      env.DEFAULT_FROM_EMAIL,
      `New venue booking request — ${input.company_name} (${booking.code})`,
      summaryHtml,
    ).catch((e) => console.error('Booking request notification email failed:', e));
  }

  return { booking, lead };
}
