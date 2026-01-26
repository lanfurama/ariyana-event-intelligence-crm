import cron from 'node-cron';
import { processScheduledReports } from './managerReportService.js';

let cronJob: cron.ScheduledTask | null = null;

/**
 * Start the scheduled reports job
 * Runs every minute to check if reports need to be sent
 */
export function startScheduledReportsJob(): void {
  if (cronJob) {
    console.log('⚠️ Scheduled reports job is already running');
    return;
  }

  // Run every minute to check for scheduled reports
  cronJob = cron.schedule('* * * * *', async () => {
    try {
      await processScheduledReports();
    } catch (error) {
      console.error('❌ Error in scheduled reports job:', error);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Ho_Chi_Minh',
  });

  console.log('✅ Scheduled reports job started (checking every minute)');
}

/**
 * Stop the scheduled reports job
 */
export function stopScheduledReportsJob(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('🛑 Scheduled reports job stopped');
  }
}

/**
 * Manually trigger report processing (for testing or manual runs)
 */
export async function triggerReportsManually(): Promise<void> {
  console.log('🔔 Manually triggering report processing...');
  await processScheduledReports();
}
