-- Migration: Add lead_type column to email_templates table
-- Created: 2026-02-13
-- Purpose: Allow email templates to be assigned to specific lead types (CORP/DMC)

ALTER TABLE email_templates 
ADD COLUMN IF NOT EXISTS lead_type VARCHAR(50) CHECK (lead_type IN ('CORP', 'DMC') OR lead_type IS NULL);

-- Create index for better query performance on lead_type
CREATE INDEX IF NOT EXISTS idx_email_templates_lead_type ON email_templates(lead_type);

-- Comment column
COMMENT ON COLUMN email_templates.lead_type IS 'Lead type this template is assigned to: CORP, DMC, or NULL for default templates';
