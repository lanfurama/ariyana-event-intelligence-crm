export type UserRole = 'Director' | 'Sales' | 'Viewer';
export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Won' | 'Lost';
export type EmailLogStatus = 'sent' | 'draft' | 'failed';
export type BookingStatus = 'inquiry' | 'hold' | 'quoted' | 'confirmed' | 'completed' | 'cancelled';
export type BookingSource = 'manual' | 'portal' | 'email_ai';
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
export type QuoteItemKind = 'venue' | 'fnb' | 'av' | 'service' | 'other';

// Alias for clarity in places where Lead represents a database row
export type LeadRow = Lead;

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
  lead_type?: string;
  language?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface EmailTemplateAttachment {
  id?: number;
  template_id: string;
  name: string;
  size: number;
  type: string;
  file_data: string; // Base64 encoded file content
  created_at?: Date;
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
  lead_score?: number;
  last_score_update?: Date | string;
  type?: string;
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
  created_at?: Date;
  updated_at?: Date;
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
  created_at?: Date;
  updated_at?: Date;
}

export interface BookingSpace {
  id?: number;
  booking_id: string;
  venue_id: string;
  start_at: Date | string;
  end_at: Date | string;
  setup_minutes: number;
  teardown_minutes: number;
  block_start_at?: Date | string;
  block_end_at?: Date | string;
  booking_status?: BookingStatus;
  created_at?: Date;
}

export interface BookingWithSpaces extends Booking {
  spaces: BookingSpace[];
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
  valid_until?: Date | string;
  sent_at?: Date | string;
  notes?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface QuoteItem {
  id?: number;
  quote_id: string;
  kind: QuoteItemKind;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
}
