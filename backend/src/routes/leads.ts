import { Router, Request, Response } from 'express';
import { LeadModel } from '../models/LeadModel.js';

const router = Router();

// GET /api/leads - Get all leads with optional filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const filters = {
      status: req.query.status as string | undefined,
      industry: req.query.industry as string | undefined,
      country: req.query.country as string | undefined,
      search: req.query.search as string | undefined,
    };
    const leads = await LeadModel.getAll(filters);
    res.json(leads);
  } catch (error: any) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch leads' });
  }
});

// GET /api/leads/stats - Get lead statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await LeadModel.getStats();
    res.json(stats);
  } catch (error: any) {
    console.error('Error fetching lead stats:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch lead stats' });
  }
});

// GET /api/leads/with-email-count - Get all leads with email count
router.get('/with-email-count', async (req: Request, res: Response) => {
  try {
    const leadId = req.query.leadId as string | undefined;
    const leads = await LeadModel.getWithEmailCount(leadId);
    res.json(leads);
  } catch (error: any) {
    console.error('Error fetching leads with email count:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch leads' });
  }
});

// GET /api/leads/:id - Get lead by id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const lead = await LeadModel.getById(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json(lead);
  } catch (error: any) {
    console.error('Error fetching lead:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch lead' });
  }
});

// POST /api/leads - Create new lead
router.post('/', async (req: Request, res: Response) => {
  try {
    const lead = await LeadModel.create(req.body);
    res.status(201).json(lead);
  } catch (error: any) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: error.message || 'Failed to create lead' });
  }
});

// PUT /api/leads/:id - Update lead
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const lead = await LeadModel.update(req.params.id, req.body);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json(lead);
  } catch (error: any) {
    console.error('Error updating lead:', error);
    res.status(500).json({ error: error.message || 'Failed to update lead' });
  }
});

// DELETE /api/leads/:id - Delete lead
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await LeadModel.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting lead:', error);
    res.status(500).json({ error: error.message || 'Failed to delete lead' });
  }
});

export default router;

