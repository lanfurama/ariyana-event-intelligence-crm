import { useState, useMemo, useCallback } from 'react';
import type { Lead } from '../types';
import { parseEnrichResponse } from '../utils/leadEnrichUtils';
import type { ParsedEnrichContact } from '../utils/leadEnrichUtils';
import { enrichLeadData } from '../services/vertexAiService';

const GENERIC_EMAIL_PREFIXES = ['info@', 'contact@', 'admin@', 'support@'];

function isGenericEmail(email: string): boolean {
  const lower = email.trim().toLowerCase();
  return GENERIC_EMAIL_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

function isEmpty(value: string | undefined): boolean {
  return value === undefined || value === null || String(value).trim() === '';
}

export interface EnrichResult {
  text: string;
  parsed: ParsedEnrichContact;
  hasResult: boolean;
}

export interface UseLeadsNeedingEnrichOptions {
  /** Optional: called when user confirms sync (not used by hook; view handles sync). */
  onUpdateLead?: (updated: Lead) => Promise<void>;
}

export function useLeadsNeedingEnrich(
  leads: Lead[],
  _options: UseLeadsNeedingEnrichOptions = {}
) {
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
  const [enrichError, setEnrichError] = useState<string | null>(null);

  const leadsNeedingEnrich = useMemo(
    () => {
      return leads.filter((lead) => {
        const emailOk =
          !isEmpty(lead.keyPersonEmail) && !isGenericEmail(lead.keyPersonEmail || '');
        return !emailOk; // Only show leads without email
      });
    },
    [leads]
  );

  /** Only fetches and parses; does NOT write to database. Sync happens on user confirm. */
  const enrichLead = useCallback(async (lead: Lead): Promise<EnrichResult> => {
    setEnrichError(null);
    setEnrichingIds((prev) => new Set(prev).add(lead.id));
    try {
      const { text } = await enrichLeadData({
        companyName: lead.companyName,
        keyPerson: lead.keyPersonName ?? undefined,
        city: lead.city ?? undefined,
        country: lead.country,
        website: lead.website,
        industry: lead.industry,
        keyPersonTitle: lead.keyPersonTitle,
        keyPersonEmail: lead.keyPersonEmail,
        keyPersonPhone: lead.keyPersonPhone,
        notes: lead.notes,
        researchNotes: lead.researchNotes,
        pastEventsHistory: lead.pastEventsHistory,
        secondaryPersonName: lead.secondaryPersonName,
        secondaryPersonTitle: lead.secondaryPersonTitle,
        secondaryPersonEmail: lead.secondaryPersonEmail,
      });
      const parsed = parseEnrichResponse(text);
      const hasResult = !!(
        parsed.keyPersonName ||
        parsed.keyPersonTitle ||
        parsed.keyPersonEmail ||
        parsed.keyPersonPhone
      );
      return { text, parsed, hasResult };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Enrichment failed';
      setEnrichError(message);
      throw err;
    } finally {
      setEnrichingIds((prev) => {
        const next = new Set(prev);
        next.delete(lead.id);
        return next;
      });
    }
  }, []);

  const clearError = useCallback(() => setEnrichError(null), []);

  return {
    leadsNeedingEnrich,
    enrichLead,
    enrichingIds,
    enrichError,
    clearError,
  };
}
