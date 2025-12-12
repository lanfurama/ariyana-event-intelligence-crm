import { query } from '../config/database.js';
import { EmailTemplate } from '../types/index.js';

export class EmailTemplateModel {
  static async getAll(): Promise<EmailTemplate[]> {
    const result = await query('SELECT * FROM email_templates ORDER BY name');
    return result.rows;
  }

  static async getById(id: string): Promise<EmailTemplate | null> {
    const result = await query('SELECT * FROM email_templates WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async create(template: EmailTemplate): Promise<EmailTemplate> {
    const result = await query(
      `INSERT INTO email_templates (id, name, subject, body) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [template.id, template.name, template.subject, template.body]
    );
    return result.rows[0];
  }

  static async update(id: string, template: Partial<EmailTemplate>): Promise<EmailTemplate | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (template.name !== undefined) {
      fields.push(`name = $${paramCount++}`);
      values.push(template.name);
    }
    if (template.subject !== undefined) {
      fields.push(`subject = $${paramCount++}`);
      values.push(template.subject);
    }
    if (template.body !== undefined) {
      fields.push(`body = $${paramCount++}`);
      values.push(template.body);
    }

    if (fields.length === 0) {
      return this.getById(id);
    }

    values.push(id);
    const result = await query(
      `UPDATE email_templates SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  static async delete(id: string): Promise<boolean> {
    const result = await query('DELETE FROM email_templates WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}

