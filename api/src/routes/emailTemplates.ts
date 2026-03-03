import { Router, Request, Response } from 'express';
import { EmailTemplateModel } from '../models/EmailTemplateModel.js';
import { sendTestEmail } from '../utils/emailSender.js';
import type { EmailTemplateAttachment } from '../types/index.js';

const router = Router();

// POST /api/email-templates/send-test - Send test email to any address (must be before /:id)
router.post('/send-test', async (req: Request, res: Response) => {
  try {
    const { to, subject, body, attachments, cc } = req.body || {};
    if (!to || typeof to !== 'string' || !subject || typeof subject !== 'string' || !body || typeof body !== 'string') {
      console.error('[send-test] Invalid body:', { hasTo: !!to, hasSubject: !!subject, hasBody: !!body });
      return res.status(400).json({ error: 'to, subject, and body are required' });
    }
    const ccList = Array.isArray(cc) ? cc : (cc ? [cc] : []);
    const result = await sendTestEmail(to.trim(), subject, body, attachments || [], ccList);
    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to send test email' });
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error sending test email:', error);
    res.status(500).json({ error: error.message || 'Failed to send test email' });
  }
});

// GET /api/email-templates - Get all email templates
router.get('/', async (req: Request, res: Response) => {
  try {
    const templates = await EmailTemplateModel.getAll();
    // Load attachments for each template
    const templatesWithAttachments = await Promise.all(
      templates.map(async (template) => {
        const attachments = await EmailTemplateModel.getAttachments(template.id);
        return { ...template, attachments };
      })
    );
    res.json(templatesWithAttachments);
  } catch (error: any) {
    console.error('Error fetching email templates:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch email templates' });
  }
});

// GET /api/email-templates/:id - Get email template by id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const template = await EmailTemplateModel.getById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Email template not found' });
    }
    const attachments = await EmailTemplateModel.getAttachments(template.id);
    res.json({ ...template, attachments });
  } catch (error: any) {
    console.error('Error fetching email template:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch email template' });
  }
});

// POST /api/email-templates - Create new email template
router.post('/', async (req: Request, res: Response) => {
  try {
    const { attachments, ...templateData } = req.body;
    const template = await EmailTemplateModel.create(templateData);
    
    // Create attachments if provided
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      console.log(`[create] Creating ${attachments.length} attachment(s) for template ${template.id}`);
      for (const attachment of attachments) {
        console.log(`[create] Creating attachment:`, { name: attachment.name, type: attachment.type, hasFileData: !!attachment.file_data });
        await EmailTemplateModel.createAttachment({
          template_id: template.id,
          name: attachment.name,
          size: attachment.size || 0,
          type: attachment.type || 'application/octet-stream',
          file_data: attachment.file_data || attachment.name, // For links, use name as fallback
        });
      }
    }
    
    const templateAttachments = await EmailTemplateModel.getAttachments(template.id);
    res.status(201).json({ ...template, attachments: templateAttachments });
  } catch (error: any) {
    console.error('Error creating email template:', error);
    res.status(500).json({ error: error.message || 'Failed to create email template' });
  }
});

// PUT /api/email-templates/:id - Update email template
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { attachments, ...templateData } = req.body;
    const template = await EmailTemplateModel.update(req.params.id, templateData);
    if (!template) {
      return res.status(404).json({ error: 'Email template not found' });
    }
    
    // Update attachments if provided
    if (attachments !== undefined) {
      // Delete existing attachments
      await EmailTemplateModel.deleteAttachmentsByTemplateId(req.params.id);
      
      // Create new attachments
      if (Array.isArray(attachments) && attachments.length > 0) {
        console.log(`[update] Creating ${attachments.length} attachment(s) for template ${req.params.id}`);
        for (const attachment of attachments) {
          console.log(`[update] Creating attachment:`, { name: attachment.name, type: attachment.type, hasFileData: !!attachment.file_data });
          await EmailTemplateModel.createAttachment({
            template_id: req.params.id,
            name: attachment.name,
            size: attachment.size || 0,
            type: attachment.type || 'application/octet-stream',
            file_data: attachment.file_data || attachment.name, // For links, use name as fallback
          });
        }
      }
    }
    
    const templateAttachments = await EmailTemplateModel.getAttachments(req.params.id);
    res.json({ ...template, attachments: templateAttachments });
  } catch (error: any) {
    console.error('Error updating email template:', error);
    res.status(500).json({ error: error.message || 'Failed to update email template' });
  }
});

// DELETE /api/email-templates/:id - Delete email template
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await EmailTemplateModel.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Email template not found' });
    }
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting email template:', error);
    res.status(500).json({ error: error.message || 'Failed to delete email template' });
  }
});

// GET /api/email-templates/:id/attachments - Get attachments for template
router.get('/:id/attachments', async (req: Request, res: Response) => {
  try {
    const attachments = await EmailTemplateModel.getAttachments(req.params.id);
    res.json(attachments);
  } catch (error: any) {
    console.error('Error fetching attachments:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch attachments' });
  }
});

// POST /api/email-templates/:id/attachments - Create attachment for template
router.post('/:id/attachments', async (req: Request, res: Response) => {
  try {
    const attachment = await EmailTemplateModel.createAttachment({
      template_id: req.params.id,
      ...req.body,
    });
    res.status(201).json(attachment);
  } catch (error: any) {
    console.error('Error creating attachment:', error);
    res.status(500).json({ error: error.message || 'Failed to create attachment' });
  }
});

// DELETE /api/email-templates/attachments/:attachmentId - Delete attachment
router.delete('/attachments/:attachmentId', async (req: Request, res: Response) => {
  try {
    const deleted = await EmailTemplateModel.deleteAttachment(parseInt(req.params.attachmentId));
    if (!deleted) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({ error: error.message || 'Failed to delete attachment' });
  }
});

export default router;

