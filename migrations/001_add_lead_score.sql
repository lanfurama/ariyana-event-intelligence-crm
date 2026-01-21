-- Migration: Add lead_score columns to leads table
-- Created: 2026-01-21

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS lead_score INTEGER CHECK (lead_score >= 0 AND lead_score <= 100),
ADD COLUMN IF NOT EXISTS last_score_update TIMESTAMP;

-- Create index for better query performance on lead_score
CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON leads(lead_score DESC);

-- Comment columns
COMMENT ON COLUMN leads.lead_score IS 'AI-powered lead quality score from 0-100';
COMMENT ON COLUMN leads.last_score_update IS 'Timestamp of last lead score calculation';
