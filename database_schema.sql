-- PostgreSQL Database Schema for Ariyana Event Intelligence CRM
-- Created based on constants.ts and types.ts

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS email_log_attachments CASCADE;
DROP TABLE IF EXISTS email_logs CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS email_templates CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create Users table
CREATE TABLE users (
    username VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('Director', 'Sales', 'Viewer')),
    avatar TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Email Templates table
CREATE TABLE email_templates (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Leads table
CREATE TABLE leads (
    id VARCHAR(50) PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    industry VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    website TEXT,
    key_person_name VARCHAR(255) NOT NULL,
    key_person_title VARCHAR(255),
    key_person_email VARCHAR(255),
    key_person_phone VARCHAR(50),
    key_person_linkedin TEXT,
    total_events INTEGER DEFAULT 0,
    vietnam_events INTEGER DEFAULT 0,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Qualified', 'Won', 'Lost')),
    last_contacted DATE,
    past_events_history TEXT,
    secondary_person_name VARCHAR(255),
    secondary_person_title VARCHAR(255),
    secondary_person_email VARCHAR(255),
    research_notes TEXT,
    number_of_delegates INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Email Logs table
CREATE TABLE email_logs (
    id VARCHAR(50) PRIMARY KEY,
    lead_id VARCHAR(50) NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    subject TEXT NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'draft')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_email_log_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- Create Email Log Attachments table (for storing attachment details)
CREATE TABLE email_log_attachments (
    id SERIAL PRIMARY KEY,
    email_log_id VARCHAR(50) NOT NULL REFERENCES email_logs(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    size INTEGER NOT NULL,
    type VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_attachment_email_log FOREIGN KEY (email_log_id) REFERENCES email_logs(id) ON DELETE CASCADE
);

-- Create Chat Messages table (for storing AI chat assistant messages)
CREATE TABLE chat_messages (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'model')),
    text TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_chat_message_user FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_industry ON leads(industry);
CREATE INDEX idx_leads_country ON leads(country);
CREATE INDEX idx_leads_company_name ON leads(company_name);
CREATE INDEX idx_email_logs_lead_id ON email_logs(lead_id);
CREATE INDEX idx_email_logs_date ON email_logs(date);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_chat_messages_username ON chat_messages(username);
CREATE INDEX idx_chat_messages_timestamp ON chat_messages(timestamp);

-- Insert initial Users data
INSERT INTO users (username, name, role, avatar) VALUES
('director', 'Sarah Jenkins', 'Director', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah'),
('sales', 'Mike Sales', 'Sales', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mike'),
('viewer', 'Guest Viewer', 'Viewer', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Guest');

-- Insert initial Email Templates data
INSERT INTO email_templates (id, name, subject, body) VALUES
('intro', 'Introduction', 'Proposal to host [Company Name] event at Ariyana Convention Centre', 
'Dear [Key Person Name],

I hope this email finds you well.

My name is [Your Name], representing Ariyana Convention Centre in Danang, Vietnam. We are Vietnam''s premier oceanfront convention venue and had the honor of hosting the APEC 2017 Economic Leaders'' Week.

I am writing to express our keen interest in hosting [Company Name]''s upcoming events. With our versatile ballrooms and stunning location, we believe we can offer an exceptional experience for your delegates.

Would you be open to a brief call to discuss how we can support your future events?

Best regards,'),

('followup', 'Follow Up', 'Following up: [Company Name] Event Proposal',
'Dear [Key Person Name],

I''m writing to follow up on my previous note regarding the possibility of hosting [Company Name] at Ariyana Convention Centre.

Danang is rapidly becoming a top destination for MICE in Asia, offering excellent connectivity and world-class infrastructure. We would love the opportunity to showcase what we can offer for your next conference.

Looking forward to hearing from you.

Best regards,'),

('promo', 'Special Offer', 'Exclusive MICE Package for [Company Name]',
'Dear [Key Person Name],

We are currently offering exclusive packages for international associations looking to host events in Danang for 2026/2027.

We see a great alignment with [Company Name]''s values and event requirements. Our venue offers:
- Largest ballroom in Central Vietnam
- Direct beach access
- Comprehensive event support services

Let''s make your next event unforgettable.

Best regards,');

-- Insert initial Leads data
INSERT INTO leads (
    id, company_name, industry, country, city, website, key_person_name, 
    key_person_title, key_person_email, key_person_phone, key_person_linkedin,
    total_events, vietnam_events, notes, status, last_contacted, past_events_history,
    research_notes, secondary_person_name, secondary_person_title, secondary_person_email,
    number_of_delegates
) VALUES
('1', 'Architects Regional Council Asia (ARCASIA)', 'Architecture', 'India', 'Mumbai', 
 'https://www.arcasia.org', 'Ar. J.P. Singh', 'Secretary General', 'arcasia.secretariat@gmail.com',
 '+91 22 2640 0340', 'https://www.linkedin.com/in/j-p-singh-499a0715/', 1, 1,
 'Potential for ARCASIA Forum return.', 'New', NULL, 
 '2023: Manila, Philippines; 2022: Ulaanbaatar, Mongolia', '', '', '', '', 500),

('2', 'ASEAN Federation of Accountants (AFA)', 'Finance', 'Malaysia', 'Kuala Lumpur',
 'http://www.aseanaccountants.org', 'Wan Chew Meng', 'Executive Director',
 'wanchewmeng@afa-secretariat.org', '+603 2093 3030', 'https://www.linkedin.com/in/wan-chew-meng-80b6a9138',
 1, 2, 'Organized 3rd AFA Conference previously.', 'Contacted', '2023-10-15',
 '2021: Virtual; 2019: Brunei Darussalam', '', NULL, NULL, NULL, 350),

('3', 'Asean Federation of Cement Manufacturers (AFCM)', 'Construction', 'Thailand', 'Bangkok',
 '', 'Mr. Apichart Ruangkritya', 'Secretary General', 'secretariat@afcm.org',
 '+66 2 658 0900', '', 1, 1, 'Technical Symposium & Exhibition target.', 'New', NULL,
 '', NULL, NULL, NULL, NULL, 200),

('4', 'ASEAN Law Association (ALA)', 'Legal', 'Singapore', 'Singapore',
 'https://www.aseanlawassociation.org', 'Adrian Tan', 'Secretary-General',
 'secretariat@aseanlawassociation.org', '', 'https://www.linkedin.com/in/adrian-tan-808a9a10/',
 1, 1, '13th ASEAN Law Association General Assembly.', 'New', NULL, '', NULL, NULL, NULL, NULL, 450),

('5', 'ASEAN Valuers Association (AVA)', 'Real Estate', 'Malaysia', 'Kuala Lumpur',
 '', 'Faizal Bin Abdul Rahman', 'Secretary General', 'secretariat@aseanvaluers.org',
 '+603-2287 9036', 'https://www.linkedin.com/in/faizal-abdul-rahman-500b5212/', 1, 1,
 'Congress of the ASEAN Valuers Association.', 'New', NULL, '', NULL, NULL, NULL, NULL, 300),

('6', 'Asia-Oceania Federation of Organizations for Medical Physics', 'Medical', 'Vietnam', 'Hue',
 '', 'Dr. Hoang Van Duc', 'Secretary General', 'hoangvanduc@afomp.org',
 '', 'https://www.linkedin.com/in/duc-hoang-van-0b5b1b17/', 1, 1,
 'Strong local connection. Priority.', 'Qualified', NULL, '', NULL, NULL, NULL, NULL, 600),

('7', 'Asia-Pacific Broadcasting Union (ABU)', 'Media', 'Malaysia', 'Kuala Lumpur',
 'https://www.abu.org.my', 'Ahmed Nadeem', 'Director of Programmes',
 'info@abu.org.my', '+603 2282 2480', 'https://www.linkedin.com/in/ahmed-nadeem-251b5b11/',
 3, 1, 'RadioAsia organizer.', 'New', NULL, '2023: Seoul, Korea; 2022: New Delhi, India',
 NULL, NULL, NULL, NULL, 800),

('8', 'International Air Transport Association (IATA)', 'Aviation', 'Switzerland', 'Geneva',
 'iata.org', 'Monika White', 'Head of Conferences & Events',
 'monika.white@iata.org', '', 'https://www.linkedin.com/in/monika-white-5b12a81/',
 1, 0, 'High value target for global aviation summit.', 'New', NULL,
 '2024: Dubai, UAE; 2023: Istanbul, Turkey', NULL, NULL, NULL, NULL, 2000),

('9', 'Asia Pacific Network (SAFE-Network)', 'Agriculture/Energy', 'Japan', 'Takamatsu',
 '', 'Prof. Dr. Makoto Kawase', 'Secretary General', 'safe.network.secretariat@gmail.com',
 '', 'https://www.linkedin.com/in/makoto-kawase-a500b4111/', 1, 1,
 'International Conference on Sustainable Agriculture.', 'New', NULL, '', NULL, NULL, NULL, NULL, 150),

('10', 'Asian-Oceanian Computing Industry Organization (ASOCIO)', 'Technology', 'Malaysia', 'Petaling Jaya',
 '', 'Alice Tan', 'Executive Director', 'secretariat@asocio.org',
 '+603-7873 8733', 'https://www.linkedin.com/in/alice-tan-b9560010/', 1, 1,
 'ASOCIO Digital Summit.', 'New', NULL, '', NULL, NULL, NULL, NULL, 1200),

('11', 'Asian Association of Open Universities (AAOU)', 'Education', 'Philippines', 'Laguna',
 '', 'Dr. Melinda dela Peña Bandalaria', 'Secretary General', 'secretariat@aaou.org',
 '', 'https://www.linkedin.com/in/melinda-dela-pe%C3%B1a-bandalaria-0b0b1b1a/', 1, 1,
 '32nd Annual Conference of AAOU.', 'New', NULL, '', NULL, NULL, NULL, NULL, 400);

-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create a view for leads with email count
CREATE OR REPLACE VIEW leads_with_email_count AS
SELECT 
    l.*,
    COUNT(el.id) as email_count
FROM leads l
LEFT JOIN email_logs el ON l.id = el.lead_id
GROUP BY l.id;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;

COMMENT ON TABLE users IS 'System users with different roles (Director, Sales, Viewer)';
COMMENT ON TABLE email_templates IS 'Email templates for lead communication';
COMMENT ON TABLE leads IS 'Lead companies and organizations for event hosting';
COMMENT ON TABLE email_logs IS 'Email communication history with leads';
COMMENT ON TABLE email_log_attachments IS 'Attachments associated with email logs';
COMMENT ON TABLE chat_messages IS 'AI chat assistant conversation messages';

