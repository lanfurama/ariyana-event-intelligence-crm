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

/**
 * Request AI research for a lead's key person contact (name, title, email, phone).
 * Returns raw response text; use parseEnrichResponse() to extract structured fields.
 */
export async function enrichLeadData(
  companyName: string,
  keyPerson: string,
  city: string
): Promise<EnrichResponse> {
  if (!companyName?.trim()) {
    throw new Error('Company name is required for data enrichment');
  }
  return vertexApiCall<EnrichResponse>('/enrich', {
    companyName: companyName.trim(),
    keyPerson: (keyPerson ?? '').trim(),
    city: (city ?? '').trim(),
  });
}
