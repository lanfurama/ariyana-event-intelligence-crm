/**
 * Vertex AI service for Event Intelligence (lead enrichment).
 * All calls go through backend /api/v1/vertex - API keys stay server-side.
 */

const API_BASE = '/api/v1';

export interface EnrichResponse {
  text: string;
}

async function vertexApiCall<T>(endpoint: string, body: object): Promise<T> {
  const url = `${API_BASE}/vertex${endpoint}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = (data as { error?: string }).error ?? `HTTP ${res.status}`;
    const err = new Error(msg) as Error & { retryDelay?: number; isRateLimit?: boolean };
    if (typeof (data as { retryDelay?: number }).retryDelay === 'number')
      err.retryDelay = (data as { retryDelay: number }).retryDelay;
    if ((data as { isRateLimit?: boolean }).isRateLimit) err.isRateLimit = true;
    throw err;
  }

  return data as T;
}

export interface EnrichLeadInput {
  companyName: string;
  keyPerson?: string;
  city?: string;
  country?: string;
  website?: string;
  industry?: string;
  keyPersonTitle?: string;
  keyPersonEmail?: string;
  keyPersonPhone?: string;
  notes?: string;
  researchNotes?: string;
  pastEventsHistory?: string;
  secondaryPersonName?: string;
  secondaryPersonTitle?: string;
  secondaryPersonEmail?: string;
}

/**
 * Request AI research for a lead's key person contact. Uses full lead context for accurate search.
 * Returns raw response text; use parseEnrichResponse() to extract structured fields.
 */
export async function enrichLeadData(input: EnrichLeadInput): Promise<EnrichResponse> {
  if (!input.companyName?.trim()) {
    throw new Error('Company name is required for data enrichment');
  }
  return vertexApiCall<EnrichResponse>('/enrich', {
    companyName: input.companyName.trim(),
    keyPerson: (input.keyPerson ?? '').trim() || undefined,
    city: (input.city ?? '').trim() || undefined,
    country: (input.country ?? '').trim() || undefined,
    website: (input.website ?? '').trim() || undefined,
    industry: (input.industry ?? '').trim() || undefined,
    keyPersonTitle: (input.keyPersonTitle ?? '').trim() || undefined,
    keyPersonEmail: (input.keyPersonEmail ?? '').trim() || undefined,
    keyPersonPhone: (input.keyPersonPhone ?? '').trim() || undefined,
    notes: (input.notes ?? '').trim() || undefined,
    researchNotes: (input.researchNotes ?? '').trim() || undefined,
    pastEventsHistory: (input.pastEventsHistory ?? '').trim() || undefined,
    secondaryPersonName: (input.secondaryPersonName ?? '').trim() || undefined,
    secondaryPersonTitle: (input.secondaryPersonTitle ?? '').trim() || undefined,
    secondaryPersonEmail: (input.secondaryPersonEmail ?? '').trim() || undefined,
  });
}
