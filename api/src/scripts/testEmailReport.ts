import { EmailReportsConfigModel } from '../models/EmailReportsConfigModel.js';
import { sendManagerReport } from '../services/managerReportService.js';
import { query } from '../config/database.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env
dotenv.config({ path: resolve(__dirname, '../../../.env') });

async function testEmailReport() {
  try {
    console.log('🧪 Testing Email Report for lanfurama@gmail.com...\n');

    // Test database connection
    await query('SELECT 1');
    console.log('✅ Database connected\n');

    // Create test configuration
    const testConfig = await EmailReportsConfigModel.create({
      id: `test-report-${Date.now()}`,
      recipient_email: 'lanfurama@gmail.com',
      recipient_name: 'Test Manager',
      frequency: 'daily',
      time_hour: new Date().getHours(),
      time_minute: new Date().getMinutes() + 1, // Send in 1 minute
      timezone: 'Asia/Ho_Chi_Minh',
      enabled: true,
      include_stats: true,
      include_new_leads: true,
      include_email_activity: true,
      include_top_leads: true,
      top_leads_count: 10,
    });

    console.log('✅ Test configuration created:');
    console.log(`   ID: ${testConfig.id}`);
    console.log(`   Email: ${testConfig.recipient_email}`);
    console.log(`   Frequency: ${testConfig.frequency}`);
    console.log(`   Time: ${String(testConfig.time_hour).padStart(2, '0')}:${String(testConfig.time_minute).padStart(2, '0')}\n`);

    // Send report immediately
    console.log('📧 Sending test report now...\n');
    const result = await sendManagerReport(testConfig);

    if (result.success) {
      console.log('✅ Test report sent successfully!');
      console.log('📬 Please check inbox: lanfurama@gmail.com\n');
    } else {
      console.error('❌ Failed to send test report:');
      console.error(`   Error: ${result.error}\n`);
    }

    // Clean up - delete test config
    console.log('🧹 Cleaning up test configuration...');
    await EmailReportsConfigModel.delete(testConfig.id);
    console.log('✅ Test configuration deleted\n');

    process.exit(result.success ? 0 : 1);
  } catch (error: any) {
    console.error('❌ Error during test:');
    console.error(error);
    process.exit(1);
  }
}

testEmailReport();
