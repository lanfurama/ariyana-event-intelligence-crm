-- Allow email_templates.lead_type = 'LEAD2026FEB_THAIACC'
ALTER TABLE email_templates DROP CONSTRAINT IF EXISTS email_templates_lead_type_check;
ALTER TABLE email_templates ADD CONSTRAINT email_templates_lead_type_check
  CHECK (lead_type IN ('CORP', 'DMC', 'HPNY2026', 'LEAD2026FEB_THAIACC') OR lead_type IS NULL);
