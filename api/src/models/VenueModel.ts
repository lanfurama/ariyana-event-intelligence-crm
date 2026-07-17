import { query } from '../config/database.js';
import type { Venue } from '../types/index.js';

// pg returns NUMERIC columns as strings - normalize so route payloads stay numbers.
function normalizeVenueRow(row: any): Venue {
  return {
    ...row,
    area_sqm:
      row.area_sqm === null || row.area_sqm === undefined ? row.area_sqm : Number(row.area_sqm),
    ceiling_height_m:
      row.ceiling_height_m === null || row.ceiling_height_m === undefined
        ? row.ceiling_height_m
        : Number(row.ceiling_height_m),
  };
}

export class VenueModel {
  static async getAll(includeInactive = false): Promise<Venue[]> {
    let sql = 'SELECT * FROM venues';
    if (!includeInactive) {
      sql += ' WHERE is_active = true';
    }
    sql += ' ORDER BY display_order, name';
    const result = await query(sql);
    return result.rows.map(normalizeVenueRow);
  }

  static async getById(id: string): Promise<Venue | null> {
    const result = await query('SELECT * FROM venues WHERE id = $1', [id]);
    return result.rows[0] ? normalizeVenueRow(result.rows[0]) : null;
  }

  static async create(venue: Venue): Promise<Venue> {
    const result = await query(
      `INSERT INTO venues (
        id, name, slug, floor, area_sqm, ceiling_height_m, capacities,
        description, images, base_rates, amenities, is_active, display_order
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      ) RETURNING *`,
      [
        venue.id,
        venue.name,
        venue.slug,
        venue.floor || null,
        venue.area_sqm ?? null,
        venue.ceiling_height_m ?? null,
        JSON.stringify(venue.capacities || {}),
        venue.description || null,
        JSON.stringify(venue.images || []),
        JSON.stringify(venue.base_rates || {}),
        JSON.stringify(venue.amenities || []),
        venue.is_active !== undefined ? venue.is_active : true,
        venue.display_order || 0,
      ],
    );
    return normalizeVenueRow(result.rows[0]);
  }

  static async update(id: string, venue: Partial<Venue>): Promise<Venue | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    const fieldMap: Record<string, any> = {
      name: venue.name,
      slug: venue.slug,
      floor: venue.floor,
      area_sqm: venue.area_sqm,
      ceiling_height_m: venue.ceiling_height_m,
      capacities: venue.capacities !== undefined ? JSON.stringify(venue.capacities) : undefined,
      description: venue.description,
      images: venue.images !== undefined ? JSON.stringify(venue.images) : undefined,
      base_rates: venue.base_rates !== undefined ? JSON.stringify(venue.base_rates) : undefined,
      amenities: venue.amenities !== undefined ? JSON.stringify(venue.amenities) : undefined,
      is_active: venue.is_active,
      display_order: venue.display_order,
    };

    for (const [key, value] of Object.entries(fieldMap)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramCount++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      return this.getById(id);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    const result = await query(
      `UPDATE venues SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values,
    );
    return result.rows[0] ? normalizeVenueRow(result.rows[0]) : null;
  }

  static async delete(id: string): Promise<boolean> {
    const result = await query('DELETE FROM venues WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
