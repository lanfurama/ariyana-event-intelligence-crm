import type { Request, Response } from 'express';
import express from 'express';
import type { QuoteItemInput } from '../models/QuoteModel.js';
import { QuoteModel } from '../models/QuoteModel.js';
import { BookingModel } from '../models/BookingModel.js';
import { VenueModel } from '../models/VenueModel.js';
import { LeadModel } from '../models/LeadModel.js';
import { buildProposalDocx } from '../utils/proposalDocx.js';

const router = express.Router();

const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired'];
const ITEM_KINDS = ['venue', 'fnb', 'av', 'service', 'other'];

function validateItemsPayload(input: unknown): {
  ok: boolean;
  errors: string[];
  items: QuoteItemInput[];
} {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, errors: ['items must be a non-empty array'], items: [] };
  }
  const errors: string[] = [];
  const items: QuoteItemInput[] = [];
  input.forEach((raw, index) => {
    const label = `items[${index}]`;
    if (typeof raw !== 'object' || raw === null) {
      errors.push(`${label} must be an object`);
      return;
    }
    const record = raw as Record<string, unknown>;
    const description = typeof record.description === 'string' ? record.description.trim() : '';
    if (description === '') errors.push(`${label}.description is required`);
    const kind =
      typeof record.kind === 'string' && ITEM_KINDS.includes(record.kind) ? record.kind : null;
    if (!kind) errors.push(`${label}.kind must be one of ${ITEM_KINDS.join(', ')}`);
    const quantity =
      typeof record.quantity === 'number' && isFinite(record.quantity) && record.quantity > 0
        ? record.quantity
        : null;
    if (quantity === null) errors.push(`${label}.quantity must be a positive number`);
    const unitPrice =
      typeof record.unit_price === 'number' && isFinite(record.unit_price) && record.unit_price >= 0
        ? record.unit_price
        : null;
    if (unitPrice === null) errors.push(`${label}.unit_price must be a non-negative number`);
    if (description !== '' && kind && quantity !== null && unitPrice !== null) {
      items.push({ kind, description, quantity, unit_price: unitPrice, sort_order: index });
    }
  });
  return { ok: errors.length === 0, errors, items };
}

function parsePct(value: unknown, label: string, errors: string[]): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !isFinite(value) || value < 0 || value > 100) {
    errors.push(`${label} must be a number between 0 and 100`);
    return undefined;
  }
  return value;
}

// GET /api/quotes - list quotes with items (optionally for one booking)
router.get('/', async (req: Request, res: Response) => {
  try {
    const bookingId = typeof req.query.booking_id === 'string' ? req.query.booking_id : undefined;
    const quotes = await QuoteModel.getAll(bookingId);
    res.json(quotes);
  } catch (error: any) {
    console.error('Error fetching quotes:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch quotes' });
  }
});

// GET /api/quotes/:id/docx - proposal Word document for a quote
router.get('/:id/docx', async (req: Request, res: Response) => {
  try {
    const quote = await QuoteModel.getById(req.params.id);
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    const booking = await BookingModel.getById(quote.booking_id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found for this quote' });
    }
    const venues = await VenueModel.getAll(true);
    const venueNameById: Record<string, string> = {};
    venues.forEach((venue) => {
      venueNameById[venue.id] = venue.name;
    });
    const lead = booking.lead_id ? await LeadModel.getById(booking.lead_id) : null;

    const buffer = await buildProposalDocx(quote, booking, venueNameById, lead);

    const fileName = `Proposal-${booking.code}-v${quote.version}.docx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    res.setHeader('Content-Length', buffer.length.toString());
    res.send(buffer);
  } catch (error: any) {
    console.error('Error exporting proposal:', error);
    res.status(500).json({ error: error.message || 'Failed to export proposal' });
  }
});

// GET /api/quotes/:id - one quote with items
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const quote = await QuoteModel.getById(req.params.id);
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    res.json(quote);
  } catch (error: any) {
    console.error('Error fetching quote:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch quote' });
  }
});

// POST /api/quotes - create a quote (totals computed server-side, version per booking)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { booking_id, status } = req.body;
    if (!booking_id || typeof booking_id !== 'string') {
      return res.status(400).json({ error: 'booking_id is required' });
    }
    const booking = await BookingModel.getById(booking_id);
    if (!booking) {
      return res.status(400).json({ error: 'Unknown booking_id' });
    }
    if (status !== undefined && !QUOTE_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${QUOTE_STATUSES.join(', ')}` });
    }

    const errors: string[] = [];
    const discountPct = parsePct(req.body.discount_pct, 'discount_pct', errors);
    const vatPct = parsePct(req.body.vat_pct, 'vat_pct', errors);
    const validation = validateItemsPayload(req.body.items);
    errors.push(...validation.errors);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Invalid quote payload', details: errors });
    }

    const quote = await QuoteModel.create(
      booking_id,
      {
        discount_pct: discountPct,
        vat_pct: vatPct,
        status,
        valid_until: req.body.valid_until ?? null,
        notes: req.body.notes ?? null,
      },
      validation.items,
    );

    res.status(201).json(quote);
  } catch (error: any) {
    console.error('Error creating quote:', error);
    res.status(500).json({ error: error.message || 'Failed to create quote' });
  }
});

// PUT /api/quotes/:id - update fields and/or replace items (totals recomputed)
router.put('/:id', async (req: Request, res: Response) => {
  try {
    if (req.body.status !== undefined && !QUOTE_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ error: `status must be one of ${QUOTE_STATUSES.join(', ')}` });
    }

    const errors: string[] = [];
    const discountPct = parsePct(req.body.discount_pct, 'discount_pct', errors);
    const vatPct = parsePct(req.body.vat_pct, 'vat_pct', errors);

    let items: QuoteItemInput[] | undefined;
    if (req.body.items !== undefined) {
      const validation = validateItemsPayload(req.body.items);
      errors.push(...validation.errors);
      items = validation.items;
    }
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Invalid quote payload', details: errors });
    }

    const updated = await QuoteModel.update(
      req.params.id,
      {
        discount_pct: discountPct,
        vat_pct: vatPct,
        status: req.body.status,
        valid_until: req.body.valid_until,
        notes: req.body.notes,
        sent_at: req.body.sent_at,
      },
      items,
    );
    if (!updated) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    res.json(updated);
  } catch (error: any) {
    console.error('Error updating quote:', error);
    res.status(500).json({ error: error.message || 'Failed to update quote' });
  }
});

// DELETE /api/quotes/:id - delete a quote (items cascade)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await QuoteModel.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting quote:', error);
    res.status(500).json({ error: error.message || 'Failed to delete quote' });
  }
});

export default router;
