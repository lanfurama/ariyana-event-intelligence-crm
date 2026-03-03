export interface EmailLog {
  id: string;
  lead_id?: string;
  date: string;
  subject: string;
  status: 'sent' | 'draft';
  message_id?: string;
  attachments?: { name: string; size: number; type: string }[];
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
  reply_date: string;
  message_id?: string;
  in_reply_to?: string;
  references_header?: string;
  created_at?: string;
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

export interface Lead {
  id: string;
  companyName: string;
  industry: string;
  country: string;
  city: string;
  website: string;
  keyPersonName: string;
  keyPersonTitle: string;
  keyPersonEmail: string;
  keyPersonPhone: string;
  keyPersonLinkedIn: string;
  
  // New enriched fields
  pastEventsHistory?: string;
  secondaryPersonName?: string;
  secondaryPersonTitle?: string;
  secondaryPersonEmail?: string;
  researchNotes?: string;
  numberOfDelegates?: number; // New field for attendee count

  totalEvents: number;
  vietnamEvents: number;
  notes: string;
  status: 'New' | 'Contacted' | 'Qualified' | 'Won' | 'Lost';
  lastContacted?: string;
  
  emailHistory?: EmailLog[];
  
  // Event Brief - comprehensive event information
  eventBrief?: EventBrief;
  
  // Analysis scores
  totalScore?: number;
  historyScore?: number;
  regionScore?: number;
  contactScore?: number;
  delegatesScore?: number;
  problems?: string[];
  nextStepStrategy?: string;
  draftedEmail?: { subject: string; body: string };
  emailDrafted?: boolean;
  
  // Lead Scoring
  leadScore?: number; // 0-100 AI-powered lead quality score
  lastScoreUpdate?: string; // ISO timestamp of last scoring
  
  // Lead Type
  type?: string; // 'CORP' for Corporate partner leads, 'DMC' for Destination Management Company partner leads
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'assistant'; // 'model' for backward compatibility, 'assistant' for GPT
  text: string;
  timestamp: Date;
}

export interface VideoGenerationState {
  isGenerating: boolean;
  videoUri?: string;
  error?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  leadType?: string; // 'CORP', 'DMC', or undefined for default templates
  attachments?: EmailTemplateAttachment[];
}

export interface EmailTemplateAttachment {
  id?: number;
  template_id: string;
  name: string;
  size: number;
  type: string;
  file_data?: string; // Base64 encoded file content
  created_at?: Date;
}

export interface Attachment {
  name: string;
  size: number;
  type: string;
  file_data?: string; // Base64 encoded file content for uploads
  is_link?: boolean; // If true, name contains the link URL
}

export type UserRole = 'Director' | 'Sales' | 'Viewer';

export interface User {
  username: string;
  name: string;
  role: UserRole;
  avatar?: string;
}