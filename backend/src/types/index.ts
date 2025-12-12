export type UserRole = 'Director' | 'Sales' | 'Viewer';
export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Won' | 'Lost';
export type EmailLogStatus = 'sent' | 'draft';

export interface User {
  username: string;
  name: string;
  role: UserRole;
  avatar?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface Lead {
  id: string;
  company_name: string;
  industry: string;
  country: string;
  city: string;
  website?: string;
  key_person_name: string;
  key_person_title?: string;
  key_person_email?: string;
  key_person_phone?: string;
  key_person_linkedin?: string;
  total_events: number;
  vietnam_events: number;
  notes?: string;
  status: LeadStatus;
  last_contacted?: Date | string;
  past_events_history?: string;
  secondary_person_name?: string;
  secondary_person_title?: string;
  secondary_person_email?: string;
  research_notes?: string;
  number_of_delegates?: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface EmailLog {
  id: string;
  lead_id: string;
  date: Date | string;
  subject: string;
  status: EmailLogStatus;
  created_at?: Date;
}

export interface EmailLogAttachment {
  id?: number;
  email_log_id: string;
  name: string;
  size: number;
  type: string;
  created_at?: Date;
}

export interface LeadWithEmailCount extends Lead {
  email_count?: number;
}

