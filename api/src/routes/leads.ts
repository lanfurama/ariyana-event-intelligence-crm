import { Router, Request, Response } from 'express';
import { LeadModel } from '../models/LeadModel.js';
import { EmailLogModel } from '../models/EmailLogModel.js';
import { sendLeadEmails, sendLeadEmailsWithCustomContent, type CustomEmailContent } from '../utils/emailSender.js';
import type { Lead } from '../types/index.js';

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
// POST /api/leads/send-emails - Send email campaign to leads
router.post('/send-emails', async (req: Request, res: Response) => {
  try {
    const leadIds = Array.isArray(req.body?.leadIds) ? (req.body.leadIds as string[]).filter(Boolean) : [];
    const customEmails = Array.isArray(req.body?.emails) ? (req.body.emails as CustomEmailContent[]) : undefined;
    
    const leads = leadIds.length > 0 ? await LeadModel.getByIds(leadIds) : await LeadModel.getAll();

    if (leads.length === 0) {
      return res.status(404).json({ error: 'No leads available for email dispatch.' });
    }

    // Use custom emails if provided, otherwise use default template
    const emailSummary = customEmails && customEmails.length > 0
      ? await sendLeadEmailsWithCustomContent(leads, customEmails)
      : await sendLeadEmails(leads);

    let updatedLeads: Lead[] = [];
    if (emailSummary.successIds && emailSummary.successIds.length > 0) {
      const timestamp = new Date().toISOString();
      
      // Create a map of leadId to subject from sent emails
      const subjectMap = new Map<string, string>();
      if (emailSummary.sentEmails) {
        emailSummary.sentEmails.forEach(email => {
          subjectMap.set(email.leadId, email.subject);
        });
      }

      const updated = await Promise.all(
        emailSummary.successIds.map(async (leadId) => {
          try {
            // Update lead status
            const updatedLead = await LeadModel.update(leadId, { status: 'Contacted', last_contacted: timestamp });
            
            // Create email log with the actual subject that was sent
            const subject = subjectMap.get(leadId);
            const lead = leads.find(l => l.id === leadId);
            
            if (subject && lead) {
              const emailLogId = `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              
              try {
                await EmailLogModel.create({
                  id: emailLogId,
                  lead_id: leadId,
                  date: new Date(timestamp),
                  subject: subject,
                  status: 'sent',
                });
                console.log(`✅ Email log created for lead ${leadId}: ${subject}`);
              } catch (logError) {
                console.error(`❌ Error creating email log for lead ${leadId}:`, logError);
                // Don't fail the whole operation if log creation fails
              }
            } else {
              console.warn(`⚠️ No subject found for lead ${leadId}, skipping email log creation`);
            }
            
            return updatedLead;
          } catch (updateError) {
            console.error(`Error updating lead ${leadId} after email send:`, updateError);
            return null;
          }
        })
      );
      updatedLeads = updated.filter((lead): lead is NonNullable<typeof lead> => Boolean(lead));
    }

    // Create email logs for failed emails
    if (emailSummary.failures && emailSummary.failures.length > 0) {
      const timestamp = new Date().toISOString();
      
      await Promise.all(
        emailSummary.failures.map(async (failure) => {
          // Only create log if we have leadId and subject (attempted to send but failed)
          if (failure.leadId && failure.subject) {
            try {
              const emailLogId = `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              await EmailLogModel.create({
                id: emailLogId,
                lead_id: failure.leadId,
                date: new Date(timestamp),
                subject: failure.subject,
                status: 'failed',
              });
              console.log(`⚠️ Failed email log created for lead ${failure.leadId}: ${failure.subject} - ${failure.error}`);
            } catch (logError) {
              console.error(`❌ Error creating failed email log for lead ${failure.leadId}:`, logError);
              // Don't fail the whole operation if log creation fails
            }
          }
        })
      );
    }

    res.json({
      success: true,
      summary: emailSummary,
      updatedLeads,
    });
  } catch (error: any) {
    console.error('Error sending lead emails:', error);
    res.status(500).json({ error: error.message || 'Failed to send lead emails' });
  }
});
