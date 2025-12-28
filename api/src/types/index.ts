export type UserRole = 'Director' | 'Sales' | 'Viewer';
export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Won' | 'Lost';
export type EmailLogStatus = 'sent' | 'draft' | 'failed';

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
  message_id?: string;
  created_at?: Date;
}

export interface EmailReply {
  id: string;
  email_log_id: string;
  lead_id: string;
  from_email: string;
  from_name?: string;
  subject: string;
  body: string;
  html_body?: string;
  reply_date: Date | string;
  message_id?: string;
  in_reply_to?: string;
  references_header?: string;
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

export interface ChatMessage {
  id: string;
  username: string;
  role: 'user' | 'model' | 'assistant'; // 'model' for backward compatibility, 'assistant' for GPT
  text: string;
  timestamp: Date | string;
  created_at?: Date;
}

export interface EventBrief {
  eventName?: string;
  eventSeries?: string;
  industry?: string;
  averageAttendance?: number;
  openYear?: number;
  frequency?: string;
  rotationArea?: string;
  rotationPattern?: string;
  duration?: string;
  preferredMonths?: string;
  preferredVenue?: string;
  breakoutRooms?: string;
  roomSizes?: string;
  infoOnLastUpcomingEvents?: string;
  eventHistory?: string;
  delegatesProfile?: string;
  internationalOrganisationName?: string;
  internationalOrganisationWebsite?: string;
  organizationProfile?: string;
    localHostName?: string;
    localHostTitle?: string;
    localHostEmail?: string;
    localHostPhone?: string;
    localHostOrganization?: string;
    localHostWebsite?: string;
    localStrengths?: string;
    conferenceRegistration?: string;
  decisionMaker?: string;
  decisionMakingProcess?: string;
  keyBidCriteria?: string;
  competitors?: string;
  competitiveAnalysis?: string;
  hostResponsibility?: string;
  sponsors?: string;
  layout?: string;
  fitForAriyana?: string;
  opportunityScore?: number;
  iccaQualified?: string;
}

