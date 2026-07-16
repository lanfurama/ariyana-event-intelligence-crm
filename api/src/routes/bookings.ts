import type { Request, Response } from 'express';
import express from 'express';
import type { BookingFilters } from '../models/BookingModel.js';
import { BookingModel } from '../models/BookingModel.js';
import type { Booking } from '../types/index.js';
import type { BookingSpaceInput, SpaceConflicts, SpaceWindowRow } from '../utils/bookingHelpers.js';
import {
  computeBlockRange,
  findSpaceConflicts,
  validateBookingSpacesPayload,
} from '../utils/bookingHelpers.js';

const router = express.Router();

const BOOKING_STATUSES = ['inquiry', 'hold', 'quoted', 'confirmed', 'completed', 'cancelled'];
const BOOKING_SOURCES = ['manual', 'portal', 'email_ai'];

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

interface SpaceWarning {
  venue_id: string;
  block_start_at: Date;
  block_end_at: Date;
  hard: SpaceWindowRow[];
  soft: SpaceWindowRow[];
}

// Overlap report for a set of requested spaces (used as non-blocking warnings on create).
async function collectConflictWarnings(
  spaces: BookingSpaceInput[],
  excludeBookingId?: string,
): Promise<SpaceWarning[]> {
  const warnings: SpaceWarning[] = [];
  for (const space of spaces) {
    const { blockStartAt, blockEndAt } = computeBlockRange(
      space.start_at,
      space.end_at,
      space.setup_minutes,
      space.teardown_minutes,
    );
    const rows = await BookingModel.getSpacesInWindow(blockStartAt, blockEndAt, space.venue_id);
    const conflicts: SpaceConflicts<SpaceWindowRow> = findSpaceConflicts(
      { venueId: space.venue_id, blockStartAt, blockEndAt, excludeBookingId },
      rows,
    );
    if (conflicts.hard.length > 0 || conflicts.soft.length > 0) {
      warnings.push({
        venue_id: space.venue_id,
        block_start_at: blockStartAt,
        block_end_at: blockEndAt,
        hard: conflicts.hard,
        soft: conflicts.soft,
      });
    }
  }
  return warnings;
}

// GET /api/bookings - list bookings with their spaces
router.get('/', async (req: Request, res: Response) => {
  try {
    const filters: BookingFilters = {};
    if (typeof req.query.status === 'string') {
      if (!BOOKING_STATUSES.includes(req.query.status)) {
        return res.status(400).json({ error: `status must be one of ${BOOKING_STATUSES.join(', ')}` });
      }
      filters.status = req.query.status;
    }
    if (typeof req.query.venue_id === 'string') filters.venue_id = req.query.venue_id;
    if (typeof req.query.lead_id === 'string') filters.lead_id = req.query.lead_id;
    if (typeof req.query.from === 'string') filters.from = req.query.from;
    if (typeof req.query.to === 'string') filters.to = req.query.to;
    if (typeof req.query.search === 'string') filters.search = req.query.search;

    const bookings = await BookingModel.getAll(filters);
    res.json(bookings);
  } catch (error: any) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch bookings' });
  }
});

// GET /api/bookings/availability - space blocks of hold/quoted/confirmed bookings in a window
router.get('/availability', async (req: Request, res: Response) => {
  try {
    const from = parseIsoDate(req.query.from);
    const to = parseIsoDate(req.query.to);
    if (!from || !to || to.getTime() <= from.getTime()) {
      return res
        .status(400)
        .json({ error: 'from and to are required ISO dates with to after from' });
    }
    const venueId = typeof req.query.venue_id === 'string' ? req.query.venue_id : undefined;

    const spaces = await BookingModel.getSpacesInWindow(from, to, venueId);
    res.json(spaces);
  } catch (error: any) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch availability' });
  }
});

// GET /api/bookings/check-conflicts - classify a candidate window against existing bookings
router.get('/check-conflicts', async (req: Request, res: Response) => {
  try {
    const venueId = typeof req.query.venue_id === 'string' ? req.query.venue_id : '';
    if (venueId === '') {
      return res.status(400).json({ error: 'venue_id is required' });
    }
    const startAt = parseIsoDate(req.query.start_at);
    const endAt = parseIsoDate(req.query.end_at);
    if (!startAt || !endAt || endAt.getTime() <= startAt.getTime()) {
      return res
        .status(400)
        .json({ error: 'start_at and end_at are required ISO dates with end_at after start_at' });
    }

    const setupMinutes = req.query.setup_minutes ? parseInt(req.query.setup_minutes as string) : 0;
    const teardownMinutes = req.query.teardown_minutes
      ? parseInt(req.query.teardown_minutes as string)
      : 0;
    if (
      isNaN(setupMinutes) ||
      setupMinutes < 0 ||
      isNaN(teardownMinutes) ||
      teardownMinutes < 0
    ) {
      return res
        .status(400)
        .json({ error: 'setup_minutes and teardown_minutes must be non-negative integers' });
    }

    const excludeBookingId =
      typeof req.query.exclude_booking_id === 'string' ? req.query.exclude_booking_id : undefined;

    const { blockStartAt, blockEndAt } = computeBlockRange(
      startAt,
      endAt,
      setupMinutes,
      teardownMinutes,
    );
    const rows = await BookingModel.getSpacesInWindow(blockStartAt, blockEndAt, venueId);
    const conflicts = findSpaceConflicts(
      { venueId, blockStartAt, blockEndAt, excludeBookingId },
      rows,
    );
    res.json(conflicts);
  } catch (error: any) {
    console.error('Error checking conflicts:', error);
    res.status(500).json({ error: error.message || 'Failed to check conflicts' });
  }
});

// GET /api/bookings/:id - one booking with its spaces
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const booking = await BookingModel.getById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json(booking);
  } catch (error: any) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch booking' });
  }
});

// POST /api/bookings - create a booking with its spaces.
// Soft conflicts (hold/quoted overlaps, or overlapping an existing confirmed booking
// while this one is still tentative) come back as `warnings`; a confirmed-vs-confirmed
// overlap is rejected by the DB exclusion constraint -> 409.
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, status, source, expected_guests } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ error: 'title is required' });
    }
    if (status !== undefined && !BOOKING_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${BOOKING_STATUSES.join(', ')}` });
    }
    if (source !== undefined && !BOOKING_SOURCES.includes(source)) {
      return res.status(400).json({ error: `source must be one of ${BOOKING_SOURCES.join(', ')}` });
    }
    if (
      expected_guests !== undefined &&
      expected_guests !== null &&
      (!Number.isInteger(expected_guests) || expected_guests < 0)
    ) {
      return res.status(400).json({ error: 'expected_guests must be a non-negative integer' });
    }

    const validation = validateBookingSpacesPayload(req.body.spaces);
    if (!validation.ok) {
      return res.status(400).json({ error: 'Invalid spaces payload', details: validation.errors });
    }

    const warnings = await collectConflictWarnings(validation.spaces);

    const booking = await BookingModel.create(
      {
        id: `booking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        lead_id: req.body.lead_id,
        title: title.trim(),
        event_type: req.body.event_type,
        status: status || 'inquiry',
        expected_guests: expected_guests ?? undefined,
        layout: req.body.layout,
        notes: req.body.notes,
        source: source || 'manual',
        created_by: req.body.created_by,
      },
      validation.spaces,
    );

    res.status(201).json({ booking, warnings });
  } catch (error: any) {
    if (error.code === '23P01') {
      return res.status(409).json({
        error: 'Confirmed booking overlaps an existing confirmed booking on the same venue',
        detail: error.detail,
      });
    }
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Unknown venue_id or lead_id', detail: error.detail });
    }
    console.error('Error creating booking:', error);
    res.status(500).json({ error: error.message || 'Failed to create booking' });
  }
});

// PUT /api/bookings/:id - update fields and/or replace spaces.
// A status change syncs booking_spaces.booking_status in the same transaction,
// so hold -> confirmed is rejected with 409 when it would double-book.
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const existing = await BookingModel.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const updates: Partial<Booking> = {};

    if (req.body.title !== undefined) {
      if (typeof req.body.title !== 'string' || req.body.title.trim() === '') {
        return res.status(400).json({ error: 'title must be a non-empty string' });
      }
      updates.title = req.body.title.trim();
    }
    if (req.body.status !== undefined) {
      if (!BOOKING_STATUSES.includes(req.body.status)) {
        return res.status(400).json({ error: `status must be one of ${BOOKING_STATUSES.join(', ')}` });
      }
      updates.status = req.body.status;
    }
    if (req.body.source !== undefined) {
      if (!BOOKING_SOURCES.includes(req.body.source)) {
        return res.status(400).json({ error: `source must be one of ${BOOKING_SOURCES.join(', ')}` });
      }
      updates.source = req.body.source;
    }
    if (req.body.expected_guests !== undefined) {
      if (
        req.body.expected_guests !== null &&
        (!Number.isInteger(req.body.expected_guests) || req.body.expected_guests < 0)
      ) {
        return res.status(400).json({ error: 'expected_guests must be a non-negative integer' });
      }
      updates.expected_guests = req.body.expected_guests;
    }
    if (req.body.lead_id !== undefined) updates.lead_id = req.body.lead_id;
    if (req.body.event_type !== undefined) updates.event_type = req.body.event_type;
    if (req.body.layout !== undefined) updates.layout = req.body.layout;
    if (req.body.notes !== undefined) updates.notes = req.body.notes;
    if (req.body.created_by !== undefined) updates.created_by = req.body.created_by;

    let spaces: BookingSpaceInput[] | undefined;
    if (req.body.spaces !== undefined) {
      const validation = validateBookingSpacesPayload(req.body.spaces);
      if (!validation.ok) {
        return res.status(400).json({ error: 'Invalid spaces payload', details: validation.errors });
      }
      spaces = validation.spaces;
    }

    const updated = await BookingModel.update(req.params.id, updates, spaces);
    res.json(updated);
  } catch (error: any) {
    if (error.code === '23P01') {
      return res.status(409).json({
        error: 'Confirmed booking overlaps an existing confirmed booking on the same venue',
        detail: error.detail,
      });
    }
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Unknown venue_id or lead_id', detail: error.detail });
    }
    console.error('Error updating booking:', error);
    res.status(500).json({ error: error.message || 'Failed to update booking' });
  }
});

// DELETE /api/bookings/:id - delete a booking (spaces and quotes cascade)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await BookingModel.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting booking:', error);
    res.status(500).json({ error: error.message || 'Failed to delete booking' });
  }
});

export default router;
