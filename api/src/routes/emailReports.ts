import express, { Request, Response } from 'express';
import { EmailReportsConfigModel, EmailReportsConfig } from '../models/EmailReportsConfigModel.js';
import { sendManagerReport } from '../services/managerReportService.js';
import { triggerReportsManually } from '../services/scheduledReportsJob.js';

const router = express.Router();

// GET /api/email-reports/config - Get all report configurations
router.get('/config', async (req: Request, res: Response) => {
  try {
    const enabledOnly = req.query.enabled === 'true';
    const configs = await EmailReportsConfigModel.getAll(enabledOnly);
    res.json(configs);
  } catch (error: any) {
    console.error('Error fetching email report configs:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch configurations' });
  }
});

// GET /api/email-reports/config/:id - Get specific configuration
router.get('/config/:id', async (req: Request, res: Response) => {
  try {
    const config = await EmailReportsConfigModel.getById(req.params.id);
    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    res.json(config);
  } catch (error: any) {
    console.error('Error fetching email report config:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch configuration' });
  }
});

// POST /api/email-reports/config - Create new configuration
router.post('/config', async (req: Request, res: Response) => {
  try {
    const {
      recipient_email,
      recipient_name,
      frequency,
      day_of_week,
      day_of_month,
      time_hour,
      time_minute,
      timezone,
      enabled,
      include_stats,
      include_new_leads,
      include_email_activity,
      include_top_leads,
      top_leads_count,
    } = req.body;

    // Validation
    if (!recipient_email || !frequency) {
      return res.status(400).json({ error: 'recipient_email and frequency are required' });
    }

    if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
      return res.status(400).json({ error: 'frequency must be daily, weekly, or monthly' });
    }

    if (frequency === 'weekly' && (day_of_week === undefined || day_of_week < 0 || day_of_week > 6)) {
      return res.status(400).json({ error: 'day_of_week (0-6) is required for weekly frequency' });
    }

    if (frequency === 'monthly' && (day_of_month === undefined || day_of_month < 1 || day_of_month > 28)) {
      return res.status(400).json({ error: 'day_of_month (1-28) is required for monthly frequency' });
    }

    if (time_hour === undefined || time_hour < 0 || time_hour > 23) {
      return res.status(400).json({ error: 'time_hour (0-23) is required' });
    }

    if (time_minute === undefined || time_minute < 0 || time_minute > 59) {
      return res.status(400).json({ error: 'time_minute (0-59) is required' });
    }

    const config: Omit<EmailReportsConfig, 'id' | 'created_at' | 'updated_at' | 'last_sent_at'> = {
      recipient_email,
      recipient_name,
      frequency,
      day_of_week: frequency === 'weekly' ? day_of_week : undefined,
      day_of_month: frequency === 'monthly' ? day_of_month : undefined,
      time_hour,
      time_minute,
      timezone: timezone || 'Asia/Ho_Chi_Minh',
      enabled: enabled !== undefined ? enabled : true,
      include_stats: include_stats !== undefined ? include_stats : true,
      include_new_leads: include_new_leads !== undefined ? include_new_leads : true,
      include_email_activity: include_email_activity !== undefined ? include_email_activity : true,
      include_top_leads: include_top_leads !== undefined ? include_top_leads : true,
      top_leads_count: top_leads_count || 10,
    };

    const newConfig = await EmailReportsConfigModel.create({
      id: `report-config-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...config,
    });

    res.status(201).json(newConfig);
  } catch (error: any) {
    console.error('Error creating email report config:', error);
    res.status(500).json({ error: error.message || 'Failed to create configuration' });
  }
});

// PUT /api/email-reports/config/:id - Update configuration
router.put('/config/:id', async (req: Request, res: Response) => {
  try {
    const existing = await EmailReportsConfigModel.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    const updates: Partial<EmailReportsConfig> = {};

    if (req.body.recipient_email !== undefined) updates.recipient_email = req.body.recipient_email;
    if (req.body.recipient_name !== undefined) updates.recipient_name = req.body.recipient_name;
    if (req.body.frequency !== undefined) {
      if (!['daily', 'weekly', 'monthly'].includes(req.body.frequency)) {
        return res.status(400).json({ error: 'frequency must be daily, weekly, or monthly' });
      }
      updates.frequency = req.body.frequency;
    }
    if (req.body.day_of_week !== undefined) updates.day_of_week = req.body.day_of_week;
    if (req.body.day_of_month !== undefined) updates.day_of_month = req.body.day_of_month;
    if (req.body.time_hour !== undefined) updates.time_hour = req.body.time_hour;
    if (req.body.time_minute !== undefined) updates.time_minute = req.body.time_minute;
    if (req.body.timezone !== undefined) updates.timezone = req.body.timezone;
    if (req.body.enabled !== undefined) updates.enabled = req.body.enabled;
    if (req.body.include_stats !== undefined) updates.include_stats = req.body.include_stats;
    if (req.body.include_new_leads !== undefined) updates.include_new_leads = req.body.include_new_leads;
    if (req.body.include_email_activity !== undefined) updates.include_email_activity = req.body.include_email_activity;
    if (req.body.include_top_leads !== undefined) updates.include_top_leads = req.body.include_top_leads;
    if (req.body.top_leads_count !== undefined) updates.top_leads_count = req.body.top_leads_count;

    const updated = await EmailReportsConfigModel.update(req.params.id, updates);
    res.json(updated);
  } catch (error: any) {
    console.error('Error updating email report config:', error);
    res.status(500).json({ error: error.message || 'Failed to update configuration' });
  }
});

// DELETE /api/email-reports/config/:id - Delete configuration
router.delete('/config/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await EmailReportsConfigModel.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    res.json({ message: 'Configuration deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting email report config:', error);
    res.status(500).json({ error: error.message || 'Failed to delete configuration' });
  }
});

// POST /api/email-reports/send/:id - Manually send report for a configuration
router.post('/send/:id', async (req: Request, res: Response) => {
  try {
    const config = await EmailReportsConfigModel.getById(req.params.id);
    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    const result = await sendManagerReport(config);
    if (result.success) {
      res.json({ message: 'Report sent successfully', success: true });
    } else {
      res.status(500).json({ error: result.error || 'Failed to send report', success: false });
    }
  } catch (error: any) {
    console.error('Error sending report:', error);
    res.status(500).json({ error: error.message || 'Failed to send report' });
  }
});

// POST /api/email-reports/trigger - Manually trigger all scheduled reports
router.post('/trigger', async (req: Request, res: Response) => {
  try {
    await triggerReportsManually();
    res.json({ message: 'Reports processing triggered successfully' });
  } catch (error: any) {
    console.error('Error triggering reports:', error);
    res.status(500).json({ error: error.message || 'Failed to trigger reports' });
  }
});

// GET /api/email-reports/logs - Get report logs
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const configId = req.query.config_id as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await EmailReportsConfigModel.getLogs(configId, limit);
    res.json(logs);
  } catch (error: any) {
    console.error('Error fetching report logs:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch logs' });
  }
});

export default router;
