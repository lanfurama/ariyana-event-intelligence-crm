export interface EmailLog {
  id: string;
  date: string;
  subject: string;
  status: 'sent' | 'draft';
  attachments?: { name: string; size: number; type: string }[];
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
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
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
}

export interface Attachment {
  name: string;
  size: number;
  type: string;
}

export type UserRole = 'Director' | 'Sales' | 'Viewer';

export interface User {
  username: string;
  name: string;
  role: UserRole;
  avatar?: string;
}