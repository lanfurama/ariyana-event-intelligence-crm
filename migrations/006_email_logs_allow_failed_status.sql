-- Allow status='failed' in email_logs for tracking failed send attempts
-- The leads.ts route creates logs with status='failed' when email delivery fails
ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_status_check;
ALTER TABLE email_logs ADD CONSTRAINT email_logs_status_check CHECK (status IN ('sent', 'draft', 'failed'));
