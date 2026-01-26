import { query } from '../config/database.js';

export interface EmailReportsConfig {
  id: string;
  recipient_email: string;
  recipient_name?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  day_of_week?: number; // 0-6 (Sunday-Saturday) for weekly
  day_of_month?: number; // 1-28 for monthly
  time_hour: number; // 0-23
  time_minute: number; // 0-59
  timezone: string;
  enabled: boolean;
  include_stats: boolean;
  include_new_leads: boolean;
  include_email_activity: boolean;
  include_top_leads: boolean;
  top_leads_count: number;
  last_sent_at?: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface EmailReportsLog {
  id: string;
  config_id: string;
  recipient_email: string;
  report_type: 'daily' | 'weekly' | 'monthly';
  period_start: Date | string;
  period_end: Date | string;
  sent_at: Date | string;
  status: 'sent' | 'failed';
  error_message?: string;
  stats_summary?: any; // JSONB
}

export class EmailReportsConfigModel {
  static async getAll(enabledOnly: boolean = false): Promise<EmailReportsConfig[]> {
    let sql = 'SELECT * FROM email_reports_config';
    const params: any[] = [];

    if (enabledOnly) {
      sql += ' WHERE enabled = true';
    }

    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async getById(id: string): Promise<EmailReportsConfig | null> {
    const result = await query('SELECT * FROM email_reports_config WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async create(config: Omit<EmailReportsConfig, 'created_at' | 'updated_at' | 'last_sent_at'>): Promise<EmailReportsConfig> {
    const result = await query(
      `INSERT INTO email_reports_config (
        id, recipient_email, recipient_name, frequency, day_of_week, day_of_month,
        time_hour, time_minute, timezone, enabled,
        include_stats, include_new_leads, include_email_activity, include_top_leads, top_leads_count
      ) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
       RETURNING *`,
      [
        config.id,
        config.recipient_email,
        config.recipient_name || null,
        config.frequency,
        config.day_of_week || null,
        config.day_of_month || null,
        config.time_hour,
        config.time_minute,
        config.timezone || 'Asia/Ho_Chi_Minh',
        config.enabled !== undefined ? config.enabled : true,
        config.include_stats !== undefined ? config.include_stats : true,
        config.include_new_leads !== undefined ? config.include_new_leads : true,
        config.include_email_activity !== undefined ? config.include_email_activity : true,
        config.include_top_leads !== undefined ? config.include_top_leads : true,
        config.top_leads_count || 10,
      ]
    );
    return result.rows[0];
  }

  static async update(id: string, config: Partial<EmailReportsConfig>): Promise<EmailReportsConfig | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (config.recipient_email !== undefined) {
      fields.push(`recipient_email = $${paramCount++}`);
      values.push(config.recipient_email);
    }
    if (config.recipient_name !== undefined) {
      fields.push(`recipient_name = $${paramCount++}`);
      values.push(config.recipient_name);
    }
    if (config.frequency !== undefined) {
      fields.push(`frequency = $${paramCount++}`);
      values.push(config.frequency);
    }
    if (config.day_of_week !== undefined) {
      fields.push(`day_of_week = $${paramCount++}`);
      values.push(config.day_of_week);
    }
    if (config.day_of_month !== undefined) {
      fields.push(`day_of_month = $${paramCount++}`);
      values.push(config.day_of_month);
    }
    if (config.time_hour !== undefined) {
      fields.push(`time_hour = $${paramCount++}`);
      values.push(config.time_hour);
    }
    if (config.time_minute !== undefined) {
      fields.push(`time_minute = $${paramCount++}`);
      values.push(config.time_minute);
    }
    if (config.timezone !== undefined) {
      fields.push(`timezone = $${paramCount++}`);
      values.push(config.timezone);
    }
    if (config.enabled !== undefined) {
      fields.push(`enabled = $${paramCount++}`);
      values.push(config.enabled);
    }
    if (config.include_stats !== undefined) {
      fields.push(`include_stats = $${paramCount++}`);
      values.push(config.include_stats);
    }
    if (config.include_new_leads !== undefined) {
      fields.push(`include_new_leads = $${paramCount++}`);
      values.push(config.include_new_leads);
    }
    if (config.include_email_activity !== undefined) {
      fields.push(`include_email_activity = $${paramCount++}`);
      values.push(config.include_email_activity);
    }
    if (config.include_top_leads !== undefined) {
      fields.push(`include_top_leads = $${paramCount++}`);
      values.push(config.include_top_leads);
    }
    if (config.top_leads_count !== undefined) {
      fields.push(`top_leads_count = $${paramCount++}`);
      values.push(config.top_leads_count);
    }
    if (config.last_sent_at !== undefined) {
      fields.push(`last_sent_at = $${paramCount++}`);
      values.push(config.last_sent_at);
    }

    if (fields.length === 0) {
      return this.getById(id);
    }

    // Always update updated_at
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    const result = await query(
      `UPDATE email_reports_config SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  static async delete(id: string): Promise<boolean> {
    const result = await query('DELETE FROM email_reports_config WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Log methods
  static async createLog(log: Omit<EmailReportsLog, 'sent_at'>): Promise<EmailReportsLog> {
    const result = await query(
      `INSERT INTO email_reports_log (
        id, config_id, recipient_email, report_type, period_start, period_end, status, error_message, stats_summary
      ) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [
        log.id,
        log.config_id,
        log.recipient_email,
        log.report_type,
        typeof log.period_start === 'string' ? new Date(log.period_start) : log.period_start,
        typeof log.period_end === 'string' ? new Date(log.period_end) : log.period_end,
        log.status,
        log.error_message || null,
        log.stats_summary ? JSON.stringify(log.stats_summary) : null,
      ]
    );
    return result.rows[0];
  }

  static async getLogs(configId?: string, limit: number = 50): Promise<EmailReportsLog[]> {
    let sql = 'SELECT * FROM email_reports_log';
    const params: any[] = [];

    if (configId) {
      sql += ' WHERE config_id = $1';
      params.push(configId);
    }

    sql += ' ORDER BY sent_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await query(sql, params);
    return result.rows;
  }
}
