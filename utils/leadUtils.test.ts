import { describe, expect, it } from 'vitest';
import { mapLeadFromDB, mapLeadToDB } from './leadUtils';
import type { Lead } from '../types';

describe('mapLeadFromDB', () => {
  it('maps snake_case DB row to camelCase Lead', () => {
    const lead = mapLeadFromDB({
      id: 'l1',
      company_name: 'Acme',
      industry: 'MICE',
      country: 'Vietnam',
      city: 'Hanoi',
      website: 'https://acme.example',
      key_person_name: 'Lan',
      key_person_title: 'Director',
      key_person_email: 'lan@acme.example',
      key_person_phone: '0901234567',
      total_events: 3,
      vietnam_events: 1,
      status: 'New',
    });
    expect(lead.companyName).toBe('Acme');
    expect(lead.keyPersonEmail).toBe('lan@acme.example');
    expect(lead.totalEvents).toBe(3);
    expect(lead.vietnamEvents).toBe(1);
  });

  it('falls back to camelCase keys when snake_case absent', () => {
    const lead = mapLeadFromDB({
      id: 'l2',
      companyName: 'Beta',
      industry: 'Tech',
      country: 'Singapore',
      city: 'SG',
      keyPersonName: 'Tom',
      status: 'Contacted',
    });
    expect(lead.companyName).toBe('Beta');
    expect(lead.keyPersonName).toBe('Tom');
  });

  it('defaults missing fields to empty string or 0', () => {
    const lead = mapLeadFromDB({
      id: 'l3',
      industry: 'X',
      country: 'Y',
      city: 'Z',
      status: 'New',
    });
    expect(lead.website).toBe('');
    expect(lead.totalEvents).toBe(0);
  });
});

describe('mapLeadToDB round-trip', () => {
  it('preserves identity when piping through both directions', () => {
    const dbRow = {
      id: 'l1',
      company_name: 'Acme',
      industry: 'MICE',
      country: 'Vietnam',
      city: 'Hanoi',
      website: 'https://acme.example',
      key_person_name: 'Lan',
      key_person_title: 'Director',
      key_person_email: 'lan@acme.example',
      key_person_phone: '0901234567',
      key_person_linkedin: 'https://linkedin.com/in/lan',
      total_events: 3,
      vietnam_events: 1,
      notes: 'hot lead',
      status: 'New' as const,
    };
    const camelLead: Lead = mapLeadFromDB(dbRow);
    const back = mapLeadToDB(camelLead);
    // Each snake_case key should re-appear with the same logical value
    expect(back.company_name).toBe(dbRow.company_name);
    expect(back.key_person_email).toBe(dbRow.key_person_email);
    expect(back.total_events).toBe(dbRow.total_events);
  });
});
