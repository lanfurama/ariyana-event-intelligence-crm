import type { PoolClient } from 'pg';
import { getClient, query } from '../config/database.js';
import type { Quote, QuoteItem, QuoteStatus } from '../types/index.js';
import { computeQuoteTotals } from '../utils/bookingHelpers.js';

export interface QuoteItemInput {
  kind: string;
  description: string;
  quantity: number;
  unit_price: number;
  sort_order?: number;
}

export interface QuoteFields {
  discount_pct?: number;
  vat_pct?: number;
  status?: QuoteStatus;
  valid_until?: string | null;
  notes?: string | null;
  sent_at?: string | null;
}

export interface QuoteWithItems extends Quote {
  items: QuoteItem[];
}

// Numeric columns come back from pg as strings - normalize so payloads stay numbers.
// (Items arrive through json_agg, where Postgres numerics serialize as JSON numbers.)
function normalizeQuoteRow(row: any): QuoteWithItems {
  return {
    ...row,
    subtotal: Number(row.subtotal),
    discount_pct: Number(row.discount_pct),
    vat_pct: Number(row.vat_pct),
    total: Number(row.total),
  };
}

const ITEMS_AGG = `
  COALESCE(
    json_agg(
      json_build_object(
        'id', qi.id,
        'quote_id', qi.quote_id,
        'kind', qi.kind,
        'description', qi.description,
        'quantity', qi.quantity,
        'unit_price', qi.unit_price,
        'amount', qi.amount,
        'sort_order', qi.sort_order
      ) ORDER BY qi.sort_order, qi.id
    ) FILTER (WHERE qi.id IS NOT NULL),
    '[]'
  ) AS items`;

export class QuoteModel {
  static async getAll(bookingId?: string): Promise<QuoteWithItems[]> {
    let sql = `
      SELECT q.*,${ITEMS_AGG}
      FROM quotes q
      LEFT JOIN quote_items qi ON qi.quote_id = q.id
      WHERE 1=1`;
    const params: any[] = [];
    if (bookingId) {
      sql += ' AND q.booking_id = $1';
      params.push(bookingId);
    }
    sql += ' GROUP BY q.id ORDER BY q.created_at DESC';
    const result = await query(sql, params);
    return result.rows.map(normalizeQuoteRow);
  }

  static async getById(id: string): Promise<QuoteWithItems | null> {
    const result = await query(
      `SELECT q.*,${ITEMS_AGG}
      FROM quotes q
      LEFT JOIN quote_items qi ON qi.quote_id = q.id
      WHERE q.id = $1
      GROUP BY q.id`,
      [id],
    );
    return result.rows[0] ? normalizeQuoteRow(result.rows[0]) : null;
  }

  static async create(
    bookingId: string,
    fields: QuoteFields,
    items: QuoteItemInput[],
  ): Promise<QuoteWithItems> {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const discountPct = fields.discount_pct ?? 0;
      const vatPct = fields.vat_pct ?? 8;
      const totals = computeQuoteTotals(items, discountPct, vatPct);

      const versionResult = await client.query(
        'SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM quotes WHERE booking_id = $1',
        [bookingId],
      );
      const version = Number(versionResult.rows[0].next_version);

      const id = `quote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const quoteResult = await client.query(
        `INSERT INTO quotes (
          id, booking_id, version, status, currency, subtotal, discount_pct,
          vat_pct, total, valid_until, notes, sent_at
        ) VALUES (
          $1, $2, $3, $4, 'VND', $5, $6, $7, $8, $9, $10, $11
        ) RETURNING *`,
        [
          id,
          bookingId,
          version,
          fields.status || 'draft',
          totals.subtotal,
          discountPct,
          vatPct,
          totals.total,
          fields.valid_until ?? null,
          fields.notes ?? null,
          fields.sent_at ?? null,
        ],
      );

      await this.insertItems(client, id, items);

      await client.query('COMMIT');
      return { ...normalizeQuoteRow(quoteResult.rows[0]), items: await this.getItems(id) };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async update(
    id: string,
    fields: QuoteFields,
    items?: QuoteItemInput[],
  ): Promise<QuoteWithItems | null> {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const existingResult = await client.query('SELECT * FROM quotes WHERE id = $1', [id]);
      const existing = existingResult.rows[0];
      if (!existing) {
        await client.query('ROLLBACK');
        return null;
      }

      const discountPct = fields.discount_pct ?? Number(existing.discount_pct);
      const vatPct = fields.vat_pct ?? Number(existing.vat_pct);

      let effectiveItems: QuoteItemInput[];
      if (items) {
        await client.query('DELETE FROM quote_items WHERE quote_id = $1', [id]);
        await this.insertItems(client, id, items);
        effectiveItems = items;
      } else {
        const itemsResult = await client.query(
          'SELECT quantity, unit_price, kind, description FROM quote_items WHERE quote_id = $1',
          [id],
        );
        effectiveItems = itemsResult.rows.map((row: any) => ({
          kind: row.kind,
          description: row.description,
          quantity: Number(row.quantity),
          unit_price: Number(row.unit_price),
        }));
      }

      const totals = computeQuoteTotals(effectiveItems, discountPct, vatPct);

      await client.query(
        `UPDATE quotes SET
          status = $1, discount_pct = $2, vat_pct = $3, subtotal = $4, total = $5,
          valid_until = $6, notes = $7, sent_at = $8, updated_at = CURRENT_TIMESTAMP
        WHERE id = $9`,
        [
          fields.status ?? existing.status,
          discountPct,
          vatPct,
          totals.subtotal,
          totals.total,
          fields.valid_until !== undefined ? fields.valid_until : existing.valid_until,
          fields.notes !== undefined ? fields.notes : existing.notes,
          fields.sent_at !== undefined ? fields.sent_at : existing.sent_at,
          id,
        ],
      );

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
    const result = await query('DELETE FROM quotes WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private static async getItems(quoteId: string): Promise<QuoteItem[]> {
    const result = await query(
      'SELECT * FROM quote_items WHERE quote_id = $1 ORDER BY sort_order, id',
      [quoteId],
    );
    return result.rows.map((row: any) => ({
      ...row,
      quantity: Number(row.quantity),
      unit_price: Number(row.unit_price),
      amount: Number(row.amount),
    }));
  }

  private static async insertItems(
    client: PoolClient,
    quoteId: string,
    items: QuoteItemInput[],
  ): Promise<void> {
    for (const [index, item] of items.entries()) {
      await client.query(
        `INSERT INTO quote_items (
          quote_id, kind, description, quantity, unit_price, amount, sort_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          quoteId,
          item.kind,
          item.description,
          item.quantity,
          item.unit_price,
          Math.round(item.quantity * item.unit_price),
          item.sort_order ?? index,
        ],
      );
    }
  }
}
