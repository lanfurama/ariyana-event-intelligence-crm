import { Router, Request, Response } from 'express';
import { EmailReplyModel } from '../models/EmailReplyModel.js';
import { ImapService } from '../utils/imapService.js';
import { EmailLogModel } from '../models/EmailLogModel.js';

const router = Router();

// GET /api/email-replies - Get all email replies (optionally filtered by leadId or emailLogId)
router.get('/', async (req: Request, res: Response) => {
  try {
    const leadId = req.query.leadId as string | undefined;
    const emailLogId = req.query.emailLogId as string | undefined;
    const replies = await EmailReplyModel.getAll(leadId, emailLogId);
    res.json(replies);
  } catch (error: any) {
    console.error('Error fetching email replies:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch email replies' });
  }
});

// GET /api/email-replies/:id - Get email reply by id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const reply = await EmailReplyModel.getById(req.params.id);
    if (!reply) {
      return res.status(404).json({ error: 'Email reply not found' });
    }
    res.json(reply);
  } catch (error: any) {
    console.error('Error fetching email reply:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch email reply' });
  }
});

// POST /api/email-replies/check-inbox - Manually trigger inbox check for replies
// This must come before POST / to avoid route conflicts
router.post('/check-inbox', async (req: Request, res: Response) => {
  try {
    const { since, maxEmails, subjectFilter } = req.body;
    const sinceDate = since ? new Date(since) : undefined;
    
    const processedCount = await ImapService.checkInboxForReplies({
      since: sinceDate,
      maxEmails: maxEmails || 50,
      subjectFilter: subjectFilter,
    });

    res.json({
      success: true,
      processedCount,
      message: `Processed ${processedCount} email reply(ies)`,
    });
  } catch (error: any) {
    console.error('Error checking inbox:', error);
    res.status(500).json({
      error: error.message || 'Failed to check inbox',
      details: error.stack,
    });
  }
});

// POST /api/email-replies - Create a manual email reply (marked by user)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { leadId } = req.body;

    if (!leadId) {
      return res.status(400).json({ error: 'leadId is required' });
    }

    // Get the latest email log for this lead
    const emailLogs = await EmailLogModel.getAll(leadId);
    if (emailLogs.length === 0) {
      return res.status(400).json({ error: 'No email logs found for this lead' });
    }

    const latestEmailLog = emailLogs[0]; // Already sorted by date DESC

    // Check if reply already exists for this email log
    const existingReplies = await EmailReplyModel.getAll(leadId, latestEmailLog.id);
    if (existingReplies.length > 0) {
      return res.status(400).json({ error: 'Reply already exists for this lead' });
    }

    // Create a manual email reply record
    const emailReply = {
      id: `reply-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      email_log_id: latestEmailLog.id,
      lead_id: leadId,
      from_email: '', // Will be empty for manual entries
      from_name: '', // Will be empty for manual entries
      subject: latestEmailLog.subject ? `Re: ${latestEmailLog.subject}` : 'Re: Email Reply',
      body: 'Manually marked as replied',
      html_body: null,
      reply_date: new Date(),
      message_id: null,
      in_reply_to: latestEmailLog.message_id || null,
      references_header: null,
    };

    const createdReply = await EmailReplyModel.create(emailReply);
    res.status(201).json(createdReply);
  } catch (error: any) {
    console.error('Error creating manual email reply:', error);
    res.status(500).json({ error: error.message || 'Failed to create email reply' });
  }
});

// GET /api/email-replies/count-by-subject - Count emails in inbox by subject filter
router.get('/count-by-subject', async (req: Request, res: Response) => {
  try {
    const subjectFilter = req.query.subject as string;
    const since = req.query.since as string | undefined;
    const includeRead = req.query.includeRead === 'true';

    if (!subjectFilter) {
      return res.status(400).json({ error: 'Subject filter is required. Use ?subject=abc' });
    }

    const sinceDate = since ? new Date(since) : undefined;
    const count = await ImapService.countEmailsBySubject(subjectFilter, {
      since: sinceDate,
      includeRead: includeRead,
    });

    res.json({
      success: true,
      count,
      subjectFilter,
      message: `Found ${count} email(s) with subject containing "${subjectFilter}"`,
    });
  } catch (error: any) {
    console.error('Error counting emails by subject:', error);
    res.status(500).json({
      error: error.message || 'Failed to count emails by subject',
      details: error.stack,
    });
  }
});

// DELETE /api/email-replies/:id - Delete email reply
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await EmailReplyModel.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Email reply not found' });
    }
    res.json({ success: true, message: 'Email reply deleted' });
  } catch (error: any) {
    console.error('Error deleting email reply:', error);
    res.status(500).json({ error: error.message || 'Failed to delete email reply' });
  }
});

export default router;

