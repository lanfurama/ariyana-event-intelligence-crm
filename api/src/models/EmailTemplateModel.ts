import { query } from '../config/database.js';
import { EmailTemplate, EmailTemplateAttachment } from '../types/index.js';

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
      `INSERT INTO email_templates (id, name, subject, body, lead_type) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [template.id, template.name, template.subject, template.body, template.lead_type || null]
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
    if (template.lead_type !== undefined) {
      fields.push(`lead_type = $${paramCount++}`);
      values.push(template.lead_type || null);
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

  // Email Template Attachments
  static async getAttachments(templateId: string): Promise<EmailTemplateAttachment[]> {
    const result = await query(
      'SELECT id, template_id, name, size, type, file_data, created_at FROM email_template_attachments WHERE template_id = $1 ORDER BY created_at',
      [templateId]
    );
    console.log(`[getAttachments] Found ${result.rows.length} attachments for template ${templateId}`);
    result.rows.forEach((att, idx) => {
      console.log(`[getAttachments] Attachment ${idx + 1}: name=${att.name}, type=${att.type}, hasFileData=${!!att.file_data}, fileDataLength=${att.file_data?.length || 0}`);
    });
    return result.rows;
  }

  static async createAttachment(attachment: EmailTemplateAttachment): Promise<EmailTemplateAttachment> {
    // For links, file_data contains display name, name contains URL
    // Ensure file_data is never null - use name as fallback for links
    const fileData = attachment.file_data || (attachment.type === 'link' ? attachment.name : '');
    
    if (!fileData) {
      throw new Error(`file_data is required for attachment: ${attachment.name}`);
    }
    
    console.log(`[createAttachment] Inserting: template_id=${attachment.template_id}, name=${attachment.name}, type=${attachment.type}, file_data length=${fileData.length}`);
    
    try {
      const result = await query(
        `INSERT INTO email_template_attachments (template_id, name, size, type, file_data)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          attachment.template_id, 
          attachment.name, 
          attachment.size || 0, 
          attachment.type || 'application/octet-stream', 
          fileData
        ]
      );
      console.log(`[createAttachment] Created attachment with id: ${result.rows[0]?.id}`);
      return result.rows[0];
    } catch (error: any) {
      console.error(`[createAttachment] Error inserting attachment:`, error);
      throw error;
    }
  }

  static async deleteAttachment(id: number): Promise<boolean> {
    const result = await query('DELETE FROM email_template_attachments WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  static async deleteAttachmentsByTemplateId(templateId: string): Promise<boolean> {
    const result = await query('DELETE FROM email_template_attachments WHERE template_id = $1', [templateId]);
    return (result.rowCount ?? 0) > 0;
  }
}

