import { query } from '../config/database.js';
import { EmailLog, EmailLogAttachment } from '../types/index.js';

export class EmailLogModel {
  static async getAll(leadId?: string): Promise<EmailLog[]> {
    let sql = 'SELECT * FROM email_logs';
    const params: any[] = [];

    if (leadId) {
      sql += ' WHERE lead_id = $1';
      params.push(leadId);
    }

    sql += ' ORDER BY date DESC, created_at DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async getById(id: string): Promise<EmailLog | null> {
    const result = await query('SELECT * FROM email_logs WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async create(emailLog: EmailLog): Promise<EmailLog> {
    const result = await query(
      `INSERT INTO email_logs (id, lead_id, date, subject, status, message_id) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [
        emailLog.id,
        emailLog.lead_id,
        typeof emailLog.date === 'string' ? new Date(emailLog.date) : emailLog.date,
        emailLog.subject,
        emailLog.status,
        (emailLog as any).message_id || null,
      ]
    );
    return result.rows[0];
  }

  static async update(id: string, emailLog: Partial<EmailLog>): Promise<EmailLog | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (emailLog.lead_id !== undefined) {
      fields.push(`lead_id = $${paramCount++}`);
      values.push(emailLog.lead_id);
    }
    if (emailLog.date !== undefined) {
      fields.push(`date = $${paramCount++}`);
      values.push(
        typeof emailLog.date === 'string' ? new Date(emailLog.date) : emailLog.date
      );
    }
    if (emailLog.subject !== undefined) {
      fields.push(`subject = $${paramCount++}`);
      values.push(emailLog.subject);
    }
    if (emailLog.status !== undefined) {
      fields.push(`status = $${paramCount++}`);
      values.push(emailLog.status);
    }
    if ((emailLog as any).message_id !== undefined) {
      fields.push(`message_id = $${paramCount++}`);
      values.push((emailLog as any).message_id);
    }

    if (fields.length === 0) {
      return this.getById(id);
    }

    values.push(id);
    const result = await query(
      `UPDATE email_logs SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  static async delete(id: string): Promise<boolean> {
    const result = await query('DELETE FROM email_logs WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Email Log Attachments
  static async getAttachments(emailLogId: string): Promise<EmailLogAttachment[]> {
    const result = await query(
      'SELECT * FROM email_log_attachments WHERE email_log_id = $1 ORDER BY created_at',
      [emailLogId]
    );
    return result.rows;
  }

  static async createAttachment(
    attachment: EmailLogAttachment
  ): Promise<EmailLogAttachment> {
    const result = await query(
      `INSERT INTO email_log_attachments (email_log_id, name, size, type) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [attachment.email_log_id, attachment.name, attachment.size, attachment.type]
    );
    return result.rows[0];
  }

  static async deleteAttachment(id: number): Promise<boolean> {
    const result = await query('DELETE FROM email_log_attachments WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}

