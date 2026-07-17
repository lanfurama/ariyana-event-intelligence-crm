import type { Request, Response } from 'express';
import express from 'express';
import { VenueModel } from '../models/VenueModel.js';
import { BookingModel } from '../models/BookingModel.js';
import { LeadModel } from '../models/LeadModel.js';
import { sendTestEmail } from '../utils/emailSender/index.js';
import { env } from '../config/env.js';

// Customer-facing surface — the ONLY router mounted above the auth guard.
// Everything here is sanitized: no rates, no booking identities, no lead data out.

const router = express.Router();

const MAX_WINDOW_DAYS = 62;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Naive in-memory rate limit for the request form (per process — resets on
// redeploy/serverless recycle; first abuse layer only).
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const requestLog = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entries = (requestLog.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (entries.length >= RATE_LIMIT_MAX) {
    requestLog.set(ip, entries);
    return true;
  }
  entries.push(now);
  requestLog.set(ip, entries);
  return false;
}

// GET /api/public/venues - active venues, commercial fields stripped
router.get('/venues', async (req: Request, res: Response) => {
  try {
    const venues = await VenueModel.getAll();
    res.json(
      venues.map((venue) => ({
        id: venue.id,
        name: venue.name,
        slug: venue.slug,
        floor: venue.floor,
        area_sqm: venue.area_sqm,
        ceiling_height_m: venue.ceiling_height_m,
        capacities: venue.capacities,
        description: venue.description,
        images: venue.images,
        amenities: venue.amenities,
      })),
    );
  } catch (error: any) {
    console.error('Error fetching public venues:', error);
    res.status(500).json({ error: 'Failed to fetch venues' });
  }
});

// GET /api/public/availability?from&to - anonymous free/busy blocks only
router.get('/availability', async (req: Request, res: Response) => {
  try {
    const from = typeof req.query.from === 'string' ? new Date(req.query.from) : null;
    const to = typeof req.query.to === 'string' ? new Date(req.query.to) : null;
    if (!from || isNaN(from.getTime()) || !to || isNaN(to.getTime()) || to <= from) {
      return res
        .status(400)
        .json({ error: 'from and to are required ISO dates with to after from' });
    }
    const windowDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    if (windowDays > MAX_WINDOW_DAYS) {
      return res.status(400).json({ error: `Window must be at most ${MAX_WINDOW_DAYS} days` });
    }

    const rows = await BookingModel.getSpacesInWindow(from, to);
    res.json(
      rows.map((row) => ({
        venue_id: row.venue_id,
        block_start_at: row.block_start_at,
        block_end_at: row.block_end_at,
      })),
    );
  } catch (error: any) {
    console.error('Error fetching public availability:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// POST /api/public/booking-request - customer inquiry -> Lead + inquiry Booking
router.post('/booking-request', async (req: Request, res: Response) => {
  try {
    // Honeypot: bots fill every field — accept silently and drop.
    if (typeof req.body?.website_hp === 'string' && req.body.website_hp.trim() !== '') {
      return res.status(201).json({ success: true });
    }

    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (rateLimited(ip)) {
      return res.status(429).json({ error: 'Too many requests — please try again later' });
    }

    const companyName =
      typeof req.body.company_name === 'string' ? req.body.company_name.trim() : '';
    const contactName =
      typeof req.body.contact_name === 'string' ? req.body.contact_name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
    if (!companyName || !contactName || !email) {
      return res.status(400).json({ error: 'company_name, contact_name and email are required' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'email is not valid' });
    }

    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    const country = typeof req.body.country === 'string' ? req.body.country.trim() : '';
    const eventType = typeof req.body.event_type === 'string' ? req.body.event_type.trim() : '';
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    const guests =
      Number.isInteger(req.body.expected_guests) && req.body.expected_guests >= 0
        ? req.body.expected_guests
        : undefined;
    const venueId = typeof req.body.venue_id === 'string' ? req.body.venue_id : '';
    const preferredDate =
      typeof req.body.preferred_date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(req.body.preferred_date)
        ? req.body.preferred_date
        : '';

    if (venueId) {
      const venue = await VenueModel.getById(venueId);
      if (!venue) {
        return res.status(400).json({ error: 'Unknown venue' });
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const noteLines = [
      `[Portal booking request ${today}]`,
      eventType ? `Event type: ${eventType}` : '',
      guests !== undefined ? `Expected guests: ${guests}` : '',
      preferredDate ? `Preferred date: ${preferredDate}` : '',
      phone ? `Phone: ${phone}` : '',
      message ? `Message: ${message}` : '',
    ].filter(Boolean);

    // Reuse an existing lead with the same contact email; otherwise create one.
    let lead = await LeadModel.getByKeyPersonEmail(email);
    if (!lead) {
      lead = await LeadModel.create({
        id: `lead-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        company_name: companyName,
        industry: 'Unknown',
        country: country || 'Unknown',
        city: '',
        key_person_name: contactName,
        key_person_email: email,
        key_person_phone: phone || undefined,
        total_events: 0,
        vietnam_events: 0,
        notes: noteLines.join('\n'),
        status: 'New',
      } as any);
    }

    const spaces =
      venueId && preferredDate
        ? [
            {
              venue_id: venueId,
              // Operations run in Asia/Ho_Chi_Minh — pin the offset explicitly.
              start_at: new Date(`${preferredDate}T08:00:00+07:00`),
              end_at: new Date(`${preferredDate}T17:00:00+07:00`),
              setup_minutes: 0,
              teardown_minutes: 0,
            },
          ]
        : [];

    const booking = await BookingModel.create(
      {
        id: `booking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        lead_id: lead.id,
        title: `Portal request — ${companyName}`,
        event_type: eventType || undefined,
        status: 'inquiry',
        expected_guests: guests,
        notes: noteLines.join('\n'),
        source: 'portal',
        created_by: 'portal',
      } as any,
      spaces,
    );

    // Fire-and-forget notification to the sales inbox — the request is already saved.
    const summaryHtml =
      `<p><b>New venue booking request</b> (${booking.code})</p>` +
      `<p>${companyName} — ${contactName} (${email})${phone ? `, ${phone}` : ''}</p>` +
      `<p>${noteLines.slice(1).join('<br/>') || 'No details provided.'}</p>` +
      `<p>Open Ariyana Mail → Bookings to follow up.</p>`;
    void sendTestEmail(
      env.DEFAULT_FROM_EMAIL,
      `New venue booking request — ${companyName} (${booking.code})`,
      summaryHtml,
    ).catch((e) => console.error('Portal notification email failed:', e));

    res.status(201).json({ success: true, reference: booking.code });
  } catch (error: any) {
    console.error('Error creating booking request:', error);
    res.status(500).json({ error: 'Failed to submit booking request' });
  }
});

export default router;
