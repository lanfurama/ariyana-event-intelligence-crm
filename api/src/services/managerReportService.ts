import { getTransporter } from '../utils/emailSender.js';
import { ReportStatsService, ReportStats } from './reportStatsService.js';
import { EmailReportsConfigModel, EmailReportsConfig } from '../models/EmailReportsConfigModel.js';

const defaultFromEmail = process.env.DEFAULT_FROM_EMAIL || process.env.EMAIL_HOST_USER || 'marketing@furamavietnam.com';

/**
 * Build HTML email template for manager report
 */
function buildManagerReportEmail(
  stats: ReportStats,
  config: EmailReportsConfig
): { subject: string; text: string; html: string } {
  const periodLabel = 
    stats.period.type === 'daily' ? 'Hôm nay' :
    stats.period.type === 'weekly' ? 'Tuần này' :
    'Tháng này';

  const periodDateRange = 
    `${stats.period.start.toLocaleDateString('vi-VN')} - ${stats.period.end.toLocaleDateString('vi-VN')}`;

  const recipientName = config.recipient_name || 'Manager';

  // Build HTML report
  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #C5A059 0%, #0F172A 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 10px 0 0 0; opacity: 0.9; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .section { background: white; margin-bottom: 20px; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .section h2 { color: #0F172A; margin-top: 0; border-bottom: 2px solid #C5A059; padding-bottom: 10px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
    .stat-card { background: #f0f0f0; padding: 15px; border-radius: 6px; text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; color: #C5A059; margin: 10px 0; }
    .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
    .table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    .table th { background: #0F172A; color: white; font-weight: bold; }
    .table tr:hover { background: #f5f5f5; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .badge-new { background: #e3f2fd; color: #1976d2; }
    .badge-contacted { background: #fff3e0; color: #f57c00; }
    .badge-qualified { background: #e8f5e9; color: #388e3c; }
    .badge-high-score { background: #f3e5f5; color: #7b1fa2; }
    .footer { text-align: center; margin-top: 30px; padding: 20px; color: #666; font-size: 12px; }
    .highlight { color: #C5A059; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Báo Cáo CRM - Ariyana Convention Centre</h1>
      <p>${periodLabel} (${periodDateRange})</p>
    </div>
    
    <div class="content">
      <p>Xin chào <strong>${recipientName}</strong>,</p>
      <p>Đây là báo cáo tự động về tình hình hoạt động CRM của bạn ${periodLabel.toLowerCase()}.</p>
`;

  // General Statistics Section
  if (config.include_stats) {
    html += `
      <div class="section">
        <h2>📈 Tổng Quan Thống Kê</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${stats.leads.total}</div>
            <div class="stat-label">Tổng Leads</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.leads.newInPeriod}</div>
            <div class="stat-label">Leads Mới ${periodLabel}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.leads.contacted}</div>
            <div class="stat-label">Đã Liên Hệ</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.leads.qualified}</div>
            <div class="stat-label">Đã Qualify</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.emails.sentInPeriod}</div>
            <div class="stat-label">Email Đã Gửi</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.emails.repliesInPeriod}</div>
            <div class="stat-label">Replies Nhận</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.emails.replyRate}%</div>
            <div class="stat-label">Tỷ Lệ Reply</div>
          </div>
        </div>
      </div>
    `;
  }

  // Email Activity Section
  if (config.include_email_activity) {
    html += `
      <div class="section">
        <h2>📧 Hoạt Động Email</h2>
        <p><strong>Tổng số email đã gửi:</strong> <span class="highlight">${stats.emails.sent}</span></p>
        <p><strong>Email gửi ${periodLabel.toLowerCase()}:</strong> <span class="highlight">${stats.emails.sentInPeriod}</span></p>
        <p><strong>Tổng số replies:</strong> <span class="highlight">${stats.emails.replies}</span></p>
        <p><strong>Replies ${periodLabel.toLowerCase()}:</strong> <span class="highlight">${stats.emails.repliesInPeriod}</span></p>
        <p><strong>Tỷ lệ reply:</strong> <span class="highlight">${stats.emails.replyRate}%</span></p>
        <p><strong>Số leads đã được liên hệ:</strong> <span class="highlight">${stats.emails.uniqueLeadsContacted}</span></p>
    `;

    if (stats.emails.byDay.length > 0) {
      html += `
        <h3 style="margin-top: 20px;">Email theo ngày:</h3>
        <table class="table">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Số Email Gửi</th>
            </tr>
          </thead>
          <tbody>
      `;
      stats.emails.byDay.forEach(day => {
        html += `
          <tr>
            <td>${new Date(day.date).toLocaleDateString('vi-VN')}</td>
            <td>${day.count}</td>
          </tr>
        `;
      });
      html += `
          </tbody>
        </table>
      `;
    }
    html += `</div>`;
  }

  // New Leads Section
  if (config.include_new_leads && stats.leads.newInPeriod > 0) {
    html += `
      <div class="section">
        <h2>🆕 Leads Mới ${periodLabel}</h2>
        <p>Có <strong>${stats.leads.newInPeriod}</strong> leads mới được thêm vào hệ thống ${periodLabel.toLowerCase()}.</p>
        
        <h3>Phân Bố Theo Trạng Thái:</h3>
        <table class="table">
          <thead>
            <tr>
              <th>Trạng Thái</th>
              <th>Số Lượng</th>
            </tr>
          </thead>
          <tbody>
    `;
    Object.entries(stats.leads.byStatus).forEach(([status, count]) => {
      html += `
        <tr>
          <td><span class="badge badge-${status.toLowerCase()}">${status}</span></td>
          <td>${count}</td>
        </tr>
      `;
    });
    html += `
          </tbody>
        </table>
    `;

    if (stats.leads.byCountry.length > 0) {
      html += `
        <h3>Top Quốc Gia:</h3>
        <table class="table">
          <thead>
            <tr>
              <th>Quốc Gia</th>
              <th>Số Leads</th>
            </tr>
          </thead>
          <tbody>
      `;
      stats.leads.byCountry.slice(0, 10).forEach(({ country, count }) => {
        html += `
          <tr>
            <td>${country}</td>
            <td>${count}</td>
          </tr>
        `;
      });
      html += `
          </tbody>
        </table>
      `;
    }
    html += `</div>`;
  }

  // Top Leads Section
  if (config.include_top_leads && stats.topLeads.length > 0) {
    html += `
      <div class="section">
        <h2>⭐ Top ${stats.topLeads.length} Leads Có Điểm Cao Nhất</h2>
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Công Ty</th>
              <th>Điểm</th>
              <th>Trạng Thái</th>
              <th>Quốc Gia</th>
              <th>Ngành</th>
              <th>Key Person</th>
            </tr>
          </thead>
          <tbody>
    `;
    stats.topLeads.forEach((lead, index) => {
      html += `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${lead.companyName}</strong></td>
          <td><span class="badge badge-high-score">${lead.leadScore}</span></td>
          <td>${lead.status}</td>
          <td>${lead.country}</td>
          <td>${lead.industry}</td>
          <td>${lead.keyPersonName || 'N/A'}</td>
        </tr>
      `;
    });
    html += `
          </tbody>
        </table>
      </div>
    `;
  }

  // Footer
  html += `
      <div class="footer">
        <p>Báo cáo này được tạo tự động bởi hệ thống CRM Ariyana Convention Centre.</p>
        <p>Thời gian tạo: ${new Date().toLocaleString('vi-VN')}</p>
        <p>Nếu bạn có câu hỏi, vui lòng liên hệ với đội ngũ IT.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  // Plain text version
  const text = `
BÁO CÁO CRM - ARIYANA CONVENTION CENTRE
${periodLabel} (${periodDateRange})

Xin chào ${recipientName},

Đây là báo cáo tự động về tình hình hoạt động CRM của bạn ${periodLabel.toLowerCase()}.

${config.include_stats ? `
TỔNG QUAN THỐNG KÊ:
- Tổng Leads: ${stats.leads.total}
- Leads Mới ${periodLabel}: ${stats.leads.newInPeriod}
- Đã Liên Hệ: ${stats.leads.contacted}
- Đã Qualify: ${stats.leads.qualified}
` : ''}

${config.include_email_activity ? `
HOẠT ĐỘNG EMAIL:
- Tổng email đã gửi: ${stats.emails.sent}
- Email gửi ${periodLabel.toLowerCase()}: ${stats.emails.sentInPeriod}
- Tổng số replies: ${stats.emails.replies}
- Replies ${periodLabel.toLowerCase()}: ${stats.emails.repliesInPeriod}
- Tỷ lệ reply: ${stats.emails.replyRate}%
- Số leads đã được liên hệ: ${stats.emails.uniqueLeadsContacted}
` : ''}

${config.include_new_leads ? `
LEADS MỚI ${periodLabel.toUpperCase()}: ${stats.leads.newInPeriod}
` : ''}

${config.include_top_leads && stats.topLeads.length > 0 ? `
TOP ${stats.topLeads.length} LEADS CÓ ĐIỂM CAO NHẤT:
${stats.topLeads.map((lead, i) => `${i + 1}. ${lead.companyName} - Điểm: ${lead.leadScore} - ${lead.status} - ${lead.country}`).join('\n')}
` : ''}

---
Báo cáo này được tạo tự động bởi hệ thống CRM Ariyana Convention Centre.
Thời gian tạo: ${new Date().toLocaleString('vi-VN')}
  `.trim();

  const subject = `📊 Báo Cáo CRM ${periodLabel} - ${periodDateRange}`;

  return { subject, text, html };
}

/**
 * Send manager report email
 */
export async function sendManagerReport(config: EmailReportsConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = getTransporter();
    if (!transporter) {
      return {
        success: false,
        error: 'Email transporter not configured. Please check EMAIL_HOST, EMAIL_HOST_USER, and EMAIL_HOST_PASSWORD.',
      };
    }

    // Get period boundaries
    const { start, end } = ReportStatsService.getPeriodBoundaries(
      config.frequency,
      new Date()
    );

    // Generate statistics
    const stats = await ReportStatsService.generateStats(
      start,
      end,
      config.frequency,
      config.top_leads_count
    );

    // Build email
    const { subject, text, html } = buildManagerReportEmail(stats, config);

    // Send email
    await transporter.sendMail({
      from: `"Ariyana CRM System" <${defaultFromEmail}>`,
      to: config.recipient_email,
      subject,
      text,
      html,
    });

    // Update last_sent_at
    await EmailReportsConfigModel.update(config.id, {
      last_sent_at: new Date(),
    });

    // Log success
    await EmailReportsConfigModel.createLog({
      id: `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      config_id: config.id,
      recipient_email: config.recipient_email,
      report_type: config.frequency,
      period_start: start,
      period_end: end,
      status: 'sent',
      stats_summary: {
        leadsTotal: stats.leads.total,
        leadsNew: stats.leads.newInPeriod,
        emailsSent: stats.emails.sentInPeriod,
        repliesReceived: stats.emails.repliesInPeriod,
        replyRate: stats.emails.replyRate,
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error sending manager report:', error);

    // Log failure
    try {
      const { start, end } = ReportStatsService.getPeriodBoundaries(
        config.frequency,
        new Date()
      );
      await EmailReportsConfigModel.createLog({
        id: `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        config_id: config.id,
        recipient_email: config.recipient_email,
        report_type: config.frequency,
        period_start: start,
        period_end: end,
        status: 'failed',
        error_message: error.message || 'Unknown error',
      });
    } catch (logError) {
      console.error('Error logging report failure:', logError);
    }

    return {
      success: false,
      error: error.message || 'Unknown error occurred while sending report',
    };
  }
}

/**
 * Process all enabled report configurations
 */
export async function processScheduledReports(): Promise<void> {
  try {
    const configs = await EmailReportsConfigModel.getAll(true); // Only enabled

    if (configs.length === 0) {
      // Only log if there are configs to avoid spam
      return;
    }

    // Log every 10 minutes to reduce console spam
    const now = new Date();
    if (now.getMinutes() % 10 === 0) {
      console.log(`📧 Checking ${configs.length} email report configuration(s)...`);
    }

    for (const config of configs) {
      try {
        const shouldSend = await shouldSendReport(config);
        if (shouldSend) {
          console.log(`📤 Sending ${config.frequency} report to ${config.recipient_email} at ${config.time_hour}:${String(config.time_minute).padStart(2, '0')} (${config.timezone})...`);
          const result = await sendManagerReport(config);
          if (result.success) {
            console.log(`✅ Report sent successfully to ${config.recipient_email}`);
          } else {
            console.error(`❌ Failed to send report to ${config.recipient_email}: ${result.error}`);
          }
        }
      } catch (error: any) {
        console.error(`❌ Error processing report for ${config.recipient_email}:`, error.message);
      }
    }
  } catch (error: any) {
    console.error('❌ Error processing scheduled reports:', error);
  }
}

/**
 * Check if report should be sent based on schedule
 */
async function shouldSendReport(config: EmailReportsConfig): Promise<boolean> {
  // Get current time in the config's timezone
  const now = new Date();
  const timezone = config.timezone || 'Asia/Ho_Chi_Minh';
  
  // Get current time in the specified timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(now);
  const timeParts: Record<string, string> = {};
  parts.forEach(part => {
    timeParts[part.type] = part.value;
  });
  
  const hour = parseInt(timeParts.hour || '0', 10);
  const minute = parseInt(timeParts.minute || '0', 10);
  const day = parseInt(timeParts.day || '0', 10);
  const month = parseInt(timeParts.month || '0', 10);
  const year = parseInt(timeParts.year || '0', 10);
  
  // Get weekday in the config's timezone
  // Use toLocaleDateString to get weekday number (0=Sunday, 6=Saturday)
  const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
  });
  const weekdayName = weekdayFormatter.format(now);
  
  // Convert weekday name to number (0=Sunday, 6=Saturday)
  const weekdayMap: Record<string, number> = {
    'Sunday': 0,
    'Monday': 1,
    'Tuesday': 2,
    'Wednesday': 3,
    'Thursday': 4,
    'Friday': 5,
    'Saturday': 6,
  };
  const jsWeekday = weekdayMap[weekdayName] ?? now.getDay();

  // Check time matches (with 1 minute tolerance to handle cron timing)
  if (hour !== config.time_hour || minute !== config.time_minute) {
    return false;
  }

  // Check if already sent today (in config's timezone)
  if (config.last_sent_at) {
    const lastSent = new Date(config.last_sent_at);
    
    // Convert last_sent_at to config's timezone for comparison
    const lastSentFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
    
    const lastSentParts = lastSentFormatter.formatToParts(lastSent);
    const lastSentPartsMap: Record<string, string> = {};
    lastSentParts.forEach(part => {
      lastSentPartsMap[part.type] = part.value;
    });
    
    const lastSentDay = parseInt(lastSentPartsMap.day || '0', 10);
    const lastSentMonth = parseInt(lastSentPartsMap.month || '0', 10);
    const lastSentYear = parseInt(lastSentPartsMap.year || '0', 10);
    
    // Check if sent today in config's timezone
    if (
      lastSentYear === year &&
      lastSentMonth === month &&
      lastSentDay === day
    ) {
      // For daily, already sent today
      if (config.frequency === 'daily') {
        return false;
      }
      
      // For weekly/monthly, check if sent in the same period
      if (config.frequency === 'weekly') {
        // If sent this week, don't send again
        const lastSentWeekday = new Date(lastSent).toLocaleDateString('en-US', {
          timeZone: timezone,
          weekday: 'numeric',
        });
        // Simple check: if same weekday, likely same week (approximation)
        // More precise would require week number calculation
        const daysDiff = Math.floor((now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff < 7) {
          return false; // Sent within last 7 days
        }
      }
      
      if (config.frequency === 'monthly') {
        // If sent this month, don't send again
        if (lastSentMonth === month && lastSentYear === year) {
          return false;
        }
      }
    }
  }

  // Check day of week for weekly
  if (config.frequency === 'weekly' && config.day_of_week !== undefined) {
    if (jsWeekday !== config.day_of_week) {
      return false;
    }
  }

  // Check day of month for monthly
  if (config.frequency === 'monthly' && config.day_of_month !== undefined) {
    if (day !== config.day_of_month) {
      return false;
    }
  }

  return true;
}
