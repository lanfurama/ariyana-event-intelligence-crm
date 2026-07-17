export interface EmailLogAttachment {
  name: string;
  size: number;
  type: string;
}

export interface EmailLog {
  id: string;
  lead_id?: string;
  date: string;
  subject: string;
  status: 'sent' | 'draft';
  message_id?: string;
  attachments?: EmailLogAttachment[];
}

export interface LeadWithEmailCount extends Lead {
  emailCount?: number;
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
  language?: string; // e.g. 'en', 'vi', 'th'
  attachments?: EmailTemplateAttachment[];
}

export interface EmailTemplateAttachment {
  id?: number;
  template_id?: string; // Server fills on create/update; absent on input payload
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

// --- Venue booking (smart convention centre track) ---
// Deliberately snake_case: these mirror the API JSON 1:1 (like EmailReply),
// so there is no mapLeadFromDB-style translation layer to drift.

export type BookingStatus = 'inquiry' | 'hold' | 'quoted' | 'confirmed' | 'completed' | 'cancelled';
export type BookingSource = 'manual' | 'portal' | 'email_ai';

export interface VenueCapacities {
  theatre?: number;
  classroom?: number;
  banquet?: number;
  cocktail?: number;
  ushape?: number;
  boardroom?: number;
}

export interface VenueRates {
  hourly?: number;
  half_day?: number;
  full_day?: number;
}

export interface Venue {
  id: string;
  name: string;
  slug: string;
  floor?: string;
  area_sqm?: number;
  ceiling_height_m?: number;
  capacities: VenueCapacities;
  description?: string;
  images: string[];
  base_rates: VenueRates;
  amenities: string[];
  is_active: boolean;
  display_order: number;
}

export interface BookingSpace {
  id?: number;
  booking_id?: string;
  venue_id: string;
  start_at: string;
  end_at: string;
  setup_minutes: number;
  teardown_minutes: number;
  block_start_at?: string;
  block_end_at?: string;
  booking_status?: BookingStatus;
}

export interface Booking {
  id: string;
  code: string;
  lead_id?: string;
  title: string;
  event_type?: string;
  status: BookingStatus;
  expected_guests?: number;
  layout?: string;
  notes?: string;
  source: BookingSource;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  spaces: BookingSpace[];
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
export type QuoteItemKind = 'venue' | 'fnb' | 'av' | 'service' | 'other';

export interface QuoteItem {
  id?: number;
  quote_id?: string;
  kind: QuoteItemKind;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order?: number;
}

export interface Quote {
  id: string;
  booking_id: string;
  version: number;
  status: QuoteStatus;
  currency: string;
  subtotal: number;
  discount_pct: number;
  vat_pct: number;
  total: number;
  valid_until?: string | null;
  sent_at?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  items: QuoteItem[];
}

export type UserRole = 'Director' | 'Sales' | 'Viewer';

export interface User {
  username: string;
  name: string;
  role: UserRole;
  avatar?: string;
}
