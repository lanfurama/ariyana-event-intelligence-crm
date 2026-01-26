import { query } from '../config/database.js';
import { LeadModel } from '../models/LeadModel.js';
import { EmailLogModel } from '../models/EmailLogModel.js';
import { EmailReplyModel } from '../models/EmailReplyModel.js';

export interface ReportStats {
  period: {
    start: Date;
    end: Date;
    type: 'daily' | 'weekly' | 'monthly';
  };
  leads: {
    total: number;
    new: number;
    contacted: number;
    qualified: number;
    newInPeriod: number;
    byStatus: Record<string, number>;
    byCountry: Array<{ country: string; count: number }>;
    byIndustry: Array<{ industry: string; count: number }>;
  };
  emails: {
    sent: number;
    sentInPeriod: number;
    replies: number;
    repliesInPeriod: number;
    replyRate: number;
    uniqueLeadsContacted: number;
    byDay: Array<{ date: string; count: number }>;
  };
  topLeads: Array<{
    id: string;
    companyName: string;
    leadScore: number;
    status: string;
    country: string;
    industry: string;
    keyPersonName?: string;
    keyPersonEmail?: string;
    totalEvents?: number;
    vietnamEvents?: number;
  }>;
}

export class ReportStatsService {
  /**
   * Generate comprehensive statistics for a given time period
   */
  static async generateStats(
    periodStart: Date,
    periodEnd: Date,
    periodType: 'daily' | 'weekly' | 'monthly',
    topLeadsCount: number = 10
  ): Promise<ReportStats> {
    // Get all leads
    const allLeads = await LeadModel.getAll();
    
    // Get all email logs
    const allEmailLogs = await EmailLogModel.getAll();
    const sentEmailLogs = allEmailLogs.filter(log => log.status === 'sent');
    
    // Get all email replies
    const allEmailReplies = await EmailReplyModel.getAll();

    // Calculate period-based stats
    const periodStartStr = periodStart.toISOString();
    const periodEndStr = periodEnd.toISOString();

    // Leads stats
    const newLeadsInPeriod = allLeads.filter(lead => {
      if (!lead.created_at) return false;
      const createdAt = typeof lead.created_at === 'string' ? new Date(lead.created_at) : lead.created_at;
      return createdAt >= periodStart && createdAt <= periodEnd;
    });

    const leadsByStatus: Record<string, number> = {};
    allLeads.forEach(lead => {
      const status = lead.status || 'New';
      leadsByStatus[status] = (leadsByStatus[status] || 0) + 1;
    });

    // Country distribution
    const countryMap = new Map<string, number>();
    allLeads.forEach(lead => {
      const country = lead.country || 'Unknown';
      countryMap.set(country, (countryMap.get(country) || 0) + 1);
    });
    const byCountry = Array.from(countryMap.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Industry distribution
    const industryMap = new Map<string, number>();
    allLeads.forEach(lead => {
      const industry = lead.industry || 'Unknown';
      industryMap.set(industry, (industryMap.get(industry) || 0) + 1);
    });
    const byIndustry = Array.from(industryMap.entries())
      .map(([industry, count]) => ({ industry, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Email stats
    const emailsSentInPeriod = sentEmailLogs.filter(log => {
      const logDate = new Date(log.date);
      return logDate >= periodStart && logDate <= periodEnd;
    });

    const repliesInPeriod = allEmailReplies.filter(reply => {
      const replyDate = new Date(reply.reply_date);
      return replyDate >= periodStart && replyDate <= periodEnd;
    });

    const uniqueLeadsContacted = new Set(sentEmailLogs.map(log => log.lead_id)).size;
    const replyRate = sentEmailLogs.length > 0 
      ? (allEmailReplies.length / sentEmailLogs.length) * 100 
      : 0;

    // Email activity by day
    const emailByDayMap = new Map<string, number>();
    emailsSentInPeriod.forEach(log => {
      const dateStr = new Date(log.date).toISOString().split('T')[0];
      emailByDayMap.set(dateStr, (emailByDayMap.get(dateStr) || 0) + 1);
    });
    const byDay = Array.from(emailByDayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Top leads by score
    const topLeads = allLeads
      .filter(lead => lead.lead_score !== null && lead.lead_score !== undefined)
      .sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0))
      .slice(0, topLeadsCount)
      .map(lead => ({
        id: lead.id,
        companyName: lead.company_name || 'Unknown',
        leadScore: lead.lead_score || 0,
        status: lead.status || 'New',
        country: lead.country || 'Unknown',
        industry: lead.industry || 'Unknown',
        keyPersonName: lead.key_person_name || undefined,
        keyPersonEmail: lead.key_person_email || undefined,
        totalEvents: lead.total_events || 0,
        vietnamEvents: lead.vietnam_events || 0,
      }));

    return {
      period: {
        start: periodStart,
        end: periodEnd,
        type: periodType,
      },
      leads: {
        total: allLeads.length,
        new: allLeads.filter(l => l.status === 'New').length,
        contacted: allLeads.filter(l => l.status === 'Contacted').length,
        qualified: allLeads.filter(l => l.status === 'Qualified').length,
        newInPeriod: newLeadsInPeriod.length,
        byStatus: leadsByStatus,
        byCountry,
        byIndustry,
      },
      emails: {
        sent: sentEmailLogs.length,
        sentInPeriod: emailsSentInPeriod.length,
        replies: allEmailReplies.length,
        repliesInPeriod: repliesInPeriod.length,
        replyRate: Math.round(replyRate * 10) / 10,
        uniqueLeadsContacted,
        byDay,
      },
      topLeads,
    };
  }

  /**
   * Get period boundaries based on frequency type
   */
  static getPeriodBoundaries(
    frequency: 'daily' | 'weekly' | 'monthly',
    referenceDate: Date = new Date()
  ): { start: Date; end: Date } {
    const now = new Date(referenceDate);
    let start: Date;
    let end: Date = new Date(now);

    switch (frequency) {
      case 'daily':
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;

      case 'weekly':
        // Start of week (Monday)
        start = new Date(now);
        const dayOfWeek = start.getDay();
        const diff = start.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        
        // End of week (Sunday)
        end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;

      case 'monthly':
        // Start of month
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        
        // End of month
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
    }

    return { start, end };
  }
}
