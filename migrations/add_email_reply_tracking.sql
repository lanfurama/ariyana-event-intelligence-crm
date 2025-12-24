-- Migration: Add email reply tracking
-- Run this migration to add message_id tracking and email_replies table

-- 1. Add message_id column to email_logs table
ALTER TABLE email_logs 
ADD COLUMN IF NOT EXISTS message_id VARCHAR(500);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_logs_message_id ON email_logs(message_id);

-- 2. Create email_replies table
CREATE TABLE IF NOT EXISTS email_replies (
    id VARCHAR(255) PRIMARY KEY,
    email_log_id VARCHAR(255) NOT NULL,
    lead_id VARCHAR(255) NOT NULL,
    from_email VARCHAR(255) NOT NULL,
    from_name VARCHAR(255),
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    html_body TEXT,
    reply_date TIMESTAMP NOT NULL,
    message_id VARCHAR(500),
    in_reply_to VARCHAR(500),
    references_header TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (email_log_id) REFERENCES email_logs(id) ON DELETE CASCADE,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_email_replies_email_log_id ON email_replies(email_log_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_lead_id ON email_replies(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_reply_date ON email_replies(reply_date);
CREATE INDEX IF NOT EXISTS idx_email_replies_message_id ON email_replies(message_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_in_reply_to ON email_replies(in_reply_to);

