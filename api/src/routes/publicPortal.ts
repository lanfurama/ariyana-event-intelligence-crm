import type { Request, Response } from 'express';
import express from 'express';
import { VenueModel } from '../models/VenueModel.js';
import { BookingModel } from '../models/BookingModel.js';
import { BookingRequestError, submitBookingRequest } from '../services/bookingRequestService.js';

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

    const result = await submitBookingRequest({
      company_name: companyName,
      contact_name: contactName,
      email,
      phone: phone || undefined,
      country: country || undefined,
      event_type: eventType || undefined,
      message: message || undefined,
      expected_guests: guests,
      venue_id: venueId || undefined,
      preferred_date: preferredDate || undefined,
      source: 'portal',
      created_by: 'portal',
    });

    res.status(201).json({ success: true, reference: result.booking.code });
  } catch (error: any) {
    if (error instanceof BookingRequestError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Error creating booking request:', error);
    res.status(500).json({ error: 'Failed to submit booking request' });
  }
});

export default router;
