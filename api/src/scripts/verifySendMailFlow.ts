/**
 * Verification script for Send Mail flow (plan checklist).
 * Run: npm run verify:send-mail
 *
 * Checks:
 * 1. Total email_logs with status='sent'
 * 2. Leads with sent emails should have status='Contacted'
 * 3. Reports any mismatches (leads with email_logs.sent but status != 'Contacted')
 */

import { query } from '../config/database.js';

async function verify() {
  try {
    console.log('🔍 Verifying Send Mail flow (email_logs ↔ leads consistency)\n');

    await query('SELECT 1');
    console.log('✅ Database connected\n');

    // 1. Count sent email logs
    const sentLogs = await query(
      "SELECT COUNT(*) as count FROM email_logs WHERE status = 'sent'"
    );
    const sentCount = parseInt((sentLogs.rows[0] as any).count);
    console.log(`📧 email_logs with status='sent': ${sentCount}`);

    // 2. Distinct leads with at least one sent email
    const distinctLeads = await query(`
      SELECT COUNT(DISTINCT lead_id) as count
      FROM email_logs
      WHERE status = 'sent'
    `);
    const leadsWithSent = parseInt((distinctLeads.rows[0] as any).count);
    console.log(`👥 Distinct leads with sent emails: ${leadsWithSent}\n`);

    // 3. Mismatches: leads with sent email_logs but status != 'Contacted'
    const mismatches = await query(`
      SELECT l.id, l.company_name, l.status, l.last_contacted
      FROM leads l
      JOIN email_logs el ON l.id = el.lead_id AND el.status = 'sent'
      WHERE l.status != 'Contacted' OR l.status IS NULL
      GROUP BY l.id, l.company_name, l.status, l.last_contacted
    `);

    if (mismatches.rows.length > 0) {
      console.log(`⚠️  Found ${mismatches.rows.length} lead(s) with sent emails but status != 'Contacted':`);
      mismatches.rows.forEach((r: any) => {
        console.log(`   - ${r.company_name} (id: ${r.id}) status=${r.status}`);
      });
      console.log('\n   Run migration 005 to fix: npm run migrate:fix-leads\n');
      process.exit(1);
    }

    console.log('✅ All leads with sent emails have status="Contacted"');
    console.log('\n✅ Send Mail flow verification passed!\n');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

verify();
