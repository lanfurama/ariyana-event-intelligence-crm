/**
 * Script: Gửi email test tới lanfurama@gmail.com dùng template DMC
 * Run: npm run send:dmc-test
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { query } from '../config/database.js';
import { EmailTemplateModel } from '../models/EmailTemplateModel.js';
import { LeadModel } from '../models/LeadModel.js';
import { EmailLogModel } from '../models/EmailLogModel.js';
import { sendLeadEmailsWithCustomContent } from '../utils/emailSender.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../../.env') });

const TEST_EMAIL = 'lanfurama@gmail.com';

function replacePlaceholders(text: string, lead: Record<string, any>): string {
  return text
    .replace(/\{\{companyName\}\}/g, lead.company_name || '')
    .replace(/\{\{keyPersonName\}\}/g, lead.key_person_name || '')
    .replace(/\{\{keyPersonTitle\}\}/g, lead.key_person_title || '')
    .replace(/\{\{city\}\}/g, lead.city || '')
    .replace(/\{\{country\}\}/g, lead.country || '')
    .replace(/\{\{industry\}\}/g, lead.industry || '');
}

async function sendDmcTestEmail() {
  try {
    console.log('📧 Sending DMC template email to lanfurama@gmail.com...\n');

    await query('SELECT 1');
    console.log('✅ Database connected\n');

    // 1. Get DMC template
    const templates = await EmailTemplateModel.getAll();
    const dmcTemplate = templates.find((t) => t.lead_type === 'DMC');
    if (!dmcTemplate) {
      console.error('❌ Không tìm thấy email template DMC. Tạo template với lead_type = "DMC" trong email_templates.');
      process.exit(1);
    }
    console.log(`✅ Dùng template: ${dmcTemplate.name} (lead_type: DMC)\n`);

    // 2. Create temp lead
    const leadId = `test-dmc-${Date.now()}`;
    const lead = await LeadModel.create({
      id: leadId,
      company_name: 'Test DMC Company',
      industry: 'MICE / DMC',
      country: 'Vietnam',
      city: 'Da Nang',
      website: null,
      key_person_name: 'Lan',
      key_person_title: 'Test Recipient',
      key_person_email: TEST_EMAIL,
      key_person_phone: null,
      key_person_linkedin: null,
      total_events: 0,
      vietnam_events: 0,
      notes: 'Temp lead for DMC test email - có thể xóa',
      status: 'New',
      type: 'DMC',
    });
    console.log(`✅ Temp lead created: ${lead.id}\n`);

    // 3. Replace placeholders
    const subject = replacePlaceholders(dmcTemplate.subject, lead);
    const body = replacePlaceholders(dmcTemplate.body, lead);

    // 4. Send via sendLeadEmailsWithCustomContent (same as API)
    const summary = await sendLeadEmailsWithCustomContent([lead], [{ leadId, subject, body }]);

    if (summary.sent === 0 && summary.failures?.length) {
      console.error('❌ Gửi thất bại:', summary.failures[0]?.error ?? 'Unknown error');
      await LeadModel.delete(leadId);
      process.exit(1);
    }

    // 5. Update lead + create email_log (same as API)
    const timestamp = new Date().toISOString();
    await query('UPDATE leads SET status = $1, last_contacted = $2 WHERE id = $3', [
      'Contacted',
      new Date(timestamp),
      leadId,
    ]);
    const sent = summary.sentEmails?.[0];
    if (sent?.subject) {
      await EmailLogModel.create({
        id: `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        lead_id: leadId,
        date: new Date(timestamp),
        subject: sent.subject,
        status: 'sent',
        message_id: sent.messageId ?? null,
      });
    }

    console.log('✅ Email đã gửi thành công!');
    console.log(`📬 Kiểm tra inbox: ${TEST_EMAIL}\n`);
    console.log(`   Lead ID (có thể xóa): ${leadId}\n`);

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

sendDmcTestEmail();
