-- Migration: Add email reports configuration for manager auto-reports
-- Created: 2026-01-26
-- Description: Allows configuration of automatic email reports to managers

-- Create email_reports_config table
CREATE TABLE IF NOT EXISTS email_reports_config (
    id VARCHAR(255) PRIMARY KEY,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    frequency VARCHAR(50) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday (for weekly)
    day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 28), -- For monthly (max 28 to avoid month-end issues)
    time_hour INTEGER NOT NULL CHECK (time_hour >= 0 AND time_hour <= 23) DEFAULT 9,
    time_minute INTEGER NOT NULL CHECK (time_minute >= 0 AND time_minute <= 59) DEFAULT 0,
    timezone VARCHAR(100) DEFAULT 'Asia/Ho_Chi_Minh',
    enabled BOOLEAN DEFAULT true,
    include_stats BOOLEAN DEFAULT true, -- Include general statistics
    include_new_leads BOOLEAN DEFAULT true, -- Include new leads summary
    include_email_activity BOOLEAN DEFAULT true, -- Include email sent/replies stats
    include_top_leads BOOLEAN DEFAULT true, -- Include top scoring leads
    top_leads_count INTEGER DEFAULT 10, -- Number of top leads to include
    last_sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_reports_config_enabled ON email_reports_config(enabled);
CREATE INDEX IF NOT EXISTS idx_email_reports_config_frequency ON email_reports_config(frequency);
CREATE INDEX IF NOT EXISTS idx_email_reports_config_last_sent ON email_reports_config(last_sent_at);

-- Create email_reports_log table to track sent reports
CREATE TABLE IF NOT EXISTS email_reports_log (
    id VARCHAR(255) PRIMARY KEY,
    config_id VARCHAR(255) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly'
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL CHECK (status IN ('sent', 'failed')),
    error_message TEXT,
    stats_summary JSONB, -- Store summary stats as JSON
    FOREIGN KEY (config_id) REFERENCES email_reports_config(id) ON DELETE CASCADE
);

-- Create indexes for email_reports_log
CREATE INDEX IF NOT EXISTS idx_email_reports_log_config_id ON email_reports_log(config_id);
CREATE INDEX IF NOT EXISTS idx_email_reports_log_sent_at ON email_reports_log(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_reports_log_status ON email_reports_log(status);

-- Add comments
COMMENT ON TABLE email_reports_config IS 'Configuration for automatic email reports to managers';
COMMENT ON TABLE email_reports_log IS 'Log of all email reports sent to managers';
