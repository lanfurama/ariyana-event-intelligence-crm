-- Migration: Allow lead type HPNY2026 (Postcard ACC leads)
-- Run this before importing HPNY2026 postcard CSV leads

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_type_check;
ALTER TABLE leads ADD CONSTRAINT leads_type_check
  CHECK (type IN ('CORP', 'DMC', 'HPNY2026') OR type IS NULL);

COMMENT ON COLUMN leads.type IS 'Lead type: CORP, DMC, HPNY2026 (Postcard), or NULL';
