import type { PoolClient } from 'pg';
import { getClient, query } from '../config/database.js';
import type { Booking, BookingStatus, BookingWithSpaces } from '../types/index.js';
import type { BookingSpaceInput } from '../utils/bookingHelpers.js';
import { computeBlockRange, formatBookingCode } from '../utils/bookingHelpers.js';

export interface BookingFilters {
  status?: string;
  venue_id?: string;
  lead_id?: string;
  from?: string;
  to?: string;
  search?: string;
}

/** booking_spaces row joined with its booking code/title, as served by /availability. */
export interface SpaceWindowJoinRow {
  id: number;
  booking_id: string;
  venue_id: string;
  start_at: Date;
  end_at: Date;
  setup_minutes: number;
  teardown_minutes: number;
  block_start_at: Date;
  block_end_at: Date;
  booking_status: string;
  code: string;
  title: string;
}

const SPACES_AGG = `
  COALESCE(
    json_agg(
      json_build_object(
        'id', bs.id,
        'booking_id', bs.booking_id,
        'venue_id', bs.venue_id,
        'start_at', bs.start_at,
        'end_at', bs.end_at,
        'setup_minutes', bs.setup_minutes,
        'teardown_minutes', bs.teardown_minutes,
        'block_start_at', bs.block_start_at,
        'block_end_at', bs.block_end_at,
        'booking_status', bs.booking_status
      ) ORDER BY bs.start_at
    ) FILTER (WHERE bs.id IS NOT NULL),
    '[]'
  ) AS spaces`;

export class BookingModel {
  static async getAll(filters?: BookingFilters): Promise<BookingWithSpaces[]> {
    let sql = `
      SELECT b.*,${SPACES_AGG}
      FROM bookings b
      LEFT JOIN booking_spaces bs ON bs.booking_id = b.id
      WHERE 1=1`;
    const params: any[] = [];
    let paramCount = 1;

    if (filters?.status) {
      sql += ` AND b.status = $${paramCount++}`;
      params.push(filters.status);
    }
    if (filters?.lead_id) {
      sql += ` AND b.lead_id = $${paramCount++}`;
      params.push(filters.lead_id);
    }
    if (filters?.search) {
      sql += ` AND (
        b.title ILIKE $${paramCount} OR
        b.code ILIKE $${paramCount} OR
        b.notes ILIKE $${paramCount}
      )`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }
    if (filters?.venue_id) {
      sql += ` AND EXISTS (
        SELECT 1 FROM booking_spaces x WHERE x.booking_id = b.id AND x.venue_id = $${paramCount++}
      )`;
      params.push(filters.venue_id);
    }
    if (filters?.from) {
      sql += ` AND EXISTS (
        SELECT 1 FROM booking_spaces x WHERE x.booking_id = b.id AND x.block_end_at > $${paramCount++}
      )`;
      params.push(filters.from);
    }
    if (filters?.to) {
      sql += ` AND EXISTS (
        SELECT 1 FROM booking_spaces x WHERE x.booking_id = b.id AND x.block_start_at < $${paramCount++}
      )`;
      params.push(filters.to);
    }

    sql += ' GROUP BY b.id ORDER BY b.created_at DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async getById(id: string): Promise<BookingWithSpaces | null> {
    const result = await query(
      `SELECT b.*,${SPACES_AGG}
      FROM bookings b
      LEFT JOIN booking_spaces bs ON bs.booking_id = b.id
      WHERE b.id = $1
      GROUP BY b.id`,
      [id],
    );
    return result.rows[0] || null;
  }

  static async create(
    booking: Omit<Booking, 'code'>,
    spaces: BookingSpaceInput[],
  ): Promise<BookingWithSpaces> {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const seqResult = await client.query("SELECT nextval('booking_code_seq') AS seq");
      const code = formatBookingCode(new Date().getFullYear(), Number(seqResult.rows[0].seq));

      const bookingResult = await client.query(
        `INSERT INTO bookings (
          id, code, lead_id, title, event_type, status, expected_guests,
          layout, notes, source, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        ) RETURNING *`,
        [
          booking.id,
          code,
          booking.lead_id || null,
          booking.title,
          booking.event_type || null,
          booking.status || 'inquiry',
          booking.expected_guests ?? null,
          booking.layout || null,
          booking.notes || null,
          booking.source || 'manual',
          booking.created_by || null,
        ],
      );
      const created: Booking = bookingResult.rows[0];

      await this.insertSpaces(client, created.id, created.status, spaces);

      await client.query('COMMIT');
      return (await this.getById(created.id)) as BookingWithSpaces;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async update(
    id: string,
    fields: Partial<Booking>,
    spaces?: BookingSpaceInput[],
  ): Promise<BookingWithSpaces | null> {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const fieldMap: Record<string, any> = {
        lead_id: fields.lead_id,
        title: fields.title,
        event_type: fields.event_type,
        status: fields.status,
        expected_guests: fields.expected_guests,
        layout: fields.layout,
        notes: fields.notes,
        source: fields.source,
        created_by: fields.created_by,
      };

      const sets: string[] = [];
      const values: any[] = [];
      let paramCount = 1;
      for (const [key, value] of Object.entries(fieldMap)) {
        if (value !== undefined) {
          sets.push(`${key} = $${paramCount++}`);
          values.push(value);
        }
      }

      let updated: Booking | null = null;
      if (sets.length > 0) {
        sets.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        const result = await client.query(
          `UPDATE bookings SET ${sets.join(', ')} WHERE id = $${paramCount} RETURNING *`,
          values,
        );
        updated = result.rows[0] || null;
      } else {
        const result = await client.query('SELECT * FROM bookings WHERE id = $1', [id]);
        updated = result.rows[0] || null;
      }

      if (!updated) {
        await client.query('ROLLBACK');
        return null;
      }

      if (spaces) {
        await client.query('DELETE FROM booking_spaces WHERE booking_id = $1', [id]);
        await this.insertSpaces(client, id, updated.status, spaces);
      } else if (fields.status !== undefined) {
        // Keep the denormalized copy in sync - the exclusion constraint reads it,
        // so a hold -> confirmed transition is rejected here if it would overlap.
        await client.query('UPDATE booking_spaces SET booking_status = $1 WHERE booking_id = $2', [
          updated.status,
          id,
        ]);
      }

      await client.query('COMMIT');
      return this.getById(id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async delete(id: string): Promise<boolean> {
    const result = await query('DELETE FROM bookings WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  static async getSpacesInWindow(
    from: Date | string,
    to: Date | string,
    venueId?: string,
    statuses: string[] = ['hold', 'quoted', 'confirmed'],
  ): Promise<SpaceWindowJoinRow[]> {
    let sql = `
      SELECT bs.*, b.code, b.title
      FROM booking_spaces bs
      JOIN bookings b ON b.id = bs.booking_id
      WHERE bs.block_end_at > $1 AND bs.block_start_at < $2 AND bs.booking_status = ANY($3)`;
    const params: any[] = [from, to, statuses];
    if (venueId) {
      sql += ' AND bs.venue_id = $4';
      params.push(venueId);
    }
    sql += ' ORDER BY bs.block_start_at';
    const result = await query(sql, params);
    return result.rows;
  }

  private static async insertSpaces(
    client: PoolClient,
    bookingId: string,
    status: BookingStatus,
    spaces: BookingSpaceInput[],
  ): Promise<void> {
    for (const space of spaces) {
      const { blockStartAt, blockEndAt } = computeBlockRange(
        space.start_at,
        space.end_at,
        space.setup_minutes,
        space.teardown_minutes,
      );
      await client.query(
        `INSERT INTO booking_spaces (
          booking_id, venue_id, start_at, end_at, setup_minutes, teardown_minutes,
          block_start_at, block_end_at, booking_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          bookingId,
          space.venue_id,
          space.start_at,
          space.end_at,
          space.setup_minutes,
          space.teardown_minutes,
          blockStartAt,
          blockEndAt,
          status,
        ],
      );
    }
  }
}
