-- Migration: Allow lead type SUMMER_BEACH_2026 (Summer Beach 2026 portfolio leads)
-- Run this before importing scripts/import_summer_beach_2026_leads.sql

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_type_check;
ALTER TABLE leads ADD CONSTRAINT leads_type_check
  CHECK (type IN ('CORP', 'DMC', 'HPNY2026', 'LEAD2026FEB_THAIACC', 'SUMMER_BEACH_2026') OR type IS NULL);

COMMENT ON COLUMN leads.type IS 'Lead type: CORP, DMC, HPNY2026, LEAD2026FEB_THAIACC, SUMMER_BEACH_2026, or NULL';

