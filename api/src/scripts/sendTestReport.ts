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

async function sendTestReport() {
  try {
    console.log('🧪 Sending Test Email Report to lanfurama@gmail.com...\n');

    // Test database connection
    await query('SELECT 1');
    console.log('✅ Database connected\n');

    // Create temporary test configuration
    const testConfig = await EmailReportsConfigModel.create({
      id: `test-${Date.now()}`,
      recipient_email: 'lanfurama@gmail.com',
      recipient_name: 'Test Manager',
      frequency: 'daily',
      time_hour: 9,
      time_minute: 0,
      timezone: 'Asia/Ho_Chi_Minh',
      enabled: true,
      include_stats: true,
      include_new_leads: true,
      include_email_activity: true,
      include_top_leads: true,
      top_leads_count: 10,
    });

    console.log('✅ Test configuration created\n');
    console.log('📧 Sending report now...\n');

    // Send report immediately
    const result = await sendManagerReport(testConfig);

    if (result.success) {
      console.log('✅ Test report sent successfully!');
      console.log('📬 Please check inbox: lanfurama@gmail.com');
      console.log('   (Also check spam folder if not found)\n');
    } else {
      console.error('❌ Failed to send test report:');
      console.error(`   Error: ${result.error}\n`);
    }

    // Clean up - delete test config
    console.log('🧹 Cleaning up test configuration...');
    await EmailReportsConfigModel.delete(testConfig.id);
    console.log('✅ Done\n');

    process.exit(result.success ? 0 : 1);
  } catch (error: any) {
    console.error('❌ Error:');
    console.error(error.message || error);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

sendTestReport();
