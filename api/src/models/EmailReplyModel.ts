import { query } from '../config/database.js';
import { EmailReply } from '../types/index.js';

export class EmailReplyModel {
  static async getAll(leadId?: string, emailLogId?: string): Promise<EmailReply[]> {
    let sql = 'SELECT * FROM email_replies';
    const params: any[] = [];
    const conditions: string[] = [];

    if (leadId) {
      conditions.push(`lead_id = $${params.length + 1}`);
      params.push(leadId);
    }
    if (emailLogId) {
      conditions.push(`email_log_id = $${params.length + 1}`);
      params.push(emailLogId);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ' ORDER BY reply_date DESC, created_at DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async getById(id: string): Promise<EmailReply | null> {
    const result = await query('SELECT * FROM email_replies WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async create(emailReply: EmailReply): Promise<EmailReply> {
    const result = await query(
      `INSERT INTO email_replies (
        id, email_log_id, lead_id, from_email, from_name, subject, body, html_body,
        reply_date, message_id, in_reply_to, references_header
      ) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
       RETURNING *`,
      [
        emailReply.id,
        emailReply.email_log_id,
        emailReply.lead_id,
        emailReply.from_email,
        emailReply.from_name || null,
        emailReply.subject,
        emailReply.body,
        emailReply.html_body || null,
        typeof emailReply.reply_date === 'string' ? new Date(emailReply.reply_date) : emailReply.reply_date,
        emailReply.message_id || null,
        emailReply.in_reply_to || null,
        emailReply.references_header || null,
      ]
    );
    return result.rows[0];
  }

  static async getByMessageId(messageId: string): Promise<EmailReply | null> {
    const result = await query('SELECT * FROM email_replies WHERE message_id = $1', [messageId]);
    return result.rows[0] || null;
  }

  static async getByInReplyTo(inReplyTo: string): Promise<EmailReply[]> {
    const result = await query('SELECT * FROM email_replies WHERE in_reply_to = $1 ORDER BY reply_date DESC', [inReplyTo]);
    return result.rows;
  }

  static async delete(id: string): Promise<boolean> {
    const result = await query('DELETE FROM email_replies WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}

