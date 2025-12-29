-- Verify Email Logs Table Structure
-- Run this to check if email_logs table has the correct structure

-- Check if table exists and show structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'email_logs'
ORDER BY ordinal_position;

-- Check if lead_id column exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'email_logs' 
            AND column_name = 'lead_id'
        ) 
        THEN '✅ lead_id column exists'
        ELSE '❌ lead_id column MISSING'
    END as lead_id_check;

-- Check indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'email_logs';

-- Sample query to test email logs with lead_id
SELECT 
    el.id,
    el.lead_id,
    el.subject,
    el.status,
    el.date,
    l.company_name
FROM email_logs el
LEFT JOIN leads l ON el.lead_id = l.id
ORDER BY el.date DESC
LIMIT 10;




