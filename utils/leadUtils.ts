import { Lead } from '../types';

export const mapLeadFromDB = (dbLead: any): Lead => {
  return {
    id: dbLead.id,
    companyName: dbLead.company_name || dbLead.companyName,
    industry: dbLead.industry,
    country: dbLead.country,
    city: dbLead.city,
    website: dbLead.website || '',
    keyPersonName: dbLead.key_person_name || dbLead.keyPersonName,
    keyPersonTitle: dbLead.key_person_title || dbLead.keyPersonTitle || '',
    keyPersonEmail: dbLead.key_person_email || dbLead.keyPersonEmail || '',
    keyPersonPhone: dbLead.key_person_phone || dbLead.keyPersonPhone || '',
    keyPersonLinkedIn: dbLead.key_person_linkedin || dbLead.keyPersonLinkedIn || '',
    totalEvents: dbLead.total_events || dbLead.totalEvents || 0,
    vietnamEvents: dbLead.vietnam_events || dbLead.vietnamEvents || 0,
    notes: dbLead.notes || '',
    status: dbLead.status,
    lastContacted: dbLead.last_contacted || dbLead.lastContacted,
    pastEventsHistory: dbLead.past_events_history || dbLead.pastEventsHistory,
    secondaryPersonName: dbLead.secondary_person_name || dbLead.secondaryPersonName,
    secondaryPersonTitle: dbLead.secondary_person_title || dbLead.secondaryPersonTitle,
    secondaryPersonEmail: dbLead.secondary_person_email || dbLead.secondaryPersonEmail,
    researchNotes: dbLead.research_notes || dbLead.researchNotes,
    numberOfDelegates: dbLead.number_of_delegates || dbLead.numberOfDelegates,
  };
};

export const mapLeadToDB = (lead: Lead): any => {
  return {
    id: lead.id,
    company_name: lead.companyName,
    industry: lead.industry,
    country: lead.country,
    city: lead.city,
    website: lead.website || null,
    key_person_name: lead.keyPersonName,
    key_person_title: lead.keyPersonTitle || null,
    key_person_email: lead.keyPersonEmail || null,
    key_person_phone: lead.keyPersonPhone || null,
    key_person_linkedin: lead.keyPersonLinkedIn || null,
    total_events: lead.totalEvents || 0,
    vietnam_events: lead.vietnamEvents || 0,
    notes: lead.notes || null,
    status: lead.status || 'New',
    last_contacted: lead.lastContacted || null,
    past_events_history: lead.pastEventsHistory || null,
    research_notes: lead.researchNotes || null,
    secondary_person_name: lead.secondaryPersonName || null,
    secondary_person_title: lead.secondaryPersonTitle || null,
    secondary_person_email: lead.secondaryPersonEmail || null,
    number_of_delegates: lead.numberOfDelegates || null,
  };
};














