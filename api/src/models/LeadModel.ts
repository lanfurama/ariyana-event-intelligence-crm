import { query } from '../config/database.js';
import { Lead, LeadWithEmailCount } from '../types/index.js';

// Helper function to ensure industry is never null/empty
function normalizeIndustry(industry: string | null | undefined): string {
  if (!industry || industry.trim() === '' || industry.toLowerCase() === 'n/a' || industry.toLowerCase() === 'null') {
    return 'Unknown';
  }
  return industry.trim();
}

export class LeadModel {
  static async getAll(filters?: {
    status?: string;
    industry?: string;
    country?: string;
    search?: string;
  }): Promise<Lead[]> {
    let sql = 'SELECT * FROM leads WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (filters?.status) {
      sql += ` AND status = $${paramCount++}`;
      params.push(filters.status);
    }
    if (filters?.industry) {
      sql += ` AND industry = $${paramCount++}`;
      params.push(filters.industry);
    }
    if (filters?.country) {
      sql += ` AND country = $${paramCount++}`;
      params.push(filters.country);
    }
    if (filters?.search) {
      sql += ` AND (
        company_name ILIKE $${paramCount} OR 
        key_person_name ILIKE $${paramCount} OR
        notes ILIKE $${paramCount}
      )`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async getById(id: string): Promise<Lead | null> {
    const result = await query('SELECT * FROM leads WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async getWithEmailCount(id?: string): Promise<LeadWithEmailCount[]> {
    let sql = `
      SELECT 
        l.*,
        COUNT(el.id) as email_count
      FROM leads l
      LEFT JOIN email_logs el ON l.id = el.lead_id
    `;
    const params: any[] = [];

    if (id) {
      sql += ' WHERE l.id = $1';
      params.push(id);
    }

    sql += ' GROUP BY l.id ORDER BY l.created_at DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async getByIds(ids: string[]): Promise<Lead[]> {
    if (!ids || ids.length === 0) {
      return [];
    }

    const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
    const result = await query(`SELECT * FROM leads WHERE id IN (${placeholders})`, ids);
    return result.rows;
  }

  static async create(lead: Lead): Promise<Lead> {
    const result = await query(
      `INSERT INTO leads (
        id, company_name, industry, country, city, website,
        key_person_name, key_person_title, key_person_email, key_person_phone, key_person_linkedin,
        total_events, vietnam_events, notes, status, last_contacted,
        past_events_history, research_notes, secondary_person_name, secondary_person_title, 
        secondary_person_email, number_of_delegates
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
      ) RETURNING *`,
      [
        lead.id,
        lead.company_name,
        normalizeIndustry(lead.industry), // Ensure industry is never null/empty
        lead.country,
        lead.city,
        lead.website || null,
        lead.key_person_name,
        lead.key_person_title || null,
        lead.key_person_email || null,
        lead.key_person_phone || null,
        lead.key_person_linkedin || null,
        lead.total_events || 0,
        lead.vietnam_events || 0,
        lead.notes || null,
        lead.status || 'New',
        lead.last_contacted ? new Date(lead.last_contacted) : null,
        lead.past_events_history || null,
        lead.research_notes || null,
        lead.secondary_person_name || null,
        lead.secondary_person_title || null,
        lead.secondary_person_email || null,
        lead.number_of_delegates || null,
      ]
    );
    return result.rows[0];
  }

  static async update(id: string, lead: Partial<Lead>): Promise<Lead | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    const fieldMap: Record<string, any> = {
      company_name: lead.company_name,
      industry: lead.industry !== undefined ? normalizeIndustry(lead.industry) : undefined, // Ensure industry is never null/empty if provided
      country: lead.country,
      city: lead.city,
      website: lead.website,
      key_person_name: lead.key_person_name,
      key_person_title: lead.key_person_title,
      key_person_email: lead.key_person_email,
      key_person_phone: lead.key_person_phone,
      key_person_linkedin: lead.key_person_linkedin,
      total_events: lead.total_events,
      vietnam_events: lead.vietnam_events,
      notes: lead.notes,
      status: lead.status,
      last_contacted: lead.last_contacted ? new Date(lead.last_contacted) : lead.last_contacted,
      past_events_history: lead.past_events_history,
      research_notes: lead.research_notes,
      secondary_person_name: lead.secondary_person_name,
      secondary_person_title: lead.secondary_person_title,
      secondary_person_email: lead.secondary_person_email,
      number_of_delegates: lead.number_of_delegates,
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

    values.push(id);
    const result = await query(
      `UPDATE leads SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  static async delete(id: string): Promise<boolean> {
    const result = await query('DELETE FROM leads WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  static async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byIndustry: Record<string, number>;
    byCountry: Record<string, number>;
  }> {
    const totalResult = await query('SELECT COUNT(*) as count FROM leads');
    const statusResult = await query(
      'SELECT status, COUNT(*) as count FROM leads GROUP BY status'
    );
    const industryResult = await query(
      'SELECT industry, COUNT(*) as count FROM leads GROUP BY industry'
    );
    const countryResult = await query(
      'SELECT country, COUNT(*) as count FROM leads GROUP BY country'
    );

    const byStatus: Record<string, number> = {};
    statusResult.rows.forEach((row: any) => {
      byStatus[row.status] = parseInt(row.count);
    });

    const byIndustry: Record<string, number> = {};
    industryResult.rows.forEach((row: any) => {
      byIndustry[row.industry] = parseInt(row.count);
    });

    const byCountry: Record<string, number> = {};
    countryResult.rows.forEach((row: any) => {
      byCountry[row.country] = parseInt(row.count);
    });

    return {
      total: parseInt(totalResult.rows[0].count),
      byStatus,
      byIndustry,
      byCountry,
    };
  }
}
