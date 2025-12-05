import { Router, Request, Response } from 'express';
import { EmailLogModel } from '../models/EmailLogModel.js';

const router = Router();

// GET /api/email-logs - Get all email logs (optionally filtered by leadId)
router.get('/', async (req: Request, res: Response) => {
  try {
    const leadId = req.query.leadId as string | undefined;
    const emailLogs = await EmailLogModel.getAll(leadId);
    res.json(emailLogs);
  } catch (error: any) {
    console.error('Error fetching email logs:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch email logs' });
  }
});

// GET /api/email-logs/:id - Get email log by id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const emailLog = await EmailLogModel.getById(req.params.id);
    if (!emailLog) {
      return res.status(404).json({ error: 'Email log not found' });
    }
    res.json(emailLog);
  } catch (error: any) {
    console.error('Error fetching email log:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch email log' });
  }
});

// POST /api/email-logs - Create new email log
router.post('/', async (req: Request, res: Response) => {
  try {
    const emailLog = await EmailLogModel.create(req.body);
    res.status(201).json(emailLog);
  } catch (error: any) {
    console.error('Error creating email log:', error);
    res.status(500).json({ error: error.message || 'Failed to create email log' });
  }
});

// PUT /api/email-logs/:id - Update email log
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const emailLog = await EmailLogModel.update(req.params.id, req.body);
    if (!emailLog) {
      return res.status(404).json({ error: 'Email log not found' });
    }
    res.json(emailLog);
  } catch (error: any) {
    console.error('Error updating email log:', error);
    res.status(500).json({ error: error.message || 'Failed to update email log' });
  }
});

// DELETE /api/email-logs/:id - Delete email log
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await EmailLogModel.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Email log not found' });
    }
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting email log:', error);
    res.status(500).json({ error: error.message || 'Failed to delete email log' });
  }
});

// GET /api/email-logs/:id/attachments - Get attachments for email log
router.get('/:id/attachments', async (req: Request, res: Response) => {
  try {
    const attachments = await EmailLogModel.getAttachments(req.params.id);
    res.json(attachments);
  } catch (error: any) {
    console.error('Error fetching attachments:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch attachments' });
  }
});

// POST /api/email-logs/:id/attachments - Create attachment for email log
router.post('/:id/attachments', async (req: Request, res: Response) => {
  try {
    const attachment = await EmailLogModel.createAttachment({
      email_log_id: req.params.id,
      ...req.body,
    });
    res.status(201).json(attachment);
  } catch (error: any) {
    console.error('Error creating attachment:', error);
    res.status(500).json({ error: error.message || 'Failed to create attachment' });
  }
});

// DELETE /api/email-logs/attachments/:attachmentId - Delete attachment
router.delete('/attachments/:attachmentId', async (req: Request, res: Response) => {
  try {
    const deleted = await EmailLogModel.deleteAttachment(parseInt(req.params.attachmentId));
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

