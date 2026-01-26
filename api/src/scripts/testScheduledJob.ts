import { EmailReportsConfigModel } from '../models/EmailReportsConfigModel.js';
import { processScheduledReports } from '../services/managerReportService.js';

async function testScheduledJob() {
  try {
    console.log('🧪 Testing Scheduled Reports Job...\n');
    
    // Get all enabled configs
    const configs = await EmailReportsConfigModel.getAll(true);
    console.log(`📋 Found ${configs.length} enabled configuration(s)\n`);
    
    if (configs.length === 0) {
      console.log('⚠️  No enabled configurations found. Please create a configuration first.');
      return;
    }
    
    // Show configs
    configs.forEach((config, index) => {
      console.log(`Configuration ${index + 1}:`);
      console.log(`  - Email: ${config.recipient_email}`);
      console.log(`  - Frequency: ${config.frequency}`);
      console.log(`  - Time: ${config.time_hour}:${String(config.time_minute).padStart(2, '0')} (${config.timezone})`);
      if (config.frequency === 'weekly') {
        console.log(`  - Day of week: ${config.day_of_week}`);
      }
      if (config.frequency === 'monthly') {
        console.log(`  - Day of month: ${config.day_of_month}`);
      }
      console.log(`  - Last sent: ${config.last_sent_at || 'Never'}`);
      console.log('');
    });
    
    // Process reports
    console.log('🔄 Processing scheduled reports...\n');
    await processScheduledReports();
    
    console.log('\n✅ Test completed!');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testScheduledJob();
