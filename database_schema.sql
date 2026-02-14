-- Ariyana CRM Database Schema
-- This file contains the SQL schema for all tables

-- Email Logs Table
-- Tracks all emails sent to leads
CREATE TABLE IF NOT EXISTS email_logs (
    id VARCHAR(255) PRIMARY KEY,
    lead_id VARCHAR(255) NOT NULL,
    date TIMESTAMP NOT NULL,
    subject TEXT NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('sent', 'draft', 'failed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- Email Log Attachments Table
-- Stores attachments for email logs
CREATE TABLE IF NOT EXISTS email_log_attachments (
    id SERIAL PRIMARY KEY,
    email_log_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    size INTEGER NOT NULL,
    type VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (email_log_id) REFERENCES email_logs(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_email_logs_lead_id ON email_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_date ON email_logs(date);
CREATE INDEX IF NOT EXISTS idx_email_log_attachments_email_log_id ON email_log_attachments(email_log_id);

