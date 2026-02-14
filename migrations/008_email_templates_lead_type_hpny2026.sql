-- Allow email_templates.lead_type = 'HPNY2026'
ALTER TABLE email_templates DROP CONSTRAINT IF EXISTS email_templates_lead_type_check;
ALTER TABLE email_templates ADD CONSTRAINT email_templates_lead_type_check
  CHECK (lead_type IN ('CORP', 'DMC', 'HPNY2026') OR lead_type IS NULL);
