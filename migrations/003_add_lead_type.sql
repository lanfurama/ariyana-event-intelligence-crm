-- Migration: Add type column to leads table
-- Created: 2026-02-13
-- Purpose: Support lead classification as CORP/DMC for partner leads

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS type VARCHAR(50) CHECK (type IN ('CORP', 'DMC') OR type IS NULL);

-- Create index for better query performance on type
CREATE INDEX IF NOT EXISTS idx_leads_type ON leads(type);

-- Comment column
COMMENT ON COLUMN leads.type IS 'Lead type classification: CORP (Corporate), DMC (Destination Management Company), or NULL for regular leads';
