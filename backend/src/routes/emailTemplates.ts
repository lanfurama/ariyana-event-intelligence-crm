import { Router, Request, Response } from 'express';
import { EmailTemplateModel } from '../models/EmailTemplateModel.js';

const router = Router();

// GET /api/email-templates - Get all email templates
router.get('/', async (req: Request, res: Response) => {
  try {
    const templates = await EmailTemplateModel.getAll();
    res.json(templates);
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
    res.json(template);
  } catch (error: any) {
    console.error('Error fetching email template:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch email template' });
  }
});

// POST /api/email-templates - Create new email template
router.post('/', async (req: Request, res: Response) => {
  try {
    const template = await EmailTemplateModel.create(req.body);
    res.status(201).json(template);
  } catch (error: any) {
    console.error('Error creating email template:', error);
    res.status(500).json({ error: error.message || 'Failed to create email template' });
  }
});

// PUT /api/email-templates/:id - Update email template
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const template = await EmailTemplateModel.update(req.params.id, req.body);
    if (!template) {
      return res.status(404).json({ error: 'Email template not found' });
    }
    res.json(template);
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

export default router;

