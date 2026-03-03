-- Migration: Add email_template_attachments table
-- Stores file attachments for email templates

CREATE TABLE IF NOT EXISTS email_template_attachments (
    id SERIAL PRIMARY KEY,
    template_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    size INTEGER NOT NULL,
    type VARCHAR(100) NOT NULL,
    file_data TEXT NOT NULL, -- Base64 encoded file content
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_template_attachments_template_id ON email_template_attachments(template_id);
