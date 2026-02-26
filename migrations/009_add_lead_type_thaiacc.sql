-- Migration: Allow lead type LEAD2026FEB_THAIACC (ACC Thai potential leads)
-- Run this before importing Potential Lead for ACC_26Feb.csv

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_type_check;
ALTER TABLE leads ADD CONSTRAINT leads_type_check
  CHECK (type IN ('CORP', 'DMC', 'HPNY2026', 'LEAD2026FEB_THAIACC') OR type IS NULL);

COMMENT ON COLUMN leads.type IS 'Lead type: CORP, DMC, HPNY2026, LEAD2026FEB_THAIACC, or NULL';
