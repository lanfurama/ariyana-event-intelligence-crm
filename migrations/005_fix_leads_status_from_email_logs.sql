-- Fix: Update leads to status 'Contacted' where they have sent email logs but status is still 'New'
-- Run this once to repair leads that were sent emails but status was not updated
UPDATE leads l
SET status = 'Contacted',
    last_contacted = (
        SELECT MAX(el.date)
        FROM email_logs el
        WHERE el.lead_id = l.id AND el.status = 'sent'
    )
WHERE l.status = 'New'
  AND EXISTS (
      SELECT 1 FROM email_logs el
      WHERE el.lead_id = l.id AND el.status = 'sent'
  );
